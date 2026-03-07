import os
import base64
from functools import lru_cache
from urllib.parse import quote

import large_image
from fastapi import FastAPI, Response, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from utils.image_utils import tint_grayscale_tile

app = FastAPI(title="VitaminPScope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Length", "Content-Range", "ETag", "Last-Modified"],
)

DATA_DIR = "/data/sample_slides"

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


class RenameItemRequest(BaseModel):
    old_path: str
    new_name: str


class DeleteItemRequest(BaseModel):
    path: str


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


def resolve_data_path(relative_path: str) -> str:
    safe_rel = sanitize_relative_path(relative_path)
    full_path = os.path.abspath(os.path.join(DATA_DIR, safe_rel))
    data_root = os.path.abspath(DATA_DIR)

    if not full_path.startswith(data_root):
        raise HTTPException(status_code=400, detail="Invalid path")

    return full_path


def get_slide_path(filename: str) -> str:
    filepath = resolve_data_path(filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")
    return filepath


@lru_cache(maxsize=32)
def get_cached_tilesource(filepath: str):
    return large_image.getTileSource(filepath)


@lru_cache(maxsize=64)
def get_cached_slide_metadata(filepath: str):
    ts = get_cached_tilesource(filepath)
    return ts.getMetadata()


def clear_slide_caches():
    get_cached_tilesource.cache_clear()
    get_cached_slide_metadata.cache_clear()


def get_slide_type_and_metadata(filename: str):
    filepath = get_slide_path(filename)
    try:
        metadata = get_cached_slide_metadata(filepath)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not open slide: {str(e)}",
        )
    return detect_slide_type(os.path.basename(filename)), metadata


