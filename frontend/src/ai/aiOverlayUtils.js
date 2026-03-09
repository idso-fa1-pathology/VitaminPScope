export function getAiLayerStroke(layer) {
  return layer?.display?.strokeColor || layer?.color || "#ffffff";
}

export function getAiLayerFill(layer) {
  return layer?.display?.fillColor || layer?.color || "#ffffff";
}

export function getAiLayerStrokeWidth(layer) {
  return Number(layer?.display?.strokeWidth ?? 1.5);
}

export function getAiLayerStrokeOpacity(layer) {
  return Number(layer?.display?.strokeOpacity ?? layer?.opacity ?? 1);
}

export function getAiLayerFillOpacity(layer) {
  return Number(layer?.display?.fillOpacity ?? 0.18);
}

export function getLayerKind(layer) {
  const branch = String(layer?.branch || "").toLowerCase();
  if (branch.includes("nuclei")) return "nuclei";
  if (branch.includes("cell")) return "cell";
  return "other";
}

export function isFeatureCollection(value) {
  return value && value.type === "FeatureCollection" && Array.isArray(value.features);
}

export function geometryToSvgShapes(geometry, imageToScreen) {
  if (!geometry || !imageToScreen) return [];

  const { type, coordinates } = geometry;

  if (type === "Point") {
    const p = imageToScreen({ x: coordinates[0], y: coordinates[1] });
    return [{ kind: "point", cx: p.x, cy: p.y }];
  }

  if (type === "Polygon") {
    return coordinates.map((ring, idx) => ({
      kind: "polygon",
      key: `ring-${idx}`,
      points: ring
        .map(([x, y]) => {
          const p = imageToScreen({ x, y });
          return `${p.x},${p.y}`;
        })
        .join(" "),
    }));
  }

  if (type === "MultiPolygon") {
    return coordinates.flatMap((polygon, pIdx) =>
      polygon.map((ring, rIdx) => ({
        kind: "polygon",
        key: `poly-${pIdx}-ring-${rIdx}`,
        points: ring
          .map(([x, y]) => {
            const p = imageToScreen({ x, y });
            return `${p.x},${p.y}`;
          })
          .join(" "),
      }))
    );
  }

  if (type === "LineString") {
    return [
      {
        kind: "polyline",
        points: coordinates
          .map(([x, y]) => {
            const p = imageToScreen({ x, y });
            return `${p.x},${p.y}`;
          })
          .join(" "),
      },
    ];
  }

  return [];
}

export function branchDisplayName(branch) {
  return String(branch || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function buildDefaultLayerDisplay(layer) {
  const kind = getLayerKind(layer);
  const baseColor = layer?.color || (kind === "nuclei" ? "#60a5fa" : "#22c55e");

  return {
    visible: true,
    showStroke: true,
    showFill: false,
    strokeColor: baseColor,
    fillColor: baseColor,
    strokeWidth: 1.5,
    strokeOpacity: 1,
    fillOpacity: kind === "nuclei" ? 0.16 : 0.14,
    showHeatmap: false,
    heatmapOpacity: 0.45,
  };
}