# Meta Agent Server — Design Document

## Overview

A FastAPI server that wraps the Claude Agent SDK (`ClaudeSDKClient`) to provide HTTP APIs for programmatic session lifecycle control and real-time log observability. It is designed to be driven by a meta-agent that launches jobs, monitors their progress through streaming logs, and injects follow-up instructions to steer sessions toward a goal.

## Problem

Claude Agent SDK sessions are single-process, single-turn by default. A meta-agent orchestrating multiple jobs needs to:

1. Launch sessions remotely over HTTP
2. Observe what the agent is doing in real time
3. Pause/resume/interrupt sessions based on what it observes
4. Inject follow-up instructions mid-session to course-correct
5. Search historical logs to learn from past sessions

## Architecture

```
┌─────────────────┐         HTTP/SSE          ┌─────────────────────────┐
│   Meta Agent    │◄────────────────────────►  │   Meta Agent Server     │
│  (orchestrator) │                            │   (FastAPI, port 8420)  │
└─────────────────┘                            ├─────────────────────────┤
                                               │  SessionManager         │
                                               │   ├─ ManagedSession A   │
                                               │   │   └─ ClaudeSDKClient│
                                               │   ├─ ManagedSession B   │
                                               │   │   └─ ClaudeSDKClient│
                                               │   └─ ...                │
                                               ├─────────────────────────┤
                                               │  LogStore               │
                                               │   ├─ In-memory index    │
                                               │   ├─ JSONL persistence  │
                                               │   └─ SSE fan-out queues │
                                               └─────────────────────────┘
                                                          │
                                                          ▼
                                               data/session_logs/*.jsonl
```

## Modules

### `models.py`
Pydantic models shared across the server.

- **`SessionStatus`** — enum: `pending | running | paused | completed | interrupted | failed`
- **`SessionCreateRequest`** — `prompt`, `allowed_tools`, `working_directory`, `max_turns`, `system_prompt`
- **`SessionSummary`** — `session_id`, `status`, `prompt`, `claude_session_id`, `created_at`, `updated_at`
- **`SessionDetail`** — extends summary with `allowed_tools`, `working_directory`, `log_count`
- **`LogEntry`** — `session_id`, `seq` (monotonic), `timestamp`, `level`, `message`, `metadata`
- **`LogLevel`** — enum: `system | user | assistant | tool_use | tool_result | error`
- **`LogSearchRequest`** — `query`, `level`, `start_time`, `end_time`, `since`, `until`, `limit`, `offset`
- **`parse_relative_time()`** — converts strings like `"5m"`, `"2h"`, `"1d"`, `"1w"` into absolute UTC datetimes

### `session_manager.py`
Manages `ClaudeSDKClient` instances and their lifecycle.

**`ManagedSession`** wraps a single `ClaudeSDKClient`:
- `start()` — creates `ClaudeAgentOptions` with `permission_mode="bypassPermissions"`, opens the client, sends the initial prompt, and spawns an `asyncio.Task` for the receive loop
- `_run()` — async loop that calls `client.query()` then iterates `client.receive_response()`, logging each message. Respects a pause gate (`asyncio.Event`) between messages
- `_process_message()` — dispatches `AssistantMessage` (text, tool_use, tool_result), `ResultMessage` into structured log entries
- `pause()` — clears the event gate; the loop blocks after the current step
- `resume()` — sets the event gate; the loop continues
- `interrupt()` — calls `client.interrupt()`, cancels the asyncio task
- Captures `claude_session_id` from `ResultMessage.session_id` for SDK session correlation

**`SessionManager`** is the registry:
- `create_session()` — generates a 12-char hex session ID, creates and starts a `ManagedSession`
- `get_session()` / `list_sessions()` — lookup
- `shutdown()` — interrupts all active sessions on server shutdown

### `log_store.py`
Append-only log store with three layers:

1. **In-memory index** — `dict[session_id, list[LogEntry]]` for fast search
2. **JSONL persistence** — one file per session at `data/session_logs/{session_id}.jsonl`, appended on every write
3. **SSE fan-out** — `dict[session_id, set[asyncio.Queue]]`; each `append()` pushes to all subscriber queues

Key operations:
- `append()` — assigns monotonic `seq`, timestamps, persists, fans out to subscribers
- `search()` — filters by `level`, `start_time`, `end_time`, `query` (substring), with pagination
- `subscribe()` — async generator that replays existing entries then yields live entries; returns `None` sentinel when session ends
- `close_stream()` — pushes sentinel to all subscribers when a session completes/fails/interrupts
- `_load_existing()` — rehydrates in-memory index from JSONL files on startup

