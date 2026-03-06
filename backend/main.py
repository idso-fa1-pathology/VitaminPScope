import os
import base64
from urllib.parse import quote
import large_image
from fastapi import FastAPI, Response, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from utils.image_utils import tint_grayscale_tile

app = FastAPI(title="VitaminPScope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "/data/sample_slides"

EMPTY_TILE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


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


def get_slide_path(filename: str) -> str:
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")
    return filepath


def get_slide_type_and_metadata(filename: str):
    filepath = get_slide_path(filename)

    try:
        ts = large_image.getTileSource(filepath)
        metadata = ts.getMetadata()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not open slide: {str(e)}")

    return detect_slide_type(filename), metadata


def extract_channels(metadata: dict) -> list:
    channels = []

    if "channels" in metadata and isinstance(metadata["channels"], list):
        channels = [{"index": i, "name": ch} for i, ch in enumerate(metadata["channels"])]
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
            channels = [{"index": i, "name": f"Channel {i}"} for i in range(band_count)]

    return channels


def unpack_image_result(result, default_mime="image/jpeg"):
    if isinstance(result, tuple):
        image_binary = result[0]
        mime_type = result[1] if len(result) > 1 else default_mime
        return image_binary, mime_type
    return result, default_mime


@app.get("/")
def read_root():
    return {"status": "WSI Server Running"}


@app.get("/slides")
def list_slides():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        return {"slides": []}

    files = [
        f for f in os.listdir(DATA_DIR)
        if f.lower().endswith(
            (
                ".svs",
                ".ndpi",
                ".tif",
                ".tiff",
                ".ome.tif",
                ".ome.tiff",
            )
        )
    ]

    return {
        "slides": [{"name": f, "type": detect_slide_type(f)} for f in sorted(files)]
    }


@app.get("/slide/{filename}/metadata")
def get_metadata(filename: str):
    slide_type, metadata = get_slide_type_and_metadata(filename)
    channels = extract_channels(metadata)

    return {
        "name": filename,
        "type": slide_type,
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename}/viv")
def get_viv_info(filename: str):
    slide_type, metadata = get_slide_type_and_metadata(filename)
    channels = extract_channels(metadata)

    if slide_type != "ome-tiff":
        raise HTTPException(
            status_code=400,
            detail="Viv endpoint currently supports OME-TIFF slides only",
        )

    return {
        "name": filename,
        "type": slide_type,
        "source_url": f"http://localhost:8000/slide/{quote(filename)}/source",
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename}/source")
def get_slide_source(filename: str):
    filepath = get_slide_path(filename)
    slide_type = detect_slide_type(filename)

    if slide_type == "ome-tiff":
        media_type = "image/tiff"
    elif slide_type in ("tiff",):
        media_type = "image/tiff"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type=media_type,
    )


@app.get("/slide/{filename}/thumbnail")
def get_thumbnail(
    filename: str,
    frame: int = Query(default=0),
    color: str | None = Query(default=None),
    max_size: int = Query(default=1400),
):
    filepath = get_slide_path(filename)
    slide_type = detect_slide_type(filename)

    try:
        ts = large_image.getTileSource(filepath)

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

        return Response(content=image_binary, media_type=mime_type)

    except Exception as e:
        print(f"THUMBNAIL ERROR for {filename} frame={frame}: {e}")
        return Response(content=EMPTY_TILE, media_type="image/png")


@app.get("/slide/{filename}/tiles/{z}/{x}/{y}")
def get_tile(
    filename: str,
    z: int,
    x: int,
    y: int,
    frame: int = Query(default=0),
    color: str | None = Query(default=None),
):
    filepath = get_slide_path(filename)
    slide_type = detect_slide_type(filename)

    try:
        ts = large_image.getTileSource(filepath)
        result = ts.getTile(x, y, z, frame=frame, encoding="JPEG")

        tile_binary, mime_type = unpack_image_result(result)

        if slide_type == "ome-tiff" and color:
            tile_binary = tint_grayscale_tile(tile_binary, color=color)
            mime_type = "image/png"

        return Response(content=tile_binary, media_type=mime_type)

    except Exception as e:
        print(f"TILE ERROR for {filename} z={z} x={x} y={y} frame={frame}: {e}")
        return Response(content=EMPTY_TILE, media_type="image/png")