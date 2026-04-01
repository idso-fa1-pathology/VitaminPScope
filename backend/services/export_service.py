from io import StringIO
from typing import Any, Dict, Tuple

import pandas as pd

from services.ai_client import get_job_results
from services.roi_crop_service import crop_roi_to_temp_patch


def _instances_to_dataframe(instances):
    rows = []

    for inst in instances:
        centroid = inst.get("centroid") or [None, None]

        rows.append(
            {
                "cell_id": inst.get("id"),
                "type": inst.get("type"),
                "x": centroid[0],
                "y": centroid[1],
                "area": inst.get("area"),
                "confidence": inst.get("confidence"),
            }
        )

    return pd.DataFrame(rows)


def export_geojson(instances):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": inst.get("geometry"),
                "properties": {
                    "id": inst.get("id"),
                    "type": inst.get("type"),
                    "area": inst.get("area"),
                    "confidence": inst.get("confidence"),
                    "centroid": inst.get("centroid"),
                },
            }
            for inst in instances
        ],
    }


def export_csv(instances):
    df = _instances_to_dataframe(instances)
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


def export_parquet(instances):
    df = _instances_to_dataframe(instances)
    return df.to_parquet(index=False)


def _extract_slide_path(request_metadata: Dict[str, Any]) -> str:
    candidates = [
        request_metadata.get("slide_path"),
        request_metadata.get("image_path"),
        request_metadata.get("path"),
    ]

    slide_obj = request_metadata.get("slide")
    if isinstance(slide_obj, dict):
        candidates.extend(
            [
                slide_obj.get("path"),
                slide_obj.get("slide_path"),
                slide_obj.get("image_path"),
            ]
        )

    for value in candidates:
        if isinstance(value, str) and value.strip():
            return value

    raise ValueError("Slide path not found in job request metadata")


def _extract_roi(request_metadata: Dict[str, Any]) -> Dict[str, float]:
    roi = request_metadata.get("roi")
    if not isinstance(roi, dict):
        raise ValueError("ROI not found in job request metadata")

    required = ("x", "y", "width", "height")
    if not all(key in roi for key in required):
        raise ValueError("ROI is missing one or more required fields: x, y, width, height")

    return {
        "x": float(roi["x"]),
        "y": float(roi["y"]),
        "width": float(roi["width"]),
        "height": float(roi["height"]),
    }


def export_roi_image(request_metadata: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    slide_path = _extract_slide_path(request_metadata)
    roi = _extract_roi(request_metadata)
    patch_path, crop_metadata = crop_roi_to_temp_patch(slide_path, roi)
    return patch_path, crop_metadata


def export_job(job_id: str, format: str):
    job = get_job_results(job_id)

    if job.get("status") != "completed":
        raise ValueError("Job not completed")

    instances = job.get("outputs", {}).get("instances", [])
    request_metadata = job.get("request_metadata", {}) or {}

    if format == "geojson":
        return export_geojson(instances)

    if format == "json":
        return {"instances": instances}

    if format == "csv":
        return export_csv(instances)

    if format == "parquet":
        return export_parquet(instances)

    if format == "png":
        patch_path, crop_metadata = export_roi_image(request_metadata)
        return {
            "kind": "file",
            "path": patch_path,
            "media_type": "image/png",
            "filename": crop_metadata.get("patch_name", f"roi_{job_id}.png"),
            "metadata": crop_metadata,
        }

    raise ValueError(f"Unsupported format: {format}")