import traceback

from fastapi import APIRouter, HTTPException

from models.schemas import InferenceRequest, InferenceResponse
from services.inference_service import run_inference_job

router = APIRouter()


@router.post("/predict/vitamin-p", response_model=InferenceResponse)
def run_vitaminp_inference(payload: InferenceRequest):
    try:
        result = run_inference_job(payload)
        return InferenceResponse(**result)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))