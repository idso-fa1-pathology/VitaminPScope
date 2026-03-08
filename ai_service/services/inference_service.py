from pathlib import Path

from core.config import OUTPUT_DIR
from services.vitaminp_adapter import VitaminPAdapter

adapter = VitaminPAdapter()


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
    )

    output_files = {}
    for branch_name, branch_result in results.items():
        branch_output_dir = branch_result.get("output_dir", output_dir)
        output_files[branch_name] = {
            "output_dir": branch_output_dir,
            "num_detections": branch_result.get("num_detections", 0),
        }

    return {
        "status": "completed",
        "message": "Inference finished successfully",
        "outputs": {
            "output_dir": output_dir,
            "branches": output_files,
        },
        "stats": {
            "requested_branches": payload.branches,
        },
    }