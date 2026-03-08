from typing import List, Optional, Dict, Union, Any
from pydantic import BaseModel, Field


class InferenceRequest(BaseModel):
    wsi_path: str = Field(..., description="Path to the slide or patch image")
    output_dir: Optional[str] = Field(default=None, description="Optional output directory override")

    model_name: str = Field(default="flex", description="flex | dual | syn")
    checkpoint_name: Optional[str] = Field(default=None, description="Optional checkpoint file name")

    device: str = Field(default="cpu", description="cpu or cuda")

    # Branches to run
    branches: List[str] = Field(
        default_factory=lambda: ["he_nuclei", "he_cell"],
        description="Segmentation branches (he_nuclei, he_cell, mif_nuclei, mif_cell)"
    )

    # Tiling parameters
    patch_size: int = 512
    overlap: int = 64
    target_mpp: float = 0.425
    magnification: int = 20
    batch_size: int = 4

    # Tissue filtering
    filter_tissue: bool = True
    tissue_threshold: float = 0.10

    # Post-processing
    clean_overlaps: bool = True
    min_area_um: float = 10.0
    detection_threshold: float = 0.5

    # Output options
    save_geojson: bool = True
    save_json: bool = False
    save_visualization: bool = True

    # Resolution override (useful for patches without metadata)
    mpp_override: Optional[float] = None

    # -------------------------
    # MIF channel configuration
    # -------------------------
    mif_channel_config: Optional[Dict[str, Union[int, List[int], str, Dict[int, str]]]] = Field(
        default=None,
        description="Configuration for MIF input channels"
    )


class InferenceResponse(BaseModel):
    status: str
    message: str
    outputs: dict
    raw_results: Dict[str, Any] = Field(default_factory=dict)
    stats: dict