import os
import base64
import large_image
from fastapi import FastAPI, Response, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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
        "slides": [
            {"name": f, "type": detect_slide_type(f)}
            for f in sorted(files)
        ]
    }


@app.get("/slide/{filename}/metadata")
def get_metadata(filename: str):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")

    try:
        ts = large_image.getTileSource(filepath)
        metadata = ts.getMetadata()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not open slide: {str(e)}")

    slide_type = detect_slide_type(filename)
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

    return {
        "name": filename,
        "type": slide_type,
        "metadata": metadata,
        "channels": channels,
    }


@app.get("/slide/{filename}/tiles/{z}/{x}/{y}")
def get_tile(
    filename: str,
    z: int,
    x: int,
    y: int,
    frame: int = Query(default=0),
    color: str | None = Query(default=None),
):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")

    slide_type = detect_slide_type(filename)

    try:
        ts = large_image.getTileSource(filepath)
        result = ts.getTile(x, y, z, frame=frame, encoding="JPEG")

        if isinstance(result, tuple):
            tile_binary = result[0]
            mime_type = result[1] if len(result) > 1 else "image/jpeg"
        else:
            tile_binary = result
            mime_type = "image/jpeg"

        # For OME-TIFF, optionally tint grayscale tiles for channel overlays
        if slide_type == "ome-tiff" and color:
            tile_binary = tint_grayscale_tile(tile_binary, color=color)
            mime_type = "image/jpeg"

        return Response(content=tile_binary, media_type=mime_type)

    except Exception as e:
        print(f"TILE ERROR for {filename} z={z} x={x} y={y} frame={frame}: {e}")
        return Response(content=EMPTY_TILE, media_type="image/png")