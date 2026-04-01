from fastapi import APIRouter, HTTPException

from services.morphometrics_service import analyze_job

router = APIRouter(tags=["analysis"])


@router.get("/analysis/{job_id}")
def get_analysis(job_id: str):
    try:
        return analyze_job(job_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))