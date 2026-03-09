from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.source_schemas import (
    CreateSourceRequest,
    SourceItem,
    SourceListResponse,
    SourceMessageResponse,
    UpdateSourceRequest,
)
from services.source_registry_service import (
    SourceNotFoundError,
    SourceValidationError,
    create_source,
    delete_source,
    get_all_sources,
    get_source_by_id,
    update_source,
)

router = APIRouter(tags=["sources"])


@router.get("/sources", response_model=SourceListResponse)
def list_sources() -> SourceListResponse:
    return SourceListResponse(sources=get_all_sources())


@router.get("/sources/{source_id}", response_model=SourceItem)
def get_source(source_id: str) -> SourceItem:
    try:
        return get_source_by_id(source_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sources", response_model=SourceMessageResponse)
def create_source_route(payload: CreateSourceRequest) -> SourceMessageResponse:
    try:
        source = create_source(payload)
        return SourceMessageResponse(
            message="Source created successfully",
            source=source,
        )
    except SourceValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/sources/{source_id}", response_model=SourceMessageResponse)
def update_source_route(
    source_id: str,
    payload: UpdateSourceRequest,
) -> SourceMessageResponse:
    try:
        source = update_source(source_id, payload)
        return SourceMessageResponse(
            message="Source updated successfully",
            source=source,
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SourceValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/sources/{source_id}", response_model=SourceMessageResponse)
def delete_source_route(source_id: str) -> SourceMessageResponse:
    try:
        removed = delete_source(source_id)
        return SourceMessageResponse(
            message="Source deleted successfully",
            source=removed,
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SourceValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc