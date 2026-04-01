import os
from typing import Any, Dict

import requests

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai_service:8001")


class AiServiceError(RuntimeError):
    pass


# =========================================================
# ✅ EXISTING — ROI (unchanged)
# =========================================================
def run_roi_segmentation(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{AI_SERVICE_URL.rstrip('/')}/inference/predict/vitamin-p"

    try:
        response = requests.post(url, json=payload, timeout=1800)
    except requests.RequestException as exc:
        raise AiServiceError(f"Could not reach AI service: {exc}") from exc

    if not response.ok:
        detail = response.text
        raise AiServiceError(f"AI service failed ({response.status_code}): {detail}")

    return response.json()


# =========================================================
# 🔥 NEW — Start WSI job
# =========================================================
def start_wsi_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{AI_SERVICE_URL.rstrip('/')}/inference/jobs/start-wsi"

    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as exc:
        raise AiServiceError(f"Could not start WSI job: {exc}") from exc

    if not response.ok:
        raise AiServiceError(f"Failed to start WSI job: {response.text}")

    return response.json()


# =========================================================
# 🔥 NEW — Get job status
# =========================================================
def get_job_status(job_id: str) -> Dict[str, Any]:
    url = f"{AI_SERVICE_URL.rstrip('/')}/inference/jobs/{job_id}/status"

    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as exc:
        raise AiServiceError(f"Could not fetch job status: {exc}") from exc

    if not response.ok:
        raise AiServiceError(f"Failed to get job status: {response.text}")

    return response.json()


# =========================================================
# 🔥 NEW — Get job results
# =========================================================
def get_job_results(job_id: str) -> Dict[str, Any]:
    url = f"{AI_SERVICE_URL.rstrip('/')}/inference/jobs/{job_id}/results"

    try:
        response = requests.get(url, timeout=60)
    except requests.RequestException as exc:
        raise AiServiceError(f"Could not fetch job results: {exc}") from exc

    if not response.ok:
        raise AiServiceError(f"Failed to get job results: {response.text}")

    return response.json()