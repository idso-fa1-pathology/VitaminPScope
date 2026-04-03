from __future__ import annotations

import os
import traceback
from pprint import pformat

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response

from services.export_service import export_job
from services.roi_crop_service import crop_roi_to_temp_patch
from services.source_registry_service import get_source_by_id, SourceNotFoundError

router = APIRouter(tags=["exports"])


def _resolve_source_slide_path(source_id: str, relative_path: str) -> str:
    print("\n[exports::_resolve_source_slide_path] START")
    print("[exports::_resolve_source_slide_path] source_id:", repr(source_id))
    print("[exports::_resolve_source_slide_path] relative_path:", repr(relative_path))

    if not relative_path:
        print("[exports::_resolve_source_slide_path] ERROR: missing relative_path")
        raise ValueError("slide_path is required")

    try:
        source = get_source_by_id(source_id)
        print("[exports::_resolve_source_slide_path] source loaded:", source)
    except SourceNotFoundError as exc:
        print("[exports::_resolve_source_slide_path] ERROR: source not found")
        traceback.print_exc()
        raise ValueError(str(exc)) from exc

    if not source.enabled:
        print("[exports::_resolve_source_slide_path] ERROR: source disabled")
        raise ValueError(f"Source '{source_id}' is disabled")

    source_root = os.path.abspath(source.path)
    print("[exports::_resolve_source_slide_path] source_root:", source_root)
    print("[exports::_resolve_source_slide_path] source_root exists:", os.path.exists(source_root))
    print("[exports::_resolve_source_slide_path] source_root isdir:", os.path.isdir(source_root))

    rel = (relative_path or "").strip().replace("\\", "/")
    print("[exports::_resolve_source_slide_path] rel after strip/replace:", repr(rel))

    rel = os.path.normpath(rel)
    print("[exports::_resolve_source_slide_path] rel after normpath:", repr(rel))

    if rel in ("", "."):
        print("[exports::_resolve_source_slide_path] ERROR: invalid rel empty/dot")
        raise ValueError("Invalid slide_path")

    if os.path.isabs(rel) or rel.startswith(".."):
        print("[exports::_resolve_source_slide_path] ERROR: invalid rel absolute/parent traversal")
        raise ValueError("Invalid slide_path")

    full_path = os.path.abspath(os.path.join(source_root, rel))
    print("[exports::_resolve_source_slide_path] full_path:", full_path)
    print("[exports::_resolve_source_slide_path] full_path exists:", os.path.exists(full_path))
    print("[exports::_resolve_source_slide_path] full_path isfile:", os.path.isfile(full_path))
    print(
        "[exports::_resolve_source_slide_path] full_path startswith source_root:",
        full_path.startswith(source_root),
    )

    if os.path.isdir(source_root):
        try:
            print("[exports::_resolve_source_slide_path] source_root listing sample:")
            for name in sorted(os.listdir(source_root))[:20]:
                print("   -", name)
        except Exception:
            print("[exports::_resolve_source_slide_path] could not list source_root")
            traceback.print_exc()

    if not full_path.startswith(source_root):
        print("[exports::_resolve_source_slide_path] ERROR: path escaped source_root")
        raise ValueError("Invalid slide_path")

    if not os.path.isfile(full_path):
        print("[exports::_resolve_source_slide_path] ERROR: file not found")
        raise ValueError(f"Slide not found: {relative_path}")

    print("[exports::_resolve_source_slide_path] SUCCESS")
    return full_path


