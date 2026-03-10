import os
import io
import math
import base64
from functools import lru_cache
from urllib.parse import quote

import large_image
from PIL import Image
from fastapi import FastAPI, Response, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from api.roi_ai import router as roi_ai_router
from api.uploads import router as uploads_router
from api.sources import router as sources_router
from services.source_registry_service import get_source_by_id, SourceNotFoundError
from utils.image_utils import tint_grayscale_tile
from api.compare_sessions import router as compare_sessions_router

app = FastAPI(title="VitaminPScope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Length", "Content-Range", "ETag", "Last-Modified"],
)

app.include_router(roi_ai_router)
app.include_router(uploads_router)
app.include_router(sources_router)
app.include_router(compare_sessions_router, prefix="/compare-sessions")

DATA_DIR = os.getenv("VITAMINP_DATA_ROOT", "/data/sample_slides")
FALLBACK_TILE_SIZE = 256

EMPTY_TILE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

IMAGE_EXTENSIONS = (
    ".svs",
    ".ndpi",
    ".tif",
    ".tiff",
    ".ome.tif",
    ".ome.tiff",
    ".png",
    ".jpg",
    ".jpeg",
    ".czi",
    ".mrxs",
    ".scn",
    ".vms",
    ".vmu",
    ".dcm",
    ".dicom",
)

CACHE_HEADERS = {
    "Cache-Control": "public, max-age=3600, immutable",
}

SOURCE_HEADERS = {
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes",
}


class CreateFolderRequest(BaseModel):
    name: str
    parent_path: str = ""
    source_id: str = "default"


class RenameItemRequest(BaseModel):
    old_path: str
    new_name: str
    source_id: str = "default"


class DeleteItemRequest(BaseModel):
    path: str
    source_id: str = "default"


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def detect_slide_type(filename: str) -> str:
    lower = filename.lower()

    if lower.endswith(".ome.tif") or lower.endswith(".ome.tiff"):
        return "ome-tiff"
    if lower.endswith(".svs"):
        return "svs"
    if lower.endswith(".ndpi"):
        return "ndpi"
    if lower.endswith(".czi"):
        return "czi"
    if lower.endswith(".mrxs"):
        return "mrxs"
    if lower.endswith(".scn"):
        return "scn"
    if lower.endswith(".vms"):
        return "vms"
    if lower.endswith(".vmu"):
        return "vmu"
    if lower.endswith(".dcm") or lower.endswith(".dicom"):
        return "dicom"
    if lower.endswith(".png"):
        return "png"
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "jpeg"
    if lower.endswith(".tif") or lower.endswith(".tiff"):
        return "tiff"

    return "unknown"


def sanitize_relative_path(path: str) -> str:
    path = (path or "").strip().replace("\\", "/")
    path = os.path.normpath(path)

    if path in (".", ""):
        return ""

    if path.startswith("..") or os.path.isabs(path):
        raise HTTPException(status_code=400, detail="Invalid path")

    return path


