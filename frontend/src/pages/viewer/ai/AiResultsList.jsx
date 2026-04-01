import React, { useState } from "react";

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatRoi(roi) {
  if (!roi) return "-";
  return `${Math.round(roi.x)}, ${Math.round(roi.y)} • ${Math.round(
    roi.width
  )}×${Math.round(roi.height)}`;
}

function formatMetricNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function inferFeatureType(feature, layer) {
  const props = feature?.properties || {};
  if (props.type) return props.type;

  const branch = String(layer?.branch || "").toLowerCase();
  if (branch.includes("nuclei")) return "nuclei";
  if (branch.includes("cell")) return "cell";

  const name = String(layer?.name || "").toLowerCase();
  if (name.includes("nuclei")) return "nuclei";
  if (name.includes("cell")) return "cell";

  return "";
}

function computeCentroidFromPolygon(coords) {
  try {
    const pts = coords?.[0] || [];
    if (!pts.length) return ["", ""];

    let x = 0;
    let y = 0;

    pts.forEach(([px, py]) => {
      x += px;
      y += py;
    });

    return [x / pts.length, y / pts.length];
  } catch {
    return ["", ""];
  }
}

function extractFeatureCentroid(feature) {
  const props = feature?.properties || {};
  const geom = feature?.geometry || {};
  const c = props.centroid;

  if (Array.isArray(c) && c.length >= 2) {
    return [c[0], c[1]];
  }

  if (c && typeof c === "object" && c.x !== undefined && c.y !== undefined) {
    return [c.x, c.y];
  }

  if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
    return [geom.coordinates[0] ?? "", geom.coordinates[1] ?? ""];
  }

  if (geom.type === "Polygon") {
    return computeCentroidFromPolygon(geom.coordinates);
  }

  return ["", ""];
}

function buildExportRows(item) {
  const layers = item.layers || [];

  return layers.flatMap((layer) => {
    const features = layer.feature_collection?.features || [];

    return features.map((feature, index) => {
      const props = feature?.properties || {};
      const [x, y] = extractFeatureCentroid(feature);

      return {
        id: props.id || `${layer.branch || "layer"}_${index}`,
        type: inferFeatureType(feature, layer),
        x,
        y,
        area: props.area ?? "",
        confidence: props.confidence ?? "",
        feature,
      };
    });
  });
}

function exportResult(item, format = "geojson") {
  const rows = buildExportRows(item);
  const features = rows.map((row) => row.feature);

  if (format === "geojson") {
    const geojson = {
      type: "FeatureCollection",
      features,
    };

    downloadFile(
      `roi_${item.id}.geojson`,
      JSON.stringify(geojson, null, 2),
      "application/geo+json"
    );
    return;
  }

  if (format === "json") {
    downloadFile(
      `roi_${item.id}.json`,
      JSON.stringify(
        {
          roi: item.roi || null,
          features,
          table: rows.map(({ feature, ...rest }) => rest),
        },
        null,
        2
      ),
      "application/json"
    );
    return;
  }

  if (format === "csv") {
    const header = "id,type,x,y,area,confidence\n";
    const body = rows
      .map((row) =>
        [
          row.id,
          row.type,
          row.x,
          row.y,
          row.area,
          row.confidence,
        ].join(",")
      )
      .join("\n");

    downloadFile(`roi_${item.id}.csv`, header + body, "text/csv");
  }
}

