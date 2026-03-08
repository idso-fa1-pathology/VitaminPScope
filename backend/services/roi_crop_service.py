import os
import uuid
from pathlib import Path
from typing import Dict, Tuple

import large_image

ROI_TEMP_DIR = Path("/data/.roi_patches")
ROI_TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _safe_int(value: float) -> int:
    return int(round(float(value)))


def _should_preserve_multichannel(slide_path: str) -> bool:
    lower = slide_path.lower()
    return lower.endswith(".ome.tif") or lower.endswith(".ome.tiff")


def crop_roi_to_temp_patch(
    slide_path: str,
    roi: Dict[str, float],
) -> Tuple[str, Dict[str, int]]:
    """
    Crops an ROI from a slide and writes it to a shared temp folder under /data
    so both backend and ai_service containers can access it.

    For H&E/RGB slides:
      - save as PNG

    For multichannel MIF / OME-TIFF:
      - save as TIFF to preserve channels
    """
    ts = large_image.getTileSource(slide_path)

    x = _safe_int(roi["x"])
    y = _safe_int(roi["y"])
    width = max(1, _safe_int(roi["width"]))
    height = max(1, _safe_int(roi["height"]))

    patch_id = uuid.uuid4().hex

    preserve_multichannel = _should_preserve_multichannel(slide_path)

    if preserve_multichannel:
      patch_path = ROI_TEMP_DIR / f"roi_{patch_id}.tiff"
      encoding = "TIFF"
    else:
      patch_path = ROI_TEMP_DIR / f"roi_{patch_id}.png"
      encoding = "PNG"

    region_binary, _mime = ts.getRegion(
        region={
            "left": x,
            "top": y,
            "width": width,
            "height": height,
            "units": "base_pixels",
        },
        format=large_image.tilesource.TILE_FORMAT_IMAGE,
        encoding=encoding,
    )

    with open(patch_path, "wb") as f:
        f.write(region_binary)

    metadata = {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "patch_path": str(patch_path),
        "patch_name": patch_path.name,
    }
    return str(patch_path), metadata


def cleanup_temp_patch(patch_path: str) -> None:
    try:
        if patch_path and os.path.exists(patch_path):
            os.remove(patch_path)
    except Exception:
        pass