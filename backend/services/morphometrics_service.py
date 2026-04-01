import math
from typing import List, Dict, Any

from services.ai_client import get_job_results


# ---------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------
def _polygon_perimeter(coords):
    if not coords or len(coords) < 2:
        return 0.0

    perim = 0.0
    for i in range(len(coords)):
        x1, y1 = coords[i][0], coords[i][1]
        x2, y2 = coords[(i + 1) % len(coords)][0], coords[(i + 1) % len(coords)][1]
        perim += math.hypot(x2 - x1, y2 - y1)

    return perim


def _geometry_perimeter(geometry: Dict[str, Any]) -> float:
    if not geometry:
        return 0.0

    gtype = geometry.get("type")
    coords = geometry.get("coordinates")

    if gtype == "Polygon":
        return _polygon_perimeter(coords[0]) if coords else 0.0

    if gtype == "MultiPolygon":
        total = 0.0
        for poly in coords:
            if poly:
                total += _polygon_perimeter(poly[0])
        return total

    return 0.0


def _bounding_box(geometry):
    coords = geometry.get("coordinates")
    if not coords:
        return None

    xs, ys = [], []

    def extract(points):
        for p in points:
            xs.append(p[0])
            ys.append(p[1])

    if geometry["type"] == "Polygon":
        for ring in coords:
            extract(ring)

    elif geometry["type"] == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                extract(ring)

    if not xs:
        return None

    return {
        "min_x": min(xs),
        "min_y": min(ys),
        "max_x": max(xs),
        "max_y": max(ys),
    }


# ---------------------------------------------------------
# Main computation
# ---------------------------------------------------------
def compute_morphometrics(instances: List[Dict[str, Any]]):
    results = []

    for inst in instances:
        geom = inst.get("geometry") or {}
        area = inst.get("area") or 0.0
        perimeter = _geometry_perimeter(geom)

        circularity = (
            (4 * math.pi * area) / (perimeter ** 2)
            if perimeter > 0 else 0.0
        )

        results.append({
            "id": inst.get("id"),
            "type": inst.get("type"),
            "area": area,
            "perimeter": perimeter,
            "circularity": circularity,
            "centroid": inst.get("centroid"),
            "bbox": _bounding_box(geom),
        })

    return results


# ---------------------------------------------------------
# Summary stats
# ---------------------------------------------------------
def summarize_metrics(instances, metrics):
    areas = [m["area"] for m in metrics if m["area"] is not None]

    mean_area = sum(areas) / len(areas) if areas else 0.0
    median_area = sorted(areas)[len(areas)//2] if areas else 0.0

    nuclei = [i for i in instances if "nuclei" in i.get("type", "")]
    cells = [i for i in instances if "cell" in i.get("type", "")]

    ratio = len(nuclei) / len(cells) if cells else 0.0

    return {
        "total_instances": len(instances),
        "mean_area": mean_area,
        "median_area": median_area,
        "nuclei_to_cell_ratio": ratio,
    }


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------
def analyze_job(job_id: str):
    job = get_job_results(job_id)

    if job.get("status") != "completed":
        raise ValueError("Job not completed")

    instances = job.get("outputs", {}).get("instances", [])

    metrics = compute_morphometrics(instances)
    summary = summarize_metrics(instances, metrics)

    return {
        "summary": summary,
        "metrics": metrics,
    }