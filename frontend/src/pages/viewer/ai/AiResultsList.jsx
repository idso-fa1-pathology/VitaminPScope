import React from "react";

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

function AiResultsList({
  results,
  onApplyResult,
  onRemoveResult,
  onClearResults,
}) {
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
          {results.map((item) => (
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
                {item.error ? (
                  <div>
                    <strong>Error:</strong> {item.error}
                  </div>
                ) : null}
              </div>

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
          ))}
        </div>
      )}
    </div>
  );
}

export default AiResultsList;