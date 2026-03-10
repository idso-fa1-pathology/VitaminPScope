from pathlib import Path
from typing import Dict, Any, Optional

import torch

from core.config import CHECKPOINT_DIR

# import VitaminP package classes directly
from vitaminp.models import VitaminPDual, VitaminPFlex, VitaminPSyn
from vitaminp.inference import WSIPredictor, ChannelConfig


MODEL_CONFIG = {
    "dual": {
        "class": VitaminPDual,
        "size": "base",
        "default_checkpoint": "vitamin_p_dual.pth",
    },
    "syn": {
        "class": VitaminPSyn,
        "size": "base",
        "default_checkpoint": "vitamin_p_dual.pth",
    },
    "flex": {
        "class": VitaminPFlex,
        "size": "large",
        "default_checkpoint": "vitamin_p_flex.pth",
    },
}


class VitaminPAdapter:
    def __init__(self):
        self._loaded_models: Dict[str, torch.nn.Module] = {}

    def _normalize_device(self, device: Optional[str]) -> str:
        if device in (None, "", "auto"):
            return "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda" and not torch.cuda.is_available():
            return "cpu"
        return device

    def _resolve_checkpoint_path(
        self,
        model_name: str,
        checkpoint_name: Optional[str] = None,
    ) -> Path:
        if model_name not in MODEL_CONFIG:
            raise ValueError(
                f"Unsupported model_name '{model_name}'. "
                f"Use one of: {list(MODEL_CONFIG.keys())}"
            )

        filename = checkpoint_name or MODEL_CONFIG[model_name]["default_checkpoint"]
        checkpoint_path = CHECKPOINT_DIR / filename

        if not checkpoint_path.exists():
            raise FileNotFoundError(
                f"Checkpoint not found: {checkpoint_path}. "
                f"Put the weight file inside ai_service/checkpoints/."
            )

        return checkpoint_path

    def _build_model(
        self,
        model_name: str,
        device: str,
        checkpoint_name: Optional[str] = None,
    ):
        device = self._normalize_device(device)

        config = MODEL_CONFIG[model_name]
        checkpoint_path = self._resolve_checkpoint_path(model_name, checkpoint_name)

        model_class = config["class"]
        model_size = config["size"]

        model = model_class(model_size=model_size).to(device)

        state_dict = torch.load(checkpoint_path, map_location=device)

        if isinstance(state_dict, dict) and "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        elif isinstance(state_dict, dict) and "model_state_dict" in state_dict:
            state_dict = state_dict["model_state_dict"]

        model.load_state_dict(state_dict)
        model.eval()

        return model

    def get_model(
        self,
        model_name: str = "flex",
        device: str = "cpu",
        checkpoint_name: Optional[str] = None,
    ):
        device = self._normalize_device(device)

        key = f"{model_name}:{device}:{checkpoint_name or 'default'}"

        if key not in self._loaded_models:
            self._loaded_models[key] = self._build_model(
                model_name=model_name,
                device=device,
                checkpoint_name=checkpoint_name,
            )

        return self._loaded_models[key]

    def _build_mif_channel_config(
        self,
        mif_channel_config: Optional[dict] = None,
    ) -> Optional[ChannelConfig]:
        if not mif_channel_config:
            return None

        channel_names = mif_channel_config.get("channel_names")
        if isinstance(channel_names, dict):
            normalized_channel_names = {}
            for key, value in channel_names.items():
                try:
                    normalized_channel_names[int(key)] = value
                except Exception:
                    normalized_channel_names[key] = value
            channel_names = normalized_channel_names

        return ChannelConfig(
            nuclear_channel=mif_channel_config["nuclear_channel"],
            membrane_channel=mif_channel_config["membrane_channel"],
            membrane_combination=mif_channel_config.get("membrane_combination", "max"),
            channel_names=channel_names,
        )

    def run_wsi_inference(
        self,
        *,
        wsi_path: str,
        output_dir: str,
        model_name: str = "flex",
        checkpoint_name: Optional[str] = None,
        device: str = "cpu",
        branches=None,
        patch_size: int = 512,
        overlap: int = 64,
        target_mpp: float = 0.2125,
        magnification: int = 40,
        batch_size: int = 4,
        filter_tissue: bool = True,
        tissue_threshold: float = 0.10,
        clean_overlaps: bool = True,
        save_geojson: bool = True,
        save_json: bool = False,
        save_visualization: bool = True,
        min_area_um: float = 10.0,
        detection_threshold: float = 0.5,
        mpp_override: Optional[float] = None,
        mif_channel_config: Optional[dict] = None,
    ) -> Dict[str, Any]:

        device = self._normalize_device(device)

        if branches is None:
            branches = ["he_nuclei", "he_cell"]

        model = self.get_model(
            model_name=model_name,
            device=device,
            checkpoint_name=checkpoint_name,
        )

        predictor_mif_config = self._build_mif_channel_config(mif_channel_config)

        predictor = WSIPredictor(
            model=model,
            device=device,
            patch_size=patch_size,
            overlap=overlap,
            target_mpp=target_mpp,
            magnification=magnification,
            batch_size=batch_size,
            tissue_dilation=1,
            mif_channel_config=predictor_mif_config,
        )

        results = predictor.predict(
            wsi_path=wsi_path,
            output_dir=output_dir,
            branches=branches,
            filter_tissue=filter_tissue,
            tissue_threshold=tissue_threshold,
            clean_overlaps=clean_overlaps,
            save_geojson=save_geojson,
            save_json=save_json,
            save_visualization=save_visualization,
            detection_threshold=detection_threshold,
            min_area_um=min_area_um,
            mpp_override=mpp_override,
        )

        return results