def extract_channels(metadata: dict) -> list:
    channels = []

    if "channels" in metadata and isinstance(metadata["channels"], list):
        channels = [
            {"index": i, "name": ch if ch is not None else f"Channel {i}"}
            for i, ch in enumerate(metadata["channels"])
        ]
    elif "frames" in metadata and isinstance(metadata["frames"], list):
        seen = set()
        for frame in metadata["frames"]:
            idx = frame.get("IndexC")
            name = frame.get("Channel", f"Channel {idx}")
            if idx is not None and idx not in seen:
                channels.append({"index": idx, "name": name})
                seen.add(idx)
    else:
        band_count = metadata.get("bandCount")
        if band_count:
            channels = [
                {"index": i, "name": f"Channel {i}"}
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
    return "application/octet-stream"


def build_folder_item(folder_name: str, relative_path: str) -> dict:
    return {
        "name": folder_name,
        "path": relative_path,
    }


def build_slide_item(filename: str, relative_path: str) -> dict:
    return {
        "name": filename,
        "type": detect_slide_type(filename),
        "path": relative_path,
    }


@app.get("/")
def read_root():
    return {"status": "VitaminPScope API running"}


@app.get("/slides")
def list_slides(path: str = Query(default="")):
    ensure_data_dir()

    relative_path = sanitize_relative_path(path)
    target_dir = resolve_data_path(relative_path)

    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Folder not found")

    if not os.path.isdir(target_dir):
        raise HTTPException(status_code=400, detail="Path is not a folder")

    entries = sorted(os.listdir(target_dir), key=lambda x: x.lower())

    folders = []
    slides = []

    for entry in entries:
        full_path = os.path.join(target_dir, entry)
        item_relative_path = os.path.relpath(full_path, DATA_DIR).replace("\\", "/")

        if os.path.isdir(full_path):
            folders.append(build_folder_item(entry, item_relative_path))
        elif os.path.isfile(full_path) and entry.lower().endswith(IMAGE_EXTENSIONS):
            slides.append(build_slide_item(entry, item_relative_path))

    return {
        "current_path": relative_path,
        "folders": folders,
        "slides": slides,
    }


@app.post("/folders")
def create_folder(payload: CreateFolderRequest):
    ensure_data_dir()

    folder_name = payload.name.strip()
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    if "/" in folder_name or "\\" in folder_name:
        raise HTTPException(status_code=400, detail="Folder name must not contain slashes")

    parent_rel = sanitize_relative_path(payload.parent_path)
    parent_dir = resolve_data_path(parent_rel)

    if not os.path.isdir(parent_dir):
        raise HTTPException(status_code=404, detail="Parent folder does not exist")

    new_folder_path = os.path.join(parent_dir, folder_name)

    if os.path.exists(new_folder_path):
        raise HTTPException(status_code=400, detail="Folder already exists")

    os.makedirs(new_folder_path, exist_ok=False)

    relative_path = os.path.relpath(new_folder_path, DATA_DIR).replace("\\", "/")
    return {
        "message": "Folder created successfully",
        "folder": build_folder_item(folder_name, relative_path),
    }


@app.patch("/items/rename")
def rename_item(payload: RenameItemRequest):
    ensure_data_dir()

    old_rel = sanitize_relative_path(payload.old_path)
    new_name = payload.new_name.strip()

    if not old_rel:
        raise HTTPException(status_code=400, detail="Old path is required")

    if not new_name:
        raise HTTPException(status_code=400, detail="New name is required")

    if "/" in new_name or "\\" in new_name:
        raise HTTPException(status_code=400, detail="New name must not contain slashes")

    old_full = resolve_data_path(old_rel)

    if not os.path.exists(old_full):
        raise HTTPException(status_code=404, detail="Item not found")

    parent_dir = os.path.dirname(old_full)
    new_full = os.path.join(parent_dir, new_name)

    if os.path.exists(new_full):
        raise HTTPException(status_code=400, detail="An item with that name already exists")

    os.rename(old_full, new_full)
    clear_slide_caches()

    new_rel = os.path.relpath(new_full, DATA_DIR).replace("\\", "/")

    return {
        "message": "Item renamed successfully",
        "item": {
            "name": new_name,
            "path": new_rel,
            "kind": "folder" if os.path.isdir(new_full) else "slide",
            "type": None if os.path.isdir(new_full) else detect_slide_type(new_name),
        },
    }


@app.delete("/items")
def delete_item(payload: DeleteItemRequest):
    ensure_data_dir()

    rel_path = sanitize_relative_path(payload.path)
    if not rel_path:
        raise HTTPException(status_code=400, detail="Path is required")

    full_path = resolve_data_path(rel_path)

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
def get_metadata(filename: str):
    slide_type, metadata = get_slide_type_and_metadata(filename)
    channels = extract_channels(metadata)

    return {
        "name": os.path.basename(filename),
        "path": filename,
        "type": slide_type,
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename:path}/viv")
def get_viv_info(filename: str):
    slide_type, metadata = get_slide_type_and_metadata(filename)
    channels = extract_channels(metadata)

    if slide_type != "ome-tiff":
        raise HTTPException(
            status_code=400,
            detail="Viv endpoint currently supports OME-TIFF slides only",
        )

    return {
        "name": os.path.basename(filename),
        "path": filename,
        "type": slide_type,
        "source_url": f"/slide/{quote(filename)}/source",
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename:path}/source")
def get_slide_source(filename: str):
    filepath = get_slide_path(filename)
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
):
    filepath = get_slide_path(filename)
    slide_type = detect_slide_type(os.path.basename(filename))
    max_size = normalize_max_size(max_size)

    try:
        ts = get_cached_tilesource(filepath)

        result = ts.getThumbnail(
            width=max_size,
            height=max_size,
            frame=frame,
            encoding="JPEG",
        )

        image_binary, mime_type = unpack_image_result(result)

        if slide_type == "ome-tiff" and color:
            image_binary = tint_grayscale_tile(image_binary, color=color)
            mime_type = "image/png"

        return Response(
            content=image_binary,
            media_type=mime_type,
            headers=CACHE_HEADERS,
        )

    except Exception as e:
        print(f"THUMBNAIL ERROR for {filename} frame={frame}: {e}")
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
):
    filepath = get_slide_path(filename)
    slide_type = detect_slide_type(os.path.basename(filename))

    try:
        ts = get_cached_tilesource(filepath)

        result = ts.getTile(
            x,
            y,
            z,
            frame=frame,
            encoding="JPEG",
        )

        tile_binary, mime_type = unpack_image_result(result)

        if slide_type == "ome-tiff" and color:
            tile_binary = tint_grayscale_tile(tile_binary, color=color)
            mime_type = "image/png"

        return Response(
            content=tile_binary,
            media_type=mime_type,
            headers=CACHE_HEADERS,
        )

    except Exception as e:
        print(f"TILE ERROR for {filename} z={z} x={x} y={y} frame={frame}: {e}")
        return Response(
            content=EMPTY_TILE,
            media_type="image/png",
            headers=CACHE_HEADERS,
        )