async function exportRoiImage(item) {
  if (!item?.id) {
    window.alert("ROI image export is not available.");
    return;
  }

  try {
    const response = await fetch(`/api/exports/${item.id}?format=png`, {
      method: "GET",
    });

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const contentDisposition = response.headers.get("content-disposition") || "";

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const first8 = Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    console.log("ROI export status:", response.status);
    console.log("ROI export content-type:", contentType);
    console.log("ROI export content-disposition:", contentDisposition);
    console.log("ROI export first bytes:", first8);

    if (!response.ok) {
      const text = new TextDecoder().decode(bytes);
      throw new Error(text || "Could not export ROI image.");
    }

    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    const isTiff =
      bytes.length >= 4 &&
      (
        (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
        (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
      );

    if (!isPng && !isTiff) {
      const textPreview = new TextDecoder().decode(bytes.slice(0, 200));
      throw new Error(
        `Export did not return a valid PNG/TIFF. content-type=${contentType || "unknown"}, first-bytes=${first8}, preview=${textPreview}`
      );
    }

    let extension = "png";
    let mimeType = "image/png";

    if (isTiff || contentType.includes("image/tiff") || contentType.includes("image/tif")) {
      extension = "tiff";
      mimeType = "image/tiff";
    }

    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `roi_${item.id}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(error?.message || "Could not export ROI image.");
  }
}

function ResultStyleEditor({ item, onUpdateLayerStyle }) {
  const nucleiLayer = item.layers.find((layer) => String(layer.branch).includes("nuclei"));
  const cellLayer = item.layers.find((layer) => String(layer.branch).includes("cell"));

  const fillOpacity =
    nucleiLayer?.display?.fillOpacity ??
    cellLayer?.display?.fillOpacity ??
    0.18;

  const strokeWidth =
    nucleiLayer?.display?.strokeWidth ??
    cellLayer?.display?.strokeWidth ??
    1.5;

  return (
    <div className="viewer-ai-result-card__style">
      <div className="viewer-ai-result-card__style-grid">
        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Nuclei boundary</span>
          <input
            type="color"
            value={nucleiLayer?.display?.strokeColor || "#60a5fa"}
            onChange={(e) =>
              onUpdateLayerStyle(item.id, "nuclei", { strokeColor: e.target.value })
            }
          />
        </label>

        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Cell boundary</span>
          <input
            type="color"
            value={cellLayer?.display?.strokeColor || "#22c55e"}
            onChange={(e) =>
              onUpdateLayerStyle(item.id, "cell", { strokeColor: e.target.value })
            }
          />
        </label>

        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Nuclei fill</span>
          <input
            type="color"
            value={nucleiLayer?.display?.fillColor || "#60a5fa"}
            onChange={(e) =>
              onUpdateLayerStyle(item.id, "nuclei", { fillColor: e.target.value })
            }
          />
        </label>

        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Cell fill</span>
          <input
            type="color"
            value={cellLayer?.display?.fillColor || "#22c55e"}
            onChange={(e) =>
              onUpdateLayerStyle(item.id, "cell", { fillColor: e.target.value })
            }
          />
        </label>
      </div>

      <div className="viewer-ai-result-card__style-grid">
        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Fill opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={fillOpacity}
            onChange={(e) => {
              const value = Number(e.target.value);
              onUpdateLayerStyle(item.id, "nuclei", { fillOpacity: value });
              onUpdateLayerStyle(item.id, "cell", { fillOpacity: value });
            }}
          />
        </label>

        <label className="viewer-ai-panel__field">
          <span className="viewer-ai-panel__label">Boundary width</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => {
              const value = Number(e.target.value);
              onUpdateLayerStyle(item.id, "nuclei", { strokeWidth: value });
              onUpdateLayerStyle(item.id, "cell", { strokeWidth: value });
            }}
          />
        </label>
      </div>
    </div>
  );
}

function AiResultsList({
  results,
  onApplyResult,
  onRemoveResult,
  onClearResults,
  onUpdateResultDisplay,
  onUpdateResultLayerStyle,
}) {
  const [expandedStyleId, setExpandedStyleId] = useState(null);

  return (
    <div className="viewer-ai-results">
      <div className="viewer-ai-results__header">
        <div>
          <h4 className="viewer-ai-results__title">Results</h4>
          <p className="viewer-ai-results__subtitle">
            Previous runs for this slide
          </p>
        </div>

        <button
          type="button"
          className="viewer-btn-ghost"
          onClick={onClearResults}
          disabled={!results.length}
        >
          Clear list
        </button>
      </div>

      {!results.length ? (
        <div className="viewer-ai-results__empty">
          No AI runs yet. Select a rectangle ROI and run inference.
        </div>
      ) : (
        <div className="viewer-ai-results__list">
          {results.map((item) => {
            const metrics = item.metrics || {};
            const isStyleOpen = expandedStyleId === item.id;

            return (
              <div
                key={item.id}
                className={`viewer-ai-result-card viewer-ai-result-card--${item.status}`}
              >
                <div className="viewer-ai-result-card__top">
                  <div>
                    <div className="viewer-ai-result-card__title">
                      {item.modelLabel} · {String(item.mode).toUpperCase()}
                    </div>
                    <div className="viewer-ai-result-card__meta">
                      {formatTimestamp(item.createdAt)}
                    </div>
                  </div>

                  <span className="viewer-badge viewer-badge--sm">
                    {item.status === "success"
                      ? `${item.layerCount} layer${item.layerCount === 1 ? "" : "s"}`
                      : "Failed"}
                  </span>
                </div>

                <div className="viewer-ai-result-card__details">
                  <div>
                    <strong>ROI:</strong> {formatRoi(item.roi)}
                  </div>

                  {item.status === "success" ? (
                    <div className="viewer-ai-metrics-row">
                      <span className="viewer-badge viewer-badge--sm">
                        Nuclei {metrics.nuclei_count ?? 0}
                      </span>
                      <span className="viewer-badge viewer-badge--sm">
                        Cells {metrics.cell_count ?? 0}
                      </span>
                      <span className="viewer-badge viewer-badge--sm">
                        Ratio {formatMetricNumber(metrics.nuclei_to_cell_count_ratio, 2)}
                      </span>
                      <span className="viewer-badge viewer-badge--sm">
                        Area % {formatMetricNumber(metrics.nuclei_area_percent_of_cell_area, 1)}
                      </span>
                    </div>
                  ) : null}

                  {item.error ? (
                    <div>
                      <strong>Error:</strong> {item.error}
                    </div>
                  ) : null}
                </div>

                {item.status === "success" ? (
                  <div className="viewer-ai-result-card__toggles">
                    <button
                      type="button"
                      className="viewer-btn-ghost"
                      onClick={() =>
                        onUpdateResultDisplay(item.id, {
                          showNuclei: !item.display?.showNuclei,
                        })
                      }
                    >
                      {item.display?.showNuclei ? "Hide nuclei" : "Show nuclei"}
                    </button>

                    <button
                      type="button"
                      className="viewer-btn-ghost"
                      onClick={() =>
                        onUpdateResultDisplay(item.id, {
                          showCells: !item.display?.showCells,
                        })
                      }
                    >
                      {item.display?.showCells ? "Hide cells" : "Show cells"}
                    </button>

                    <button
                      type="button"
                      className="viewer-btn-ghost"
                      onClick={() =>
                        onUpdateResultDisplay(item.id, {
                          showFill: !item.display?.showFill,
                        })
                      }
                    >
                      {item.display?.showFill ? "Hide fill" : "Show fill"}
                    </button>

                    <button
                      type="button"
                      className="viewer-btn-ghost"
                      onClick={() =>
                        setExpandedStyleId((prev) => (prev === item.id ? null : item.id))
                      }
                    >
                      {isStyleOpen ? "Hide style" : "Style"}
                    </button>
                  </div>
                ) : null}

                {isStyleOpen && item.status === "success" ? (
                  <ResultStyleEditor
                    item={item}
                    onUpdateLayerStyle={onUpdateResultLayerStyle}
                  />
                ) : null}

                <div className="viewer-ai-result-card__actions">
                  <button
                    type="button"
                    className="viewer-btn-secondary"
                    onClick={() => onApplyResult(item)}
                    disabled={item.status !== "success"}
                  >
                    Show overlay
                  </button>

                  <select
                    className="viewer-btn-ghost"
                    defaultValue=""
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        exportResult(item, value);
                        e.target.value = "";
                      }
                    }}
                    disabled={item.status !== "success"}
                  >
                    <option value="">Export data</option>
                    <option value="geojson">GeoJSON</option>
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>

                  <button
                    type="button"
                    className="viewer-btn-ghost"
                    onClick={() => exportRoiImage(item)}
                    disabled={item.status !== "success"}
                  >
                    Export ROI image
                  </button>

                  <button
                    type="button"
                    className="viewer-btn-ghost"
                    onClick={() => onRemoveResult(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AiResultsList;