"""Manages ClaudeSDKClient sessions for lifecycle control."""

from __future__ import annotations

import asyncio
import os
import traceback
import uuid
from datetime import datetime, timezone

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
from claude_agent_sdk.types import (
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
)

from .log_store import LogStore
from .models import LogLevel, SessionCreateRequest, SessionDetail, SessionStatus, SessionSummary


class ManagedSession:
    """Wraps a single ClaudeSDKClient session."""

    def __init__(
        self,
        session_id: str,
        request: SessionCreateRequest,
        log_store: LogStore,
    ) -> None:
        self.session_id = session_id
        self.request = request
        self.status = SessionStatus.PENDING
        self.claude_session_id: str | None = None
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = self.created_at

        self._log_store = log_store
        self._client: ClaudeSDKClient | None = None
        self._run_task: asyncio.Task | None = None
        self._paused_event = asyncio.Event()
        self._paused_event.set()  # not paused initially

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        cwd = self.request.working_directory or os.getcwd()
        opts = ClaudeAgentOptions(
            allowed_tools=self.request.allowed_tools,
            permission_mode="bypassPermissions",
            cwd=cwd,
            max_turns=self.request.max_turns or None,
            system_prompt=self.request.system_prompt or None,
        )
        self._client = ClaudeSDKClient(options=opts)
        await self._client.__aenter__()

        self.status = SessionStatus.RUNNING
        self.updated_at = datetime.now(timezone.utc)
        await self._log(LogLevel.SYSTEM, "Session started")
        await self._log(LogLevel.USER, self.request.prompt)

        self._run_task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        try:
            await self._client.query(self.request.prompt)
            async for message in self._client.receive_response():
                # Respect pause
                await self._paused_event.wait()

                await self._process_message(message)

                if isinstance(message, ResultMessage):
                    self.claude_session_id = getattr(message, "session_id", None)
                    self.status = SessionStatus.COMPLETED
                    self.updated_at = datetime.now(timezone.utc)
                    await self._log(LogLevel.SYSTEM, "Session completed")

        except asyncio.CancelledError:
            self.status = SessionStatus.INTERRUPTED
            self.updated_at = datetime.now(timezone.utc)
            await self._log(LogLevel.SYSTEM, "Session interrupted")
        except Exception as exc:
            self.status = SessionStatus.FAILED
            self.updated_at = datetime.now(timezone.utc)
            await self._log(LogLevel.ERROR, f"Session failed: {exc}\n{traceback.format_exc()}")
        finally:
            await self._cleanup()
            await self._log_store.close_stream(self.session_id)

    async def _process_message(self, message) -> None:
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    await self._log(LogLevel.ASSISTANT, block.text)
                elif isinstance(block, ToolUseBlock):
                    await self._log(
                        LogLevel.TOOL_USE,
                        f"Tool: {block.name}",
                        metadata={"tool": block.name, "input": block.input},
                    )
                elif isinstance(block, ToolResultBlock):
                    content = getattr(block, "content", str(block))
                    await self._log(
                        LogLevel.TOOL_RESULT,
                        str(content)[:2000],
                        metadata={"tool_use_id": getattr(block, "tool_use_id", None)},
                    )
        elif isinstance(message, ResultMessage):
            result_text = getattr(message, "result", "")
            if result_text:
                await self._log(LogLevel.ASSISTANT, str(result_text))

    async def pause(self) -> None:
        if self.status != SessionStatus.RUNNING:
            return
        self._paused_event.clear()
        self.status = SessionStatus.PAUSED
        self.updated_at = datetime.now(timezone.utc)
        await self._log(LogLevel.SYSTEM, "Session paused")

    async def resume(self) -> None:
        if self.status != SessionStatus.PAUSED:
            return
        self._paused_event.set()
        self.status = SessionStatus.RUNNING
        self.updated_at = datetime.now(timezone.utc)
        await self._log(LogLevel.SYSTEM, "Session resumed")

    async def interrupt(self) -> None:
        if self.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
            return
        # Unpause first so the loop can exit
        self._paused_event.set()
        if self._client:
            await self._client.interrupt()
        if self._run_task and not self._run_task.done():
            self._run_task.cancel()
            try:
                await self._run_task
            except asyncio.CancelledError:
                pass

    async def _cleanup(self) -> None:
        if self._client:
            try:
                await self._client.__aexit__(None, None, None)
            except Exception:
                pass
            self._client = None

    async def _log(self, level: LogLevel, message: str, metadata: dict | None = None) -> None:
        await self._log_store.append(self.session_id, level, message, metadata)

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_summary(self) -> SessionSummary:
        return SessionSummary(
            session_id=self.session_id,
            status=self.status,
            prompt=self.request.prompt,
            claude_session_id=self.claude_session_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    def to_detail(self) -> SessionDetail:
        return SessionDetail(
            session_id=self.session_id,
            status=self.status,
            prompt=self.request.prompt,
            claude_session_id=self.claude_session_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
            allowed_tools=self.request.allowed_tools,
            working_directory=self.request.working_directory or os.getcwd(),
            log_count=len(self._log_store.get_session_logs(self.session_id)),
        )


class SessionManager:
    """Registry of all managed sessions."""

    def __init__(self, log_store: LogStore) -> None:
        self._sessions: dict[str, ManagedSession] = {}
        self._log_store = log_store

    async def create_session(self, request: SessionCreateRequest) -> ManagedSession:
        session_id = uuid.uuid4().hex[:12]
        session = ManagedSession(session_id, request, self._log_store)
        self._sessions[session_id] = session
        await session.start()
        return session

    def get_session(self, session_id: str) -> ManagedSession | None:
        return self._sessions.get(session_id)

    def list_sessions(self, status: SessionStatus | None = None) -> list[SessionSummary]:
        sessions = self._sessions.values()
        if status:
            sessions = [s for s in sessions if s.status == status]
        return [s.to_summary() for s in sessions]

    async def shutdown(self) -> None:
        for session in self._sessions.values():
            if session.status in (SessionStatus.RUNNING, SessionStatus.PAUSED):
                await session.interrupt()
