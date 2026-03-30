"""FastAPI application — session execution & streaming logs API."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .log_store import LogStore
from .models import (
    LogEntry,
    LogLevel,
    LogSearchRequest,
    LogSearchResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionStatus,
    SessionSummary,
)
from .session_manager import SessionManager

# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

log_store = LogStore()
session_manager = SessionManager(log_store)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await session_manager.shutdown()


app = FastAPI(
    title="Meta Agent Server",
    description=(
        "Launch Claude Agent SDK sessions, control their lifecycle "
        "(start / pause / resume / interrupt), stream live logs, "
        "and search session logs with relative temporal filters."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Session CRUD & lifecycle
# ---------------------------------------------------------------------------


@app.post("/sessions", response_model=SessionSummary, status_code=201)
async def create_session(req: SessionCreateRequest):
    """Start a new Claude Agent SDK session."""
    session = await session_manager.create_session(req)
    return session.to_summary()


@app.get("/sessions", response_model=list[SessionSummary])
async def list_sessions(status: SessionStatus | None = None):
    """List all sessions, optionally filtered by status."""
    return session_manager.list_sessions(status)


@app.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Get full details of a specific session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.to_detail()


@app.post("/sessions/{session_id}/pause", response_model=SessionSummary)
async def pause_session(session_id: str):
    """Pause a running session. The agent stops processing after the current step."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.RUNNING:
        raise HTTPException(409, f"Cannot pause session in {session.status} state")
    await session.pause()
    return session.to_summary()


@app.post("/sessions/{session_id}/resume", response_model=SessionSummary)
async def resume_session(session_id: str):
    """Resume a paused session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.PAUSED:
        raise HTTPException(409, f"Cannot resume session in {session.status} state")
    await session.resume()
    return session.to_summary()


@app.post("/sessions/{session_id}/interrupt", response_model=SessionSummary)
async def interrupt_session(session_id: str):
    """Interrupt (cancel) a running or paused session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
        raise HTTPException(409, f"Cannot interrupt session in {session.status} state")
    await session.interrupt()
    return session.to_summary()


# ---------------------------------------------------------------------------
# Send follow-up message to an active session
# ---------------------------------------------------------------------------


@app.post("/sessions/{session_id}/message", response_model=SessionSummary)
async def send_message(session_id: str, body: dict):
    """Send a follow-up instruction to an active session.

    Body: {"message": "your follow-up instruction"}

    This is how the meta-agent injects the next instruction mid-session.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED, SessionStatus.COMPLETED):
        raise HTTPException(409, f"Cannot message session in {session.status} state")

    msg = body.get("message")
    if not msg:
        raise HTTPException(422, "Missing 'message' field")

    # Log the injected instruction
    await log_store.append(session_id, LogLevel.USER, msg)

    # If the session has a live client, send the follow-up query
    if session._client:
        await session._client.query(msg)
        # Re-launch the receive loop if the session had completed
        if session.status == SessionStatus.COMPLETED:
            session.status = SessionStatus.RUNNING
            session._run_task = asyncio.create_task(session._run())

    return session.to_summary()


# ---------------------------------------------------------------------------
# Streaming logs (Server-Sent Events)
# ---------------------------------------------------------------------------


@app.get("/sessions/{session_id}/logs/stream")
async def stream_logs(session_id: str):
    """SSE endpoint — streams log entries for a session in real time.

    Replays all existing entries, then pushes live entries as they arrive.
    Connection closes when the session finishes.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    async def event_generator():
        async for entry in log_store.subscribe(session_id):
            data = entry.model_dump_json()
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Log retrieval & search (session-scoped)
# ---------------------------------------------------------------------------


@app.get("/sessions/{session_id}/logs", response_model=list[LogEntry])
async def get_session_logs(session_id: str):
    """Get all log entries for a session."""
    return log_store.get_session_logs(session_id)


@app.post("/sessions/{session_id}/logs/search", response_model=LogSearchResponse)
async def search_session_logs(session_id: str, req: LogSearchRequest):
    """Search log entries within a session.

    Supports:
    - ``query``: substring search in message text
    - ``level``: filter by log level (system/user/assistant/tool_use/tool_result/error)
    - ``start_time`` / ``end_time``: absolute ISO-8601 temporal range
    - ``since`` / ``until``: relative temporal filters (e.g. "5m", "2h", "1d", "1w")
    - ``limit`` / ``offset``: pagination
    """
    req.session_id = session_id
    total, entries = log_store.search(req)
    return LogSearchResponse(total=total, entries=entries)


@app.get("/sessions/{session_id}/logs/search")
async def search_session_logs_get(
    session_id: str,
    query: str | None = None,
    level: LogLevel | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    since: str | None = Query(
        default=None,
        description="Relative start time, e.g. '5m', '2h', '1d', '1w'",
    ),
    until: str | None = Query(
        default=None,
        description="Relative end time, e.g. '30s', '10m', '1h'",
    ),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """GET variant of session log search.

    Examples:
    - ``/sessions/{id}/logs/search?since=5m`` — last 5 minutes
    - ``/sessions/{id}/logs/search?since=1h&level=error`` — errors in the last hour
    - ``/sessions/{id}/logs/search?since=2d&until=1d&query=quantization`` — 2 days ago to 1 day ago
    """
    req = LogSearchRequest(
        session_id=session_id,
        query=query,
        level=level,
        start_time=start_time,
        end_time=end_time,
        since=since,
        until=until,
        limit=limit,
        offset=offset,
    )
    total, entries = log_store.search(req)
    return LogSearchResponse(total=total, entries=entries)
