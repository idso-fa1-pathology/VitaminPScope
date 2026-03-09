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