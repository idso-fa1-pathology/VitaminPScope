import React from "react";

function AiToolbarButton({
  isOpen,
  hasSelectedRoi,
  isRunning,
  hasResults,
  onClick,
}) {
  const className = [
    "viewer-ai-toolbar-button",
    isOpen ? "viewer-ai-toolbar-button--open" : "",
    isRunning ? "viewer-ai-toolbar-button--busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let badge = "AI";
  if (isRunning) badge = "…";
  else if (hasSelectedRoi) badge = "ROI";
  else if (hasResults) badge = "✓";

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={isOpen ? "Close AI panel" : "Open AI panel"}
      aria-pressed={isOpen}
    >
      <span className="viewer-ai-toolbar-button__icon">🤖</span>
      <span className="viewer-ai-toolbar-button__label">AI</span>
      <span className="viewer-ai-toolbar-button__badge">{badge}</span>
    </button>
  );
}

export default AiToolbarButton;