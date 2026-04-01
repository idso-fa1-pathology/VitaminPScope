from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Optional
from uuid import uuid4

from models.schemas import InferenceJobResponse, InferenceRequest


# ✅ Job status definitions (simple, explicit)
class JobStatus:
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class _JobRecord:
    job_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    request: InferenceRequest

    # ✅ Structured outputs for downstream export + analysis
    outputs: dict = field(default_factory=lambda: {
        "instances": [],        # list of polygons / detections
        "tiles_processed": 0,   # progress tracking
        "metadata": {}          # optional global info
    })

    error: Optional[str] = None
    log_path: Optional[str] = None


class InMemoryJobStore:
    def __init__(self) -> None:
        self._jobs: Dict[str, _JobRecord] = {}
        self._lock = Lock()

    def create(self, request: InferenceRequest) -> str:
        with self._lock:
            job_id = str(uuid4())
            now = datetime.now(timezone.utc)
            self._jobs[job_id] = _JobRecord(
                job_id=job_id,
                status=JobStatus.QUEUED,
                created_at=now,
                updated_at=now,
                request=request,
            )
            return job_id

    def get(self, job_id: str) -> Optional[InferenceJobResponse]:
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                return None
            return InferenceJobResponse(**record.__dict__)

    def update(self, job_id: str, **kwargs) -> Optional[InferenceJobResponse]:
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                return None
            for key, value in kwargs.items():
                setattr(record, key, value)
            record.updated_at = datetime.now(timezone.utc)
            return InferenceJobResponse(**record.__dict__)

    # ✅ Lifecycle helpers (clean API)
    def set_running(self, job_id: str):
        return self.update(job_id, status=JobStatus.RUNNING)

    def set_completed(self, job_id: str, outputs: dict):
        return self.update(job_id, status=JobStatus.COMPLETED, outputs=outputs)

    def set_failed(self, job_id: str, error: str):
        return self.update(job_id, status=JobStatus.FAILED, error=error)

    # ✅ Streaming tile accumulation (important for WSI)
    def append_outputs(self, job_id: str, instances: list, tile_count: int = 1):
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                return None

            record.outputs["instances"].extend(instances)
            record.outputs["tiles_processed"] += tile_count
            record.updated_at = datetime.now(timezone.utc)

            return InferenceJobResponse(**record.__dict__)


# ✅ Singleton (already used in your system)
job_store = InMemoryJobStore()