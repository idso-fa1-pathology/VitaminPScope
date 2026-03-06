import os
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

# This maps to the mounted volume in docker-compose.yml
DATA_DIR = "/data/sample_slides"

@app.get("/")
def read_root():
    return {"status": "WSI Server Running"}

@app.get("/slides")
def list_slides():
    """Returns a list of all slides in the data directory."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        return {"slides": []}
    
    # Filter for common pathology formats
    files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith(('.svs', '.tif', '.tiff', '.ndpi'))]
    return {"slides": files}

@app.get("/slide/{filename}/metadata")
def get_metadata(filename: str):
    """Gets the dimensions and zoom levels of the slide."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")
    
    ts = large_image.getTileSource(filepath)
    return ts.getMetadata()

@app.get("/slide/{filename}/tiles/{z}/{x}/{y}")
def get_tile(filename: str, z: int, x: int, y: int):
    """Returns a specific image tile for OpenSeadragon."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Slide not found")
    
    ts = large_image.getTileSource(filepath)
    try:
        # Get the tile from large_image
        tile_binary, mime_type = ts.getTile(x, y, z)
        return Response(content=tile_binary, media_type=mime_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))