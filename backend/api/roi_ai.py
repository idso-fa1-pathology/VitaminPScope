from fastapi import APIRouter, HTTPException, Query
import large_image

from models.ai_schemas import (
    RoiSegmentationLayer,
    RoiSegmentationRequest,
    RoiSegmentationResponse,
)
from services.ai_client import AiServiceError, run_roi_segmentation
from services.ai_result_mapper import (
    build_result_metrics,
    normalize_roi_result_to_layers,
)
from services.roi_crop_service import cleanup_temp_patch, crop_roi_to_temp_patch

router = APIRouter()

MIN_SUPPORTED_MPP = 0.2125


def _resolve_default_branches(mode: str, branches: list[str]) -> list[str]:
    if branches:
        return branches
    if mode == "mif":
        return ["mif_nuclei", "mif_cell"]
    return ["he_nuclei", "he_cell"]


def _normalize_magnification(raw_mag, mpp):
    if raw_mag is not None:
        try:
            mag = float(raw_mag)
            if abs(mag - 40) <= abs(mag - 20):
                return 40
            return 20
        except Exception:
            pass

    if mpp is not None:
        try:
            if mpp <= 0.30:
                return 40
            return 20
        except Exception:
            pass

    return 40


def _extract_slide_resolution(slide_path: str):
    default_mpp = 0.2125
    default_mag = 40

    try:
        ts = large_image.getTileSource(slide_path)
        metadata = ts.getMetadata() or {}

        mpp = None
        raw_mag = metadata.get("magnification")

        mm_x = metadata.get("mm_x")
        mm_y = metadata.get("mm_y")

        if mm_x is not None:
            try:
                mpp = float(mm_x) * 1000.0
            except Exception:
                pass

        if mpp is None and mm_y is not None:
            try:
                mpp = float(mm_y) * 1000.0
            except Exception:
                pass

        if mpp is None:
            mpp = default_mpp

        if mpp < MIN_SUPPORTED_MPP:
            mpp = MIN_SUPPORTED_MPP

        magnification = _normalize_magnification(raw_mag, mpp)

        return (mpp, magnification)

    except Exception:
        return (default_mpp, default_mag)


@router.post("/slide/{filename:path}/ai/roi-segmentation", response_model=RoiSegmentationResponse)
def run_roi_ai_segmentation(
    filename: str,
    payload: RoiSegmentationRequest,
    source_id: str = Query(default="default"),
):
    patch_path = None

    try:
        from main import get_slide_path

        slide_path = get_slide_path(source_id, filename)
        auto_mpp, auto_mag = _extract_slide_resolution(slide_path)

        patch_path, crop_meta = crop_roi_to_temp_patch(
            slide_path=slide_path,
            roi=payload.roi.model_dump(),
        )

        request_branches = _resolve_default_branches(payload.mode, payload.branches)

        resolved_target_mpp = payload.target_mpp if payload.target_mpp is not None else auto_mpp
        resolved_mpp_override = payload.mpp_override if payload.mpp_override is not None else auto_mpp
        resolved_magnification = payload.magnification if payload.magnification is not None else auto_mag

        resolved_magnification = _normalize_magnification(
            resolved_magnification,
            resolved_target_mpp,
        )

        ai_payload = {
            "wsi_path": patch_path,
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
            "save_geojson": payload.save_geojson,
            "save_json": payload.save_json,
            "save_visualization": False,
            "min_area_um": payload.min_area_um,
            "detection_threshold": payload.detection_threshold,
            "mpp_override": resolved_mpp_override,
            "mif_channel_config": payload.mif_channel_config,
        }

        ai_result = run_roi_segmentation(ai_payload)

        layers_data = normalize_roi_result_to_layers(
            ai_result=ai_result,
            roi_x=crop_meta["x"],
            roi_y=crop_meta["y"],
        )

        result_metrics = build_result_metrics(layers_data)
        layers = [RoiSegmentationLayer(**layer) for layer in layers_data]

        return RoiSegmentationResponse(
            status="completed",
            message="ROI segmentation completed successfully",
            slide_path=filename,
            roi=payload.roi,
            layers=layers,
            stats={
                "source_id": source_id,
                "result_metrics": result_metrics,
                "branches": {
                    layer.branch: layer.stats for layer in layers
                },
                "resolution": {
                    "target_mpp": resolved_target_mpp,
                    "mpp_override": resolved_mpp_override,
                    "magnification": resolved_magnification,
                },
            },
        )

    except AiServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if patch_path:
            cleanup_temp_patch(patch_path)