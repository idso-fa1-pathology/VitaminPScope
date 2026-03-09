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

    elif geometry_type in ("MultiPoint", "LineString"):
        geometry["coordinates"] = [
            _shift_position(p, offset_x, offset_y) for p in coords
        ]

    elif geometry_type in ("Polygon", "MultiLineString"):
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


def _ring_area(ring: List[List[float]]) -> float:
    if not ring or len(ring) < 3:
        return 0.0

    area = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % len(ring)][0], ring[(i + 1) % len(ring)][1]
        area += (x1 * y2) - (x2 * y1)

    return abs(area) * 0.5


def _geometry_area(geometry: Dict[str, Any]) -> float:
    if not geometry:
        return 0.0

    geometry_type = geometry.get("type")
    coords = geometry.get("coordinates")

    if not coords:
        return 0.0

    if geometry_type == "Polygon":
        if not coords:
            return 0.0
        shell_area = _ring_area(coords[0]) if coords else 0.0
        hole_area = sum(_ring_area(ring) for ring in coords[1:]) if len(coords) > 1 else 0.0
        return max(0.0, shell_area - hole_area)

    if geometry_type == "MultiPolygon":
        total = 0.0
        for polygon in coords:
            if not polygon:
                continue
            shell_area = _ring_area(polygon[0]) if polygon else 0.0
            hole_area = sum(_ring_area(ring) for ring in polygon[1:]) if len(polygon) > 1 else 0.0
            total += max(0.0, shell_area - hole_area)
        return total

    return 0.0


def _summarize_feature_collection(feature_collection: Dict[str, Any]) -> Dict[str, Any]:
    features = feature_collection.get("features", []) if feature_collection else []

    polygon_count = 0
    point_count = 0
    total_area = 0.0

    for feature in features:
        geometry = feature.get("geometry") or {}
        geometry_type = geometry.get("type")

        if geometry_type in ("Polygon", "MultiPolygon"):
            polygon_count += 1
            total_area += _geometry_area(geometry)
        elif geometry_type == "Point":
            point_count += 1

    feature_count = len(features)
    mean_area = total_area / polygon_count if polygon_count > 0 else 0.0

    return {
        "feature_count": feature_count,
        "polygon_count": polygon_count,
        "point_count": point_count,
        "total_area": total_area,
        "mean_area": mean_area,
    }


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
    raise NotImplementedError("File-based ROI mapping is not used in the current direct-response ROI flow.")


def normalize_roi_result_to_layers(
    ai_result: Dict[str, Any],
    roi_x: float,
    roi_y: float,
) -> List[Dict[str, Any]]:
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

        geometry_stats = _summarize_feature_collection(mapped_fc)

        layers.append(
            {
                "id": f"ai-roi-{branch}",
                "name": branch.replace("_", " ").title(),
                "branch": branch,
                "color": BRANCH_COLORS.get(branch, "#ffffff"),
                "feature_collection": mapped_fc,
                "stats": {
                    "num_detections": branch_outputs.get(branch, {}).get("num_detections", 0),
                    **geometry_stats,
                },
            }
        )

    return layers


def build_result_metrics(layers: List[Dict[str, Any]]) -> Dict[str, Any]:
    def _find(branch_name: str) -> Dict[str, Any]:
        for layer in layers:
            if layer.get("branch") == branch_name:
                return layer
        return {}

    nuclei_layer = _find("he_nuclei") or _find("mif_nuclei")
    cell_layer = _find("he_cell") or _find("mif_cell")

    nuclei_stats = nuclei_layer.get("stats", {})
    cell_stats = cell_layer.get("stats", {})

    nuclei_count = nuclei_stats.get("polygon_count") or nuclei_stats.get("feature_count") or 0
    cell_count = cell_stats.get("polygon_count") or cell_stats.get("feature_count") or 0

    nuclei_area = float(nuclei_stats.get("total_area") or 0.0)
    cell_area = float(cell_stats.get("total_area") or 0.0)

    count_ratio = (nuclei_count / cell_count) if cell_count else 0.0
    area_percent = ((nuclei_area / cell_area) * 100.0) if cell_area > 0 else 0.0

    return {
        "nuclei_count": nuclei_count,
        "cell_count": cell_count,
        "nuclei_to_cell_count_ratio": count_ratio,
        "nuclei_area": nuclei_area,
        "cell_area": cell_area,
        "nuclei_area_percent_of_cell_area": area_percent,
    }