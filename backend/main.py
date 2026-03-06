import os
import base64
import large_image
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
        if f.lower().endswith((".svs", ".tif", ".tiff", ".ndpi"))
    ]
    return {"slides": files}


@app.get("/slide/{filename}/metadata")
def get_metadata(filename: str):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")

    ts = large_image.getTileSource(filepath)
    return ts.getMetadata()


@app.get("/slide/{filename}/tiles/{z}/{x}/{y}")
def get_tile(filename: str, z: int, x: int, y: int):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")

    ts = large_image.getTileSource(filepath)

    try:
        result = ts.getTile(x, y, z, encoding="JPEG")

        # Handle different return shapes from large_image
        if isinstance(result, tuple):
            tile_binary = result[0]
            mime_type = result[1] if len(result) > 1 else "image/jpeg"
        else:
            tile_binary = result
            mime_type = "image/jpeg"

        return Response(content=tile_binary, media_type=mime_type)

    except Exception as e:
        print(f"TILE ERROR for {filename} z={z} x={x} y={y}: {e}")
        return Response(content=EMPTY_TILE, media_type="image/png")