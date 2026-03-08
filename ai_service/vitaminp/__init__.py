"""
Vitamin-P: DINOv2 U-Net models for H&E + MIF Pathology Images
Inference-focused exports for deployment service.
"""

# Models
from .models import (
    VitaminPDual,
    VitaminPSyn,
    VitaminPFlex,
    VitaminPBaselineHE,
    VitaminPBaselineMIF,
)

# Losses (sometimes used in model construction)
from .losses import DiceFocalLoss, HVLoss, MSGELossMaps

# Backbone + blocks
from .backbone import DINOv2Backbone
from .blocks import ConvBlock

# Utils / preprocessing
from .utils import (
    SimplePreprocessing,
    compute_dice,
    prepare_he_input,
    prepare_mif_input,
)

# Pretrained loader
from .pretrained import load_model, available_models, MODEL_REGISTRY

__version__ = "0.2.0"

__all__ = [
    # Models
    "VitaminPDual",
    "VitaminPSyn",
    "VitaminPFlex",
    "VitaminPBaselineHE",
    "VitaminPBaselineMIF",

    # Losses
    "DiceFocalLoss",
    "HVLoss",
    "MSGELossMaps",

    # Backbone / blocks
    "DINOv2Backbone",
    "ConvBlock",

    # Utils
    "SimplePreprocessing",
    "compute_dice",
    "prepare_he_input",
    "prepare_mif_input",

    # Pretrained loader
    "load_model",
    "available_models",
    "MODEL_REGISTRY",
]