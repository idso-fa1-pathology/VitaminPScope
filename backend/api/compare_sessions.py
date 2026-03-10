from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.compare_session_service import compare_session_service

router = APIRouter(tags=["compare-sessions"])


class CreateCompareSessionRequest(BaseModel):
    name: str = Field(..., min_length=1)
    source_id: str = Field(default="default")
    slides: list[str] = Field(default_factory=list)
    layout: str = Field(default="auto")
    sync_enabled: bool = Field(default=True)


class RenameCompareSessionRequest(BaseModel):
    name: str = Field(..., min_length=1)


@router.get("")
def list_compare_sessions() -> dict[str, list[dict[str, Any]]]:
    return {"sessions": compare_session_service.list_sessions()}


@router.post("")
def create_compare_session(payload: CreateCompareSessionRequest) -> dict[str, Any]:
    try:
        session = compare_session_service.create_session(
            name=payload.name,
            source_id=payload.source_id,
            slides=payload.slides,
            layout=payload.layout,
            sync_enabled=payload.sync_enabled,
        )
        return {"session": session}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{session_id}")
def rename_compare_session(
    session_id: str, payload: RenameCompareSessionRequest
) -> dict[str, Any]:
    try:
        session = compare_session_service.rename_session(session_id, payload.name)
        return {"session": session}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{session_id}")
def delete_compare_session(session_id: str) -> dict[str, bool]:
    try:
        compare_session_service.delete_session(session_id)
        return {"ok": True}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc