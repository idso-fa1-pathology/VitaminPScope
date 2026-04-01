from typing import List, Optional, Dict, Union, Any
from datetime import datetime
from pydantic import BaseModel, Field
from core.config import DEFAULT_DEVICE


class InferenceRequest(BaseModel):
    wsi_path: str
    output_dir: Optional[str] = None

    model_name: str = "flex"
    checkpoint_name: Optional[str] = None

    device: str = DEFAULT_DEVICE

    branches: List[str] = Field(default_factory=lambda: ["he_nuclei", "he_cell"])

    patch_size: int = 512
    overlap: int = 64
    target_mpp: float = 0.425
    magnification: int = 20
    batch_size: int = 8

    filter_tissue: bool = True
    tissue_threshold: float = 0.10

    clean_overlaps: bool = True
    min_area_um: float = 10.0
    detection_threshold: float = 0.5

    save_geojson: bool = True
    save_json: bool = False
    save_visualization: bool = True

    mpp_override: Optional[float] = None

    mif_channel_config: Optional[
        Dict[str, Union[int, List[int], str, Dict[int, str]]]
    ] = None


class InferenceResponse(BaseModel):
    status: str
    message: str
    outputs: dict
    raw_results: Dict[str, Any] = {}
    stats: dict = {}


# 🔥 NEW — Job response
class InferenceJobResponse(BaseModel):
    job_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    request: InferenceRequest

    outputs: Dict[str, Any] = {}
    error: Optional[str] = None
    log_path: Optional[str] = None