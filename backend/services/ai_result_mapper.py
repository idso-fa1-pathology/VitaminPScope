from copy import deepcopy
from typing import Any, Dict, List, Tuple


BRANCH_COLORS = {
    "he_nuclei": "#00e5ff",
    "he_cell": "#39ff88",
    "mif_nuclei": "#ffd166",
    "mif_cell": "#ff4d6d",
}


def _shift_position(position: List[float], offset_x: float, offset_y: float) -> List[float]:
    if len(position) < 2:
        return position
    return [position[0] + offset_x, position[1] + offset_y, *position[2:]]


def _shift_geometry(geometry: Dict[str, Any], offset_x: float, offset_y: float) -> Dict[str, Any]:
    geometry = deepcopy(geometry)
    geometry_type = geometry.get("type")
    coords = geometry.get("coordinates")

    if not coords:
        return geometry

    if geometry_type == "Point":
        geometry["coordinates"] = _shift_position(coords, offset_x, offset_y)

    elif geometry_type == "MultiPoint" or geometry_type == "LineString":
        geometry["coordinates"] = [
            _shift_position(p, offset_x, offset_y) for p in coords
        ]

    elif geometry_type == "Polygon" or geometry_type == "MultiLineString":
        geometry["coordinates"] = [
            [_shift_position(p, offset_x, offset_y) for p in ring]
            for ring in coords
        ]

    elif geometry_type == "MultiPolygon":
        geometry["coordinates"] = [
            [
                [_shift_position(p, offset_x, offset_y) for p in ring]
                for ring in polygon
            ]
            for polygon in coords
        ]

    return geometry


def map_feature_collection_to_slide_space(
    feature_collection: Dict[str, Any],
    offset_x: float,
    offset_y: float,
    branch: str,
) -> Dict[str, Any]:
    mapped = {
        "type": "FeatureCollection",
        "features": [],
    }

    for feature in feature_collection.get("features", []):
        next_feature = deepcopy(feature)
        if "geometry" in next_feature and next_feature["geometry"]:
            next_feature["geometry"] = _shift_geometry(
                next_feature["geometry"],
                offset_x=offset_x,
                offset_y=offset_y,
            )

        props = next_feature.setdefault("properties", {})
        props["branch"] = branch
        props["source"] = "ai_roi"

        mapped["features"].append(next_feature)

    return mapped


def build_branch_feature_collections_from_output_dir(
    output_dir: str,
    branches: List[str],
    offset_x: float,
    offset_y: float,
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Reads the AI service result files from the shared /app/outputs mount as seen by backend.
    We convert /app/outputs/... to the host-mounted backend path /app/../ai_service/outputs is not available
    inside container, so backend should read directly from the response output_dir only if shared volume exists.
    For ROI mode we avoid file reads from AI output and instead only return counts if files are inaccessible.

    This helper is kept for future shared volume setups.
    """
    raise NotImplementedError("File-based ROI mapping is not used in the current direct-response ROI flow.")


def normalize_roi_result_to_layers(
    ai_result: Dict[str, Any],
    roi_x: float,
    roi_y: float,
) -> List[Dict[str, Any]]:
    """
    Expects ai_result['raw_results'] to contain branch-wise feature collections if provided.
    Falls back to empty feature sets with stats only.
    """
    layers = []

    raw_results = ai_result.get("raw_results", {})
    branch_outputs = ai_result.get("outputs", {}).get("branches", {})

    all_branches = list(branch_outputs.keys()) or list(raw_results.keys())

    for branch in all_branches:
        raw_branch = raw_results.get(branch, {})
        feature_collection = raw_branch.get(
            "feature_collection",
            {"type": "FeatureCollection", "features": []},
        )

        mapped_fc = map_feature_collection_to_slide_space(
            feature_collection,
            offset_x=roi_x,
            offset_y=roi_y,
            branch=branch,
        )

        layers.append(
            {
                "id": f"ai-roi-{branch}",
                "name": branch.replace("_", " ").title(),
                "branch": branch,
                "color": BRANCH_COLORS.get(branch, "#ffffff"),
                "feature_collection": mapped_fc,
                "stats": {
                    "num_detections": branch_outputs.get(branch, {}).get("num_detections", 0),
                },
            }
        )

    return layers