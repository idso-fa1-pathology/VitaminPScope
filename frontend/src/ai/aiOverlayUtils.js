export function getAiLayerStroke(layer) {
    return layer?.color || "#ffffff";
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