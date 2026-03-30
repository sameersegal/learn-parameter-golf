"""Append-only log store with in-memory index and JSONL persistence."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

from .models import LogEntry, LogLevel, LogSearchRequest


class LogStore:
    """Thread-safe, append-only log store.

    - Each session gets a JSONL file under ``log_dir/``.
    - An in-memory list enables fast temporal search.
    - SSE subscribers receive entries in real time via asyncio.Queue.
    """

    def __init__(self, log_dir: str = "data/session_logs") -> None:
        self._log_dir = Path(log_dir)
        self._log_dir.mkdir(parents=True, exist_ok=True)

        # session_id -> list[LogEntry]  (in-memory index)
        self._entries: dict[str, list[LogEntry]] = defaultdict(list)
        # session_id -> monotonic counter
        self._seq: dict[str, int] = defaultdict(int)
        # session_id -> set of subscriber queues
        self._subscribers: dict[str, set[asyncio.Queue[LogEntry | None]]] = defaultdict(set)
        self._lock = asyncio.Lock()

        # Load existing logs on startup
        self._load_existing()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _log_path(self, session_id: str) -> Path:
        return self._log_dir / f"{session_id}.jsonl"

    def _load_existing(self) -> None:
        for path in self._log_dir.glob("*.jsonl"):
            session_id = path.stem
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = LogEntry.model_validate_json(line)
                    self._entries[session_id].append(entry)
                    self._seq[session_id] = max(self._seq[session_id], entry.seq + 1)

    def _persist(self, entry: LogEntry) -> None:
        with open(self._log_path(entry.session_id), "a") as f:
            f.write(entry.model_dump_json() + "\n")

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    async def append(
        self,
        session_id: str,
        level: LogLevel,
        message: str,
        metadata: dict | None = None,
    ) -> LogEntry:
        async with self._lock:
            seq = self._seq[session_id]
            self._seq[session_id] = seq + 1

        entry = LogEntry(
            session_id=session_id,
            seq=seq,
            timestamp=datetime.now(timezone.utc),
            level=level,
            message=message,
            metadata=metadata or {},
        )
        self._entries[session_id].append(entry)
        self._persist(entry)

        # Fan-out to subscribers
        for q in list(self._subscribers.get(session_id, set())):
            try:
                q.put_nowait(entry)
            except asyncio.QueueFull:
                pass  # slow consumer drops entries

        return entry

    # ------------------------------------------------------------------
    # Read / Search
    # ------------------------------------------------------------------

    def search(self, req: LogSearchRequest) -> tuple[int, list[LogEntry]]:
        """Return (total_matching, page_of_entries) scoped to a single session."""
        candidates = list(self._entries.get(req.session_id, []))

        # Filter
        if req.level:
            candidates = [e for e in candidates if e.level == req.level]
        if req.start_time:
            candidates = [e for e in candidates if e.timestamp >= req.start_time]
        if req.end_time:
            candidates = [e for e in candidates if e.timestamp <= req.end_time]
        if req.query:
            q = req.query.lower()
            candidates = [e for e in candidates if q in e.message.lower()]

        # Sort by timestamp
        candidates.sort(key=lambda e: (e.timestamp, e.seq))
        total = len(candidates)
        page = candidates[req.offset : req.offset + req.limit]
        return total, page

    def get_session_logs(self, session_id: str) -> list[LogEntry]:
        return list(self._entries.get(session_id, []))

    # ------------------------------------------------------------------
    # Streaming subscriptions
    # ------------------------------------------------------------------

    async def subscribe(self, session_id: str) -> AsyncIterator[LogEntry]:
        """Yields existing entries then live entries until the sentinel None."""
        q: asyncio.Queue[LogEntry | None] = asyncio.Queue(maxsize=256)
        self._subscribers[session_id].add(q)
        try:
            # Replay existing entries first
            for entry in self._entries.get(session_id, []):
                yield entry

            # Then stream live
            while True:
                entry = await q.get()
                if entry is None:
                    break
                yield entry
        finally:
            self._subscribers[session_id].discard(q)

    async def close_stream(self, session_id: str) -> None:
        """Send sentinel to all subscribers of a session."""
        for q in list(self._subscribers.get(session_id, set())):
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass
