from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Vitamin-P Inference Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "AI Service Online", "model": "Vitamin-P (Pending Load)"}

@app.post("/predict/vitamin-p")
def run_inference():
    # Later, this will accept an image array and return polygon coordinates
    return {"segmentation_masks": "coming soon"}