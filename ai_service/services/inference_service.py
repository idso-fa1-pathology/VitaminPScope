import json
from pathlib import Path

from core.config import OUTPUT_DIR
from services.vitaminp_adapter import VitaminPAdapter

adapter = VitaminPAdapter()


def _candidate_geojson_paths(output_dir: str, branch_name: str):
    output_path = Path(output_dir)

    object_type = "nuclei" if "nuclei" in branch_name else "cell"

    return [
        # Prefer full segmentation boundaries first
        output_path / f"{branch_name}_segmentation.geojson",
        output_path / f"{object_type}_segmentation.geojson",

        # Fallback to detections if segmentation file is unavailable
        output_path / f"{branch_name}_detections.geojson",
        output_path / f"{branch_name}.geojson",
        output_path / f"{object_type}_detections.geojson",
        output_path / f"{object_type}.geojson",
    ]


def _as_feature_collection(data) -> dict:
    if isinstance(data, dict):
        if data.get("type") == "FeatureCollection" and isinstance(data.get("features"), list):
            return data

        if isinstance(data.get("features"), list):
            return {
                "type": "FeatureCollection",
                "features": data["features"],
            }

        for key in ("detections", "objects", "items", "data"):
            if isinstance(data.get(key), list):
                return {
                    "type": "FeatureCollection",
                    "features": data[key],
                }

    if isinstance(data, list):
        return {
            "type": "FeatureCollection",
            "features": data,
        }

    return {"type": "FeatureCollection", "features": []}


def _load_feature_collection(output_dir: str, branch_name: str) -> dict:
    for candidate in _candidate_geojson_paths(output_dir, branch_name):
        if candidate.exists():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    data = json.load(f)

                fc = _as_feature_collection(data)
                print(
                    f"[inference_service] Loaded {candidate.name} for {branch_name} "
                    f"with {len(fc.get('features', []))} features"
                )
                return fc

            except Exception as exc:
                print(f"[inference_service] Failed reading {candidate}: {exc}")
                return {"type": "FeatureCollection", "features": []}

    print(f"[inference_service] No GeoJSON found for branch {branch_name} in {output_dir}")
    return {"type": "FeatureCollection", "features": []}


def run_inference_job(payload):
    slide_name = Path(payload.wsi_path).stem
    output_dir = payload.output_dir or str(OUTPUT_DIR / slide_name)

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    results = adapter.run_wsi_inference(
        wsi_path=payload.wsi_path,
        output_dir=output_dir,
        model_name=payload.model_name,
        checkpoint_name=payload.checkpoint_name,
        device=payload.device,
        branches=payload.branches,
        patch_size=payload.patch_size,
        overlap=payload.overlap,
        target_mpp=payload.target_mpp,
        magnification=payload.magnification,
        batch_size=payload.batch_size,
        filter_tissue=payload.filter_tissue,
        tissue_threshold=payload.tissue_threshold,
        clean_overlaps=payload.clean_overlaps,
        save_geojson=payload.save_geojson,
        save_json=payload.save_json,
        save_visualization=payload.save_visualization,
        min_area_um=payload.min_area_um,
        detection_threshold=payload.detection_threshold,
        mpp_override=payload.mpp_override,
        mif_channel_config=payload.mif_channel_config,
    )

    output_files = {}
    raw_results = {}

    for branch_name, branch_result in results.items():
        branch_output_dir = branch_result.get("output_dir", output_dir)
        feature_collection = _load_feature_collection(branch_output_dir, branch_name)

        output_files[branch_name] = {
            "output_dir": branch_output_dir,
            "num_detections": branch_result.get("num_detections", 0),
        }

        raw_results[branch_name] = {
            "feature_collection": feature_collection,
            "num_detections": branch_result.get("num_detections", 0),
        }

    return {
        "status": "completed",
        "message": "Inference finished successfully",
        "outputs": {
            "output_dir": output_dir,
            "branches": output_files,
        },
        "raw_results": raw_results,
        "stats": {
            "requested_branches": payload.branches,
        },
    }