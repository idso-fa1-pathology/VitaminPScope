from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class RoiBox(BaseModel):
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)


class RoiSegmentationRequest(BaseModel):
    # ROI region selected in the viewer
    roi: RoiBox

    # Mode determines default branches
    mode: Literal["he", "mif"] = "he"

    # Model configuration
    model_name: str = "flex"
    checkpoint_name: Optional[str] = None
    device: str = "cpu"

    # Branches to run
    branches: List[str] = Field(
        default_factory=lambda: ["he_nuclei", "he_cell"]
    )

    # Optional resolution parameters; backend can auto-detect from metadata
    target_mpp: Optional[float] = None
    magnification: Optional[int] = None
    mpp_override: Optional[float] = None

    # Tiling parameters
    patch_size: int = 512
    overlap: int = 64
    batch_size: int = 1

    # Tissue filtering
    filter_tissue: bool = False
    tissue_threshold: float = 0.10

    # Post-processing
    clean_overlaps: bool = True
    min_area_um: float = 10.0
    detection_threshold: float = 0.5

    # Output options
    save_geojson: bool = True
    save_json: bool = False
    save_visualization: bool = True

    # MIF configuration
    mif_channel_config: Optional[Dict[str, Any]] = None


class AiLayerFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[Dict[str, Any]] = Field(default_factory=list)


class RoiSegmentationLayer(BaseModel):
    id: str
    name: str
    branch: str
    color: str
    feature_collection: AiLayerFeatureCollection
    stats: Dict[str, Any] = Field(default_factory=dict)


class RoiSegmentationResponse(BaseModel):
    status: str
    message: str
    slide_path: str
    roi: RoiBox
    layers: List[RoiSegmentationLayer] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)