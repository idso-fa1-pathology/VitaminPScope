import traceback
from threading import Thread

from fastapi import APIRouter, HTTPException

from models.schemas import InferenceRequest, InferenceResponse
from services.inference_service import run_inference_job
from services.job_store import job_store, JobStatus

router = APIRouter()


def _serialize_request_metadata(request: InferenceRequest) -> dict:
    if request is None:
        return {}

    if hasattr(request, "model_dump"):
        data = request.model_dump()
    elif hasattr(request, "dict"):
        data = request.dict()
    else:
        data = dict(request)

    # Keep this broad for now so export can recover what it needs.
    # You can narrow it later once stable.
    return data


@router.post("/predict/vitamin-p", response_model=InferenceResponse)
def run_vitaminp_inference(payload: InferenceRequest):
    try:
        result = run_inference_job(payload, mode="roi")
        return InferenceResponse(**result)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


def _run_wsi_job(job_id: str, payload: InferenceRequest):
    try:
        job_store.set_running(job_id)
        result = run_inference_job(payload, mode="wsi")
        job_store.set_completed(job_id, outputs=result)
    except Exception as e:
        traceback.print_exc()
        job_store.set_failed(job_id, error=str(e))


@router.post("/jobs/start-wsi")
def start_wsi_job(payload: InferenceRequest):
    try:
        job_id = job_store.create(payload)

        thread = Thread(target=_run_wsi_job, args=(job_id, payload))
        thread.daemon = True
        thread.start()

        return {"job_id": job_id, "status": JobStatus.QUEUED}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/jobs/{job_id}/status")
def get_job_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "tiles_processed": job.outputs.get("tiles_processed", 0),
    }


@router.get("/jobs/{job_id}/results")
def get_job_results(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        return {
            "job_id": job.job_id,
            "status": job.status,
            "message": "Job not completed yet",
        }

    return {
        "job_id": job.job_id,
        "status": job.status,
        "outputs": job.outputs,
        "request_metadata": _serialize_request_metadata(job.request),
    }