@router.post("/exports/roi-image")
def export_roi_image_direct(payload: dict = Body(...)):
    print("\n========== [exports/roi-image] REQUEST START ==========")
    try:
        print("[exports/roi-image] raw payload type:", type(payload))
        print("[exports/roi-image] raw payload:")
        print(pformat(payload))

        print("[exports/roi-image] cwd:", os.getcwd())
        print("[exports/roi-image] /data exists:", os.path.exists("/data"))
        print("[exports/roi-image] /data/sample_slides exists:", os.path.exists("/data/sample_slides"))
        print("[exports/roi-image] /data/.roi_patches exists:", os.path.exists("/data/.roi_patches"))

        if os.path.isdir("/data/sample_slides"):
            try:
                print("[exports/roi-image] /data/sample_slides listing sample:")
                for name in sorted(os.listdir("/data/sample_slides"))[:20]:
                    print("   -", name)
            except Exception:
                print("[exports/roi-image] could not list /data/sample_slides")
                traceback.print_exc()

        relative_slide_path = payload.get("slide_path")
        source_id = payload.get("source_id", "default")
        roi = payload.get("roi")

        print("[exports/roi-image] relative_slide_path:", repr(relative_slide_path))
        print("[exports/roi-image] source_id:", repr(source_id))
        print("[exports/roi-image] roi type:", type(roi))
        print("[exports/roi-image] roi value:", pformat(roi))

        if not relative_slide_path or not roi:
            print("[exports/roi-image] ERROR: missing slide_path or roi")
            raise ValueError("slide_path and roi are required")

        if isinstance(roi, dict):
            print("[exports/roi-image] roi.x:", roi.get("x"))
            print("[exports/roi-image] roi.y:", roi.get("y"))
            print("[exports/roi-image] roi.width:", roi.get("width"))
            print("[exports/roi-image] roi.height:", roi.get("height"))

        slide_path = _resolve_source_slide_path(source_id, relative_slide_path)

        print("[exports/roi-image] resolved slide_path:", slide_path)
        print("[exports/roi-image] resolved slide_path exists:", os.path.exists(slide_path))
        print("[exports/roi-image] resolved slide_path isfile:", os.path.isfile(slide_path))
        print(
            "[exports/roi-image] resolved slide_path size:",
            os.path.getsize(slide_path) if os.path.exists(slide_path) else "missing",
        )

        print("[exports/roi-image] calling crop_roi_to_temp_patch...")
        patch_path, meta = crop_roi_to_temp_patch(slide_path, roi)
        print("[exports/roi-image] crop_roi_to_temp_patch returned")

        print("[exports/roi-image] patch_path:", patch_path)
        print("[exports/roi-image] meta:")
        print(pformat(meta))

        print("[exports/roi-image] patch_path exists:", os.path.exists(patch_path))
        print("[exports/roi-image] patch_path isfile:", os.path.isfile(patch_path))
        print(
            "[exports/roi-image] patch_path size:",
            os.path.getsize(patch_path) if os.path.exists(patch_path) else "missing",
        )

        if os.path.exists(patch_path):
            try:
                with open(patch_path, "rb") as f:
                    first_bytes = f.read(32)
                print("[exports/roi-image] first 32 bytes:", first_bytes)
            except Exception:
                print("[exports/roi-image] could not read first bytes of patch")
                traceback.print_exc()

        filename = meta.get("patch_name", "roi.png")
        media_type = "image/png"
        if filename.lower().endswith(".tif") or filename.lower().endswith(".tiff"):
            media_type = "image/tiff"

        print("[exports/roi-image] filename:", filename)
        print("[exports/roi-image] media_type:", media_type)
        print("[exports/roi-image] returning FileResponse")
        print("========== [exports/roi-image] REQUEST SUCCESS ==========\n")

        return FileResponse(
            path=patch_path,
            media_type=media_type,
            filename=filename,
        )

    except Exception as e:
        print("========== [exports/roi-image] REQUEST FAILED ==========")
        print("[exports/roi-image] exception type:", type(e).__name__)
        print("[exports/roi-image] exception message:", str(e))
        traceback.print_exc()
        print("========================================================\n")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exports/{job_id}")
def export_results(
    job_id: str,
    format: str = Query(default="geojson"),
):
    print(f"\n[exports/{job_id}] START format={format!r}")
    try:
        result = export_job(job_id, format)
        print(f"[exports/{job_id}] export_job returned type={type(result)}")

        if format == "csv":
            print(f"[exports/{job_id}] returning CSV")
            return Response(
                content=result,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="roi_{job_id}.csv"'
                },
            )

        if format == "parquet":
            print(f"[exports/{job_id}] returning PARQUET")
            return Response(
                content=result,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="roi_{job_id}.parquet"'
                },
            )

        if format == "png":
            print(f"[exports/{job_id}] png result preview: {pformat(result)}")
            if not isinstance(result, dict) or result.get("kind") != "file":
                print(f"[exports/{job_id}] ERROR: invalid file export result")
                raise ValueError("Invalid file export result")

            print(f"[exports/{job_id}] returning PNG/TIFF FileResponse path={result['path']!r}")
            return FileResponse(
                path=result["path"],
                media_type=result.get("media_type", "application/octet-stream"),
                filename=result.get("filename", f"roi_{job_id}"),
            )

        print(f"[exports/{job_id}] returning JSON")
        return JSONResponse(content=result)

    except Exception as e:
        print(f"[exports/{job_id}] FAILED type={type(e).__name__} message={str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))