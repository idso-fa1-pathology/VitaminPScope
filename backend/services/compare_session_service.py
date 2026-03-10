from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class CompareSessionService:
    def __init__(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        self.file_path = repo_root / "data" / "compare_sessions.json"
        self._lock = threading.Lock()
        self._ensure_file()

    def _ensure_file(self) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            self.file_path.write_text("[]", encoding="utf-8")

    def _read(self) -> list[dict[str, Any]]:
        self._ensure_file()
        try:
            raw = self.file_path.read_text(encoding="utf-8").strip() or "[]"
            data = json.loads(raw)
            if isinstance(data, list):
                return data
        except Exception:
            pass
        return []

    def _write(self, sessions: list[dict[str, Any]]) -> None:
        self._ensure_file()
        self.file_path.write_text(
            json.dumps(sessions, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            sessions = self._read()
            sessions.sort(
                key=lambda item: item.get("updated_at") or item.get("created_at") or "",
                reverse=True,
            )
            return sessions

    def create_session(
        self,
        *,
        name: str,
        source_id: str,
        slides: list[str],
        layout: str = "auto",
        sync_enabled: bool = True,
    ) -> dict[str, Any]:
        cleaned_name = (name or "").strip()
        cleaned_source_id = (source_id or "default").strip() or "default"
        cleaned_slides = [str(s).strip() for s in slides if str(s).strip()]

        if not cleaned_name:
            raise ValueError("Session name is required.")
        if len(cleaned_slides) < 2:
            raise ValueError("A compare session requires at least 2 slides.")

        now = self._now()

        with self._lock:
            sessions = self._read()
            next_id = f"cmp_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

            session = {
                "id": next_id,
                "name": cleaned_name,
                "source_id": cleaned_source_id,
                "slides": cleaned_slides,
                "layout": layout or "auto",
                "sync_enabled": bool(sync_enabled),
                "created_at": now,
                "updated_at": now,
            }

            sessions.append(session)
            self._write(sessions)
            return session

    def rename_session(self, session_id: str, name: str) -> dict[str, Any]:
        cleaned_name = (name or "").strip()
        if not cleaned_name:
            raise ValueError("Session name is required.")

        with self._lock:
            sessions = self._read()
            for session in sessions:
                if session.get("id") == session_id:
                    session["name"] = cleaned_name
                    session["updated_at"] = self._now()
                    self._write(sessions)
                    return session

        raise FileNotFoundError("Compare session not found.")

    def delete_session(self, session_id: str) -> None:
        with self._lock:
            sessions = self._read()
            next_sessions = [s for s in sessions if s.get("id") != session_id]

            if len(next_sessions) == len(sessions):
                raise FileNotFoundError("Compare session not found.")

            self._write(next_sessions)


compare_session_service = CompareSessionService()