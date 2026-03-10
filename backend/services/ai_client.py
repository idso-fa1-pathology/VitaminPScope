import os
from typing import Any, Dict

import requests

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai_service:8001")


class AiServiceError(RuntimeError):
    pass


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