### `app.py`
FastAPI application with all routes scoped under `/sessions`.

## API Reference

### Session Lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Start a new session. Body: `SessionCreateRequest` |
| `GET` | `/sessions` | List all sessions. Optional `?status=running` filter |
| `GET` | `/sessions/{session_id}` | Get session detail |
| `POST` | `/sessions/{session_id}/pause` | Pause after current step |
| `POST` | `/sessions/{session_id}/resume` | Resume a paused session |
| `POST` | `/sessions/{session_id}/interrupt` | Cancel a running/paused session |
| `POST` | `/sessions/{session_id}/message` | Inject a follow-up instruction. Body: `{"message": "..."}` |

### Logs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions/{session_id}/logs` | All log entries for a session |
| `GET` | `/sessions/{session_id}/logs/stream` | SSE stream (replay + live) |
| `GET` | `/sessions/{session_id}/logs/search` | Search with query params |
| `POST` | `/sessions/{session_id}/logs/search` | Search with JSON body |

### Search Parameters

| Field | Type | Description |
|-------|------|-------------|
| `query` | `string` | Substring match on message text |
| `level` | `enum` | Filter by log level |
| `start_time` | `ISO-8601` | Absolute start bound |
| `end_time` | `ISO-8601` | Absolute end bound |
| `since` | `string` | Relative start: `"5m"`, `"2h"`, `"1d"`, `"1w"` (overrides `start_time`) |
| `until` | `string` | Relative end: `"30s"`, `"10m"` (overrides `end_time`) |
| `limit` | `int` | Page size (1–1000, default 100) |
| `offset` | `int` | Skip N entries |

Supported relative units: `s/sec/seconds`, `m/min/minutes`, `h/hr/hours`, `d/days`, `w/weeks`.

## Meta-Agent Interaction Pattern

```
1. POST /sessions
   {"prompt": "Analyze the top submissions and summarize quantization techniques"}
   → session_id: "a1b2c3d4e5f6"

2. GET /sessions/a1b2c3d4e5f6/logs/stream
   ← SSE stream of log entries as the agent works

3. Meta-agent observes the agent is going off-track via log content

4. POST /sessions/a1b2c3d4e5f6/pause
   → Agent stops after current step

5. POST /sessions/a1b2c3d4e5f6/message
   {"message": "Focus only on GPTQ and AWQ, ignore other methods"}

6. POST /sessions/a1b2c3d4e5f6/resume
   → Agent continues with new instruction

7. GET /sessions/a1b2c3d4e5f6/logs/search?since=5m&level=assistant
   → Review what the agent produced in the last 5 minutes
```

## Key Design Decisions

- **Session-scoped everything** — no cross-session search. Each session is an isolated unit. The meta-agent knows which sessions it launched.
- **`bypassPermissions` mode** — sessions run autonomously without interactive permission prompts, since they are programmatically controlled.
- **Pause via `asyncio.Event` gate** — the agent finishes its current step (tool call + response) before pausing. This is a clean boundary; we never interrupt mid-tool-execution.
- **SSE over WebSocket** — simpler for the meta-agent to consume (just an HTTP GET), auto-reconnect friendly, and replays history on connect.
- **JSONL persistence** — append-only, one file per session, survives server restarts. No database dependency.
- **Log entries capture structured metadata** — tool_use entries include `{"tool": "Read", "input": {...}}` in metadata, enabling the meta-agent to understand not just what was said but what tools were invoked.

## Dependencies

```
fastapi
uvicorn[standard]
claude-agent-sdk
```

## Running

```bash
pip install -r requirements.txt
python -m meta_agent_server              # port 8420
python -m meta_agent_server --port 9000  # custom port
python -m meta_agent_server --reload     # dev mode
```

Swagger docs available at `http://localhost:8420/docs`.

## File Structure

```
meta-agent-server/
├── .gitignore
├── requirements.txt
├── meta_agent_server/
│   ├── __init__.py
│   ├── __main__.py           # CLI entrypoint
│   ├── models.py             # Pydantic models + relative time parsing
│   ├── log_store.py          # JSONL persistence + in-memory index + SSE fan-out
│   ├── session_manager.py    # ClaudeSDKClient lifecycle wrapper
│   └── app.py                # FastAPI routes
└── data/
    └── session_logs/         # auto-created, one .jsonl per session
```