def get_source_root(source_id: str = "default") -> str:
    try:
        source = get_source_by_id(source_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not source.enabled:
        raise HTTPException(status_code=400, detail=f"Source '{source_id}' is disabled")

    return os.path.abspath(source.path)


def ensure_source_dir(source_id: str = "default"):
    root = get_source_root(source_id)
    os.makedirs(root, exist_ok=True)


def resolve_source_path(source_id: str, relative_path: str) -> str:
    safe_rel = sanitize_relative_path(relative_path)
    source_root = get_source_root(source_id)
    full_path = os.path.abspath(os.path.join(source_root, safe_rel))

    if not full_path.startswith(source_root):
        raise HTTPException(status_code=400, detail="Invalid path")

    return full_path


def get_slide_path(source_id: str, filename: str) -> str:
    filepath = resolve_source_path(source_id, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")
    return filepath


@lru_cache(maxsize=32)
def get_cached_tilesource(filepath: str):
    return large_image.getTileSource(filepath)


@lru_cache(maxsize=64)
def get_cached_pil_image(filepath: str):
    with Image.open(filepath) as img:
        img.load()
        return img.copy()


@lru_cache(maxsize=64)
def get_cached_slide_metadata(filepath: str):
    try:
        ts = get_cached_tilesource(filepath)
        metadata = ts.getMetadata()
        return {
            "backend": "large_image",
            "metadata": metadata,
        }
    except Exception:
        img = get_cached_pil_image(filepath)
        width, height = img.size
        mode = img.mode or "RGB"

        if mode in ("1", "L", "P"):
            band_count = 1
        elif mode in ("LA",):
            band_count = 2
        elif mode in ("RGB", "YCbCr"):
            band_count = 3
        elif mode in ("RGBA", "CMYK"):
            band_count = 4
        else:
            try:
                band_count = len(img.getbands())
            except Exception:
                band_count = 3

        metadata = {
            "sizeX": width,
            "sizeY": height,
            "tileWidth": FALLBACK_TILE_SIZE,
            "tileHeight": FALLBACK_TILE_SIZE,
            "levels": max(1, math.ceil(math.log2(max(width, height) / FALLBACK_TILE_SIZE)) + 1)
            if max(width, height) > FALLBACK_TILE_SIZE
            else 1,
            "magnification": None,
            "mm_x": None,
            "mm_y": None,
            "dtype": "uint8",
            "bandCount": band_count,
        }

        return {
            "backend": "pil",
            "metadata": metadata,
        }


def clear_slide_caches():
    get_cached_tilesource.cache_clear()
    get_cached_pil_image.cache_clear()
    get_cached_slide_metadata.cache_clear()


def get_slide_type_and_metadata(source_id: str, filename: str):
    filepath = get_slide_path(source_id, filename)

    try:
        payload = get_cached_slide_metadata(filepath)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not open slide: {str(e)}",
        )

    return detect_slide_type(os.path.basename(filename)), payload["metadata"], payload["backend"]


def extract_channels(metadata: dict) -> list:
    channels = []

    if "channels" in metadata and isinstance(metadata["channels"], list):
        channels = [
            {"index": i, "name": ch if ch is not None else f"Channel {i + 1}"}
            for i, ch in enumerate(metadata["channels"])
        ]
    elif "frames" in metadata and isinstance(metadata["frames"], list):
        seen = set()
        for frame in metadata["frames"]:
            idx = frame.get("IndexC")
            name = frame.get("Channel", f"Channel {idx + 1}" if idx is not None else "Channel")
            if idx is not None and idx not in seen:
                channels.append({"index": idx, "name": name})
                seen.add(idx)
    else:
        band_count = metadata.get("bandCount")
        if band_count:
            channels = [
                {"index": i, "name": f"Channel {i + 1}"}
                for i in range(int(band_count))
            ]

    return channels


def unpack_image_result(result, default_mime="image/jpeg"):
    if isinstance(result, tuple):
        image_binary = result[0]
        mime_type = result[1] if len(result) > 1 else default_mime
        return image_binary, mime_type
    return result, default_mime


def normalize_max_size(max_size: int) -> int:
    if max_size < 64:
        return 64
    if max_size > 4096:
        return 4096
    return max_size


def get_media_type_for_source(filename: str) -> str:
    slide_type = detect_slide_type(filename)

    if slide_type in ("ome-tiff", "tiff"):
        return "image/tiff"
    if slide_type == "png":
        return "image/png"
    if slide_type == "jpeg":
        return "image/jpeg"

    return "application/octet-stream"


def build_folder_item(folder_name: str, relative_path: str, source_id: str) -> dict:
    return {
        "name": folder_name,
        "path": relative_path,
        "source_id": source_id,
    }


def build_slide_item(filename: str, relative_path: str, source_id: str) -> dict:
    return {
        "name": filename,
        "type": detect_slide_type(filename),
        "path": relative_path,
        "source_id": source_id,
    }


def pil_image_to_bytes(image: Image.Image, encoding: str = "JPEG") -> tuple[bytes, str]:
    output = io.BytesIO()

    if encoding.upper() == "PNG":
        image.save(output, format="PNG")
        return output.getvalue(), "image/png"

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    image.save(output, format="JPEG", quality=90)
    return output.getvalue(), "image/jpeg"


def get_pil_thumbnail(filepath: str, max_size: int) -> tuple[bytes, str]:
    img = get_cached_pil_image(filepath).copy()
    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return pil_image_to_bytes(img, encoding="JPEG")


def get_fallback_level_dimensions(width: int, height: int, z: int, max_level: int) -> tuple[int, int]:
    downsample = 2 ** max(0, max_level - z)
    level_width = max(1, math.ceil(width / downsample))
    level_height = max(1, math.ceil(height / downsample))
    return level_width, level_height


def get_pil_tile(filepath: str, z: int, x: int, y: int, metadata: dict) -> tuple[bytes, str]:
    img = get_cached_pil_image(filepath)
    width, height = img.size

    max_level = max((int(metadata.get("levels") or 1) - 1), 0)
    tile_size = int(metadata.get("tileWidth") or FALLBACK_TILE_SIZE)

    level_width, level_height = get_fallback_level_dimensions(width, height, z, max_level)

    scaled = img.resize((level_width, level_height), Image.Resampling.LANCZOS)

    left = x * tile_size
    top = y * tile_size
    right = min(left + tile_size, level_width)
    bottom = min(top + tile_size, level_height)

    if left >= level_width or top >= level_height:
        return EMPTY_TILE, "image/png"

    tile = scaled.crop((left, top, right, bottom))

    if tile.size != (tile_size, tile_size):
        padded = Image.new("RGB", (tile_size, tile_size), (0, 0, 0))
        if tile.mode not in ("RGB", "L"):
            tile = tile.convert("RGB")
        padded.paste(tile, (0, 0))
        tile = padded

    return pil_image_to_bytes(tile, encoding="JPEG")


@app.get("/")
def read_root():
    return {"status": "VitaminPScope API running"}


@app.get("/slides")
def list_slides(
    path: str = Query(default=""),
    source_id: str = Query(default="default"),
):
    ensure_source_dir(source_id)

    relative_path = sanitize_relative_path(path)
    source_root = get_source_root(source_id)
    target_dir = resolve_source_path(source_id, relative_path)

    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Folder not found")

    if not os.path.isdir(target_dir):
        raise HTTPException(status_code=400, detail="Path is not a folder")

    entries = sorted(os.listdir(target_dir), key=lambda x: x.lower())

    folders = []
    slides = []

    for entry in entries:
        full_path = os.path.join(target_dir, entry)
        item_relative_path = os.path.relpath(full_path, source_root).replace("\\", "/")

        if os.path.isdir(full_path):
            folders.append(build_folder_item(entry, item_relative_path, source_id))
        elif os.path.isfile(full_path) and entry.lower().endswith(IMAGE_EXTENSIONS):
            slides.append(build_slide_item(entry, item_relative_path, source_id))

    return {
        "source_id": source_id,
        "current_path": relative_path,
        "folders": folders,
        "slides": slides,
    }


@app.post("/folders")
def create_folder(payload: CreateFolderRequest):
    source = get_source_by_id(payload.source_id)

    if source.read_only:
        raise HTTPException(status_code=403, detail="This source is read-only")

    ensure_source_dir(payload.source_id)

    folder_name = payload.name.strip()
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    if "/" in folder_name or "\\" in folder_name:
        raise HTTPException(status_code=400, detail="Folder name must not contain slashes")

    parent_rel = sanitize_relative_path(payload.parent_path)
    source_root = get_source_root(payload.source_id)
    parent_dir = resolve_source_path(payload.source_id, parent_rel)

    if not os.path.isdir(parent_dir):
        raise HTTPException(status_code=404, detail="Parent folder does not exist")

    new_folder_path = os.path.join(parent_dir, folder_name)

    if os.path.exists(new_folder_path):
        raise HTTPException(status_code=400, detail="Folder already exists")

    os.makedirs(new_folder_path, exist_ok=False)

    relative_path = os.path.relpath(new_folder_path, source_root).replace("\\", "/")
    return {
        "message": "Folder created successfully",
        "folder": build_folder_item(folder_name, relative_path, payload.source_id),
    }


@app.patch("/items/rename")
def rename_item(payload: RenameItemRequest):
    source = get_source_by_id(payload.source_id)

    if source.read_only:
        raise HTTPException(status_code=403, detail="This source is read-only")

    ensure_source_dir(payload.source_id)

    old_rel = sanitize_relative_path(payload.old_path)
    new_name = payload.new_name.strip()

    if not old_rel:
        raise HTTPException(status_code=400, detail="Old path is required")

    if not new_name:
        raise HTTPException(status_code=400, detail="New name is required")

    if "/" in new_name or "\\" in new_name:
        raise HTTPException(status_code=400, detail="New name must not contain slashes")

    source_root = get_source_root(payload.source_id)
    old_full = resolve_source_path(payload.source_id, old_rel)

    if not os.path.exists(old_full):
        raise HTTPException(status_code=404, detail="Item not found")

    parent_dir = os.path.dirname(old_full)
    new_full = os.path.join(parent_dir, new_name)

    if os.path.exists(new_full):
        raise HTTPException(status_code=400, detail="An item with that name already exists")

    os.rename(old_full, new_full)
    clear_slide_caches()

    new_rel = os.path.relpath(new_full, source_root).replace("\\", "/")

    return {
        "message": "Item renamed successfully",
        "item": {
            "name": new_name,
            "path": new_rel,
            "source_id": payload.source_id,
            "kind": "folder" if os.path.isdir(new_full) else "slide",
            "type": None if os.path.isdir(new_full) else detect_slide_type(new_name),
        },
    }


@app.delete("/items")
def delete_item(payload: DeleteItemRequest):
    source = get_source_by_id(payload.source_id)

    if source.read_only:
        raise HTTPException(status_code=403, detail="This source is read-only")

    ensure_source_dir(payload.source_id)

    rel_path = sanitize_relative_path(payload.path)
    if not rel_path:
        raise HTTPException(status_code=400, detail="Path is required")

    full_path = resolve_source_path(payload.source_id, rel_path)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Item not found")

    if os.path.isdir(full_path):
        if os.listdir(full_path):
            raise HTTPException(
                status_code=400,
                detail="Folder is not empty. Only empty folders can be deleted."
            )
        os.rmdir(full_path)
        clear_slide_caches()
        return {"message": "Folder deleted successfully"}

    os.remove(full_path)
    clear_slide_caches()
    return {"message": "File deleted successfully"}


@app.get("/slide/{filename:path}/metadata")
def get_metadata(
    filename: str,
    source_id: str = Query(default="default"),
):
    slide_type, metadata, backend = get_slide_type_and_metadata(source_id, filename)
    channels = extract_channels(metadata)

    return {
        "name": os.path.basename(filename),
        "path": filename,
        "source_id": source_id,
        "type": slide_type,
        "backend": backend,
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename:path}/viv")
def get_viv_info(
    filename: str,
    source_id: str = Query(default="default"),
):
    slide_type, metadata, backend = get_slide_type_and_metadata(source_id, filename)
    channels = extract_channels(metadata)

    band_count = int(metadata.get("bandCount") or 0)
    is_multichannel = band_count > 3

    if backend != "large_image":
        raise HTTPException(
            status_code=400,
            detail="Viv endpoint requires large_image-compatible multichannel data",
        )

    if not is_multichannel:
        raise HTTPException(
            status_code=400,
            detail="Viv endpoint supports multichannel images only",
        )

    return {
        "name": os.path.basename(filename),
        "path": filename,
        "source_id": source_id,
        "type": slide_type,
        "source_url": f"/slide/{quote(filename)}/source?source_id={quote(source_id)}",
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename:path}/source")
def get_slide_source(
    filename: str,
    source_id: str = Query(default="default"),
):
    filepath = get_slide_path(source_id, filename)
    media_type = get_media_type_for_source(os.path.basename(filename))

    return FileResponse(
        path=filepath,
        filename=os.path.basename(filename),
        media_type=media_type,
        headers=SOURCE_HEADERS,
    )


@app.get("/slide/{filename:path}/thumbnail")
def get_thumbnail(
    filename: str,
    frame: int = Query(default=0),
    color: str | None = Query(default=None),
    max_size: int = Query(default=1400),
    source_id: str = Query(default="default"),
):
    filepath = get_slide_path(source_id, filename)
    slide_type, metadata, backend = get_slide_type_and_metadata(source_id, filename)
    max_size = normalize_max_size(max_size)

    try:
        if backend == "large_image":
            ts = get_cached_tilesource(filepath)

            result = ts.getThumbnail(
                width=max_size,
                height=max_size,
                frame=frame,
                encoding="JPEG",
            )

            image_binary, mime_type = unpack_image_result(result)
        else:
            image_binary, mime_type = get_pil_thumbnail(filepath, max_size)

        if slide_type == "ome-tiff" and color:
            image_binary = tint_grayscale_tile(image_binary, color=color)
            mime_type = "image/png"

        return Response(
            content=image_binary,
            media_type=mime_type,
            headers=CACHE_HEADERS,
        )

    except Exception as e:
        print(f"THUMBNAIL ERROR for {filename} frame={frame} source_id={source_id}: {e}")
        return Response(
            content=EMPTY_TILE,
            media_type="image/png",
            headers=CACHE_HEADERS,
        )


@app.get("/slide/{filename:path}/tiles/{z}/{x}/{y}")
def get_tile(
    filename: str,
    z: int,
    x: int,
    y: int,
    frame: int = Query(default=0),
    color: str | None = Query(default=None),
    source_id: str = Query(default="default"),
):
    filepath = get_slide_path(source_id, filename)
    slide_type, metadata, backend = get_slide_type_and_metadata(source_id, filename)

    try:
        if backend == "large_image":
            ts = get_cached_tilesource(filepath)

            result = ts.getTile(
                x,
                y,
                z,
                frame=frame,
                encoding="JPEG",
            )

            tile_binary, mime_type = unpack_image_result(result)
        else:
            tile_binary, mime_type = get_pil_tile(filepath, z, x, y, metadata)

        if slide_type == "ome-tiff" and color:
            tile_binary = tint_grayscale_tile(tile_binary, color=color)
            mime_type = "image/png"

        return Response(
            content=tile_binary,
            media_type=mime_type,
            headers=CACHE_HEADERS,
        )

    except Exception as e:
        print(f"TILE ERROR for {filename} z={z} x={x} y={y} frame={frame} source_id={source_id}: {e}")
        return Response(
            content=EMPTY_TILE,
            media_type="image/png",
            headers=CACHE_HEADERS,
        )