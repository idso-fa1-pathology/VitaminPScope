from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi import Query

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

# =========================================================
# 🔥 NEW — WSI ASYNC SEGMENTATION
# =========================================================

from services.ai_client import (
    start_wsi_job,
    get_job_status,
    get_job_results,
)


@router.post("/slide/{filename:path}/ai/wsi-segmentation")
def start_wsi_segmentation(
    filename: str,
    payload: RoiSegmentationRequest,
    source_id: str = Query(default="default"),
):
    try:
        from main import get_slide_path

        slide_path = get_slide_path(source_id, filename)

        auto_mpp, auto_mag = _extract_slide_resolution(slide_path)

        request_branches = _resolve_default_branches(payload.mode, payload.branches)

        resolved_target_mpp = payload.target_mpp if payload.target_mpp is not None else auto_mpp
        resolved_mpp_override = payload.mpp_override if payload.mpp_override is not None else auto_mpp
        resolved_magnification = payload.magnification if payload.magnification is not None else auto_mag

        resolved_magnification = _normalize_magnification(
            resolved_magnification,
            resolved_target_mpp,
        )

        ai_payload = {
            "wsi_path": slide_path,  # 🔥 full WSI (not ROI patch)
            "model_name": payload.model_name,
            "checkpoint_name": payload.checkpoint_name,
            "device": payload.device,
            "branches": request_branches,
            "patch_size": payload.patch_size,
            "overlap": payload.overlap,
            "target_mpp": resolved_target_mpp,
            "magnification": resolved_magnification,
            "batch_size": payload.batch_size,
            "filter_tissue": payload.filter_tissue,
            "tissue_threshold": payload.tissue_threshold,
            "clean_overlaps": payload.clean_overlaps,
            "save_geojson": True,   # always save for WSI
            "save_json": True,
            "save_visualization": False,
            "min_area_um": payload.min_area_um,
            "detection_threshold": payload.detection_threshold,
            "mpp_override": resolved_mpp_override,
            "mif_channel_config": payload.mif_channel_config,
        }

        job = start_wsi_job(ai_payload)

        return {
            "status": "submitted",
            "job_id": job["job_id"],
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# =========================================================
# 🔥 Job status
# =========================================================
@router.get("/jobs/{job_id}/status")
def get_wsi_job_status(job_id: str):
    try:
        return get_job_status(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# =========================================================
# 🔥 Job results
# =========================================================
@router.get("/jobs/{job_id}/results")
def get_wsi_job_results(job_id: str):
    try:
        return get_job_results(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc