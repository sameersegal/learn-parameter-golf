"""Pydantic models for the session execution & logs API."""

from __future__ import annotations

import enum
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"
    FAILED = "failed"


class SessionCreateRequest(BaseModel):
    prompt: str = Field(..., description="The instruction to send to Claude")
    allowed_tools: list[str] = Field(
        default_factory=lambda: ["Read", "Edit", "Bash", "Glob", "Grep", "Write"],
        description="Tools the agent is allowed to use",
    )
    working_directory: str | None = Field(
        None, description="Working directory for the agent (defaults to server cwd)"
    )
    max_turns: int = Field(
        default=0, description="Max conversation turns (0 = unlimited)"
    )
    system_prompt: str | None = Field(
        None, description="Optional system prompt override"
    )


class SessionSummary(BaseModel):
    session_id: str
    status: SessionStatus
    prompt: str
    claude_session_id: str | None = Field(
        None, description="Underlying Claude SDK session ID (set after first response)"
    )
    created_at: datetime
    updated_at: datetime


class SessionDetail(SessionSummary):
    allowed_tools: list[str]
    working_directory: str
    log_count: int = 0


# ---------------------------------------------------------------------------
# Log entries
# ---------------------------------------------------------------------------

class LogLevel(str, enum.Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    ERROR = "error"


class LogEntry(BaseModel):
    session_id: str
    seq: int = Field(..., description="Monotonic sequence number within session")
    timestamp: datetime
    level: LogLevel
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Relative time parsing
# ---------------------------------------------------------------------------

_RELATIVE_RE = re.compile(
    r"^(?P<value>\d+)\s*(?P<unit>s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|weeks?)$",
    re.IGNORECASE,
)

_UNIT_MAP = {
    "s": "seconds", "sec": "seconds", "secs": "seconds", "second": "seconds", "seconds": "seconds",
    "m": "minutes", "min": "minutes", "mins": "minutes", "minute": "minutes", "minutes": "minutes",
    "h": "hours", "hr": "hours", "hrs": "hours", "hour": "hours", "hours": "hours",
    "d": "days", "day": "days", "days": "days",
    "w": "weeks", "week": "weeks", "weeks": "weeks",
}


def parse_relative_time(value: str) -> datetime | None:
    """Parse a relative duration string like '5m', '2h', '1d' into an absolute datetime.

    Returns a UTC datetime that is ``value`` duration in the past from now,
    or None if the string is not a valid relative time.
    """
    match = _RELATIVE_RE.match(value.strip())
    if not match:
        return None
    amount = int(match.group("value"))
    unit = _UNIT_MAP.get(match.group("unit").lower())
    if not unit:
        return None
    delta = timedelta(**{unit: amount})
    return datetime.now(timezone.utc) - delta


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class LogSearchRequest(BaseModel):
    session_id: str = Field(default="", description="Session to search within (set from path)")
    query: str | None = Field(None, description="Full-text substring search")
    level: LogLevel | None = None
    start_time: datetime | None = Field(
        None,
        description="Absolute ISO-8601 start time, or use 'since' for relative",
    )
    end_time: datetime | None = Field(
        None,
        description="Absolute ISO-8601 end time, or use 'until' for relative",
    )
    since: str | None = Field(
        None,
        description="Relative start time, e.g. '5m', '2h', '1d', '1w'. Overrides start_time.",
    )
    until: str | None = Field(
        None,
        description="Relative end time, e.g. '30s', '10m'. Overrides end_time.",
    )
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def resolve_relative_times(self) -> LogSearchRequest:
        if self.since:
            resolved = parse_relative_time(self.since)
            if resolved is None:
                raise ValueError(
                    f"Invalid relative time '{self.since}'. "
                    "Use formats like '5m', '2h', '1d', '1w'."
                )
            self.start_time = resolved
        if self.until:
            resolved = parse_relative_time(self.until)
            if resolved is None:
                raise ValueError(
                    f"Invalid relative time '{self.until}'. "
                    "Use formats like '30s', '10m', '1h'."
                )
            self.end_time = resolved
        return self


class LogSearchResponse(BaseModel):
    total: int
    entries: list[LogEntry]
