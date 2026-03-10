import os
import uuid
from pathlib import Path
from typing import Dict, Tuple

import large_image
import numpy as np
import tifffile

ROI_TEMP_DIR = Path("/data/.roi_patches")
ROI_TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _safe_int(value: float) -> int:
    return int(round(float(value)))


def _should_preserve_multichannel(slide_path: str) -> bool:
    lower = slide_path.lower()
    return lower.endswith(".ome.tif") or lower.endswith(".ome.tiff")


def _squeeze_singleton_channel(arr: np.ndarray) -> np.ndarray:
    arr = np.asarray(arr)
    if arr.ndim == 3 and arr.shape[-1] == 1:
        return arr[:, :, 0]
    if arr.ndim == 3 and arr.shape[0] == 1:
        return arr[0]
    return arr


def _get_frame_indices(ts) -> list[int]:
    try:
        metadata = ts.getMetadata() or {}
        frames = metadata.get("frames")
        if isinstance(frames, list) and len(frames) > 0:
            return list(range(len(frames)))
    except Exception:
        pass
    return [0]

def _crop_multichannel_region(ts, x: int, y: int, width: int, height: int) -> tuple[np.ndarray, str]:
    """
    Returns:
      (array, layout)

    layout is one of:
      - "CHW" for stacked single-channel frames
      - "HWC" for already interleaved RGB/RGBA or multichannel regions
    """
    frame_indices = _get_frame_indices(ts)

    if not frame_indices:
        raise ValueError("No frames found for multichannel crop")

    first_arr, _ = ts.getRegion(
        region={
            "left": x,
            "top": y,
            "width": width,
            "height": height,
            "units": "base_pixels",
        },
        format=large_image.tilesource.TILE_FORMAT_NUMPY,
        frame=frame_indices[0],
    )
    first_arr = np.asarray(first_arr)

    # RGB/RGBA already interleaved
    if first_arr.ndim == 3 and first_arr.shape[-1] in (3, 4):
        return first_arr, "HWC"

    # Single-channel frame
    first_arr = _squeeze_singleton_channel(first_arr)
    if first_arr.ndim != 2:
        raise ValueError(
            f"Expected 2D frame after squeezing, got shape={first_arr.shape} for frame={frame_indices[0]}"
        )

    cropped_channels = [first_arr]

    for frame_idx in frame_indices[1:]:
        frame_arr, _ = ts.getRegion(
            region={
                "left": x,
                "top": y,
                "width": width,
                "height": height,
                "units": "base_pixels",
            },
            format=large_image.tilesource.TILE_FORMAT_NUMPY,
            frame=frame_idx,
        )
        frame_arr = _squeeze_singleton_channel(np.asarray(frame_arr))

        if frame_arr.ndim != 2:
            raise ValueError(
                f"Expected 2D frame after squeezing, got shape={frame_arr.shape} for frame={frame_idx}"
            )

        cropped_channels.append(frame_arr)

    return np.stack(cropped_channels, axis=0), "CHW"

def crop_roi_to_temp_patch(
    slide_path: str,
    roi: Dict[str, float],
) -> Tuple[str, Dict[str, int]]:
    """
    Crop an ROI from a slide and write it to a shared temp folder under /data.

    H&E / RGB:
      - save as PNG

    MIF / OME-TIFF:
      - crop every frame separately
      - stack to CHW
      - convert CHW -> HWC before saving so downstream TIFF readers interpret it correctly
      - save as TIFF with tifffile to preserve channels
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

        region_array, layout = _crop_multichannel_region(ts, x, y, width, height)

        if layout == "CHW":
            region_array_to_save = np.moveaxis(region_array, 0, -1)  # CHW -> HWC
        elif layout == "HWC":
            region_array_to_save = region_array
        else:
            raise ValueError(f"Unsupported multichannel layout: {layout}")

        tifffile.imwrite(str(patch_path), region_array_to_save)

    else:
        patch_path = ROI_TEMP_DIR / f"roi_{patch_id}.png"

        region_binary, _ = ts.getRegion(
            region={
                "left": x,
                "top": y,
                "width": width,
                "height": height,
                "units": "base_pixels",
            },
            format=large_image.tilesource.TILE_FORMAT_IMAGE,
            encoding="PNG",
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