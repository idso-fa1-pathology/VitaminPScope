import React from "react";
import AiResultsList from "./AiResultsList";

function AiPanel({
  isOpen,
  isMultichannel,
  channels,
  selectedRoiAnnotation,
  aiMode,
  onAiModeChange,
  selectedModelId,
  onSelectedModelIdChange,
  availableModels,
  nuclearChannel,
  onNuclearChannelChange,
  membraneChannels,
  onMembraneChannelsChange,
  membraneCombination,
  onMembraneCombinationChange,
  onResetDefaults,
  onRun,
  onClearOverlay,
  isRunningAi,
  aiError,
  results,
  onApplyResult,
  onRemoveResult,
  onClearResults,
  onUpdateResultDisplay,
  onUpdateResultLayerStyle,
}) {
  if (!isOpen) return null;

  const handleMembraneToggle = (value) => {
    const exists = membraneChannels.includes(value);
    if (exists) {
      onMembraneChannelsChange(membraneChannels.filter((item) => item !== value));
      return;
    }
    onMembraneChannelsChange([...membraneChannels, value]);
  };

  return (
    <div className="viewer-ai-panel" role="dialog" aria-label="AI inference panel">
      <div className="viewer-ai-panel__header">
        <div>
          <h3 className="viewer-ai-panel__title">AI inference</h3>
          <p className="viewer-ai-panel__subtitle">
            ROI-based inference with model and channel configuration
          </p>
        </div>
      </div>

      <div className="viewer-ai-panel__body">
        <section className="viewer-ai-panel__section">
          <label className="viewer-ai-panel__field">
            <span className="viewer-ai-panel__label">Model</span>
            <select
              className="viewer-slide-switcher__select"
              value={selectedModelId}
              onChange={(e) => onSelectedModelIdChange(e.target.value)}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>

          <label className="viewer-ai-panel__field">
            <span className="viewer-ai-panel__label">Mode</span>
            <select
              className="viewer-slide-switcher__select"
              value={aiMode}
              onChange={(e) => onAiModeChange(e.target.value)}
            >
              <option value="he">H&amp;E</option>
              <option value="mif" disabled={!isMultichannel}>
                MIF
              </option>
            </select>
          </label>
        </section>

        {aiMode === "mif" ? (
          <section className="viewer-ai-panel__section">
            <div className="viewer-ai-panel__section-title">Channel configuration</div>

            <label className="viewer-ai-panel__field">
              <span className="viewer-ai-panel__label">Nuclear channel</span>
              <select
                className="viewer-slide-switcher__select"
                value={nuclearChannel}
                onChange={(e) => onNuclearChannelChange(e.target.value)}
              >
                <option value="">Select nuclear channel</option>
                {channels.map((channel) => (
                  <option key={channel.index} value={String(channel.index)}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="viewer-ai-panel__field">
              <div className="viewer-ai-panel__label">Membrane channels</div>
              <div className="viewer-ai-panel__check-grid">
                {channels.map((channel) => {
                  const value = String(channel.index);
                  return (
                    <label key={channel.index} className="viewer-display-toggle">
                      <input
                        className="viewer-display-toggle__input"
                        type="checkbox"
                        checked={membraneChannels.includes(value)}
                        onChange={() => handleMembraneToggle(value)}
                      />
                      <span className="viewer-display-toggle__control" />
                      <span className="viewer-display-toggle__label">{channel.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="viewer-ai-panel__field">
              <span className="viewer-ai-panel__label">Membrane combination</span>
              <select
                className="viewer-slide-switcher__select"
                value={membraneCombination}
                onChange={(e) => onMembraneCombinationChange(e.target.value)}
              >
                <option value="max">Max</option>
                <option value="mean">Mean</option>
                <option value="sum">Sum</option>
              </select>
            </label>
          </section>
        ) : null}

        <section className="viewer-ai-panel__section">
          <div className="viewer-ai-panel__section-title">ROI status</div>
          <div className="viewer-ai-panel__status-row">
            <span
              className={`viewer-badge viewer-badge--${
                selectedRoiAnnotation ? "success" : "warning"
              }`}
            >
              {selectedRoiAnnotation ? "Rectangle ROI selected" : "Rectangle ROI required"}
            </span>

            {aiError ? (
              <span className="viewer-badge viewer-badge--danger">{aiError}</span>
            ) : null}
          </div>
        </section>

        <section className="viewer-ai-panel__section">
          <div className="viewer-ai-panel__actions">
            <button
              type="button"
              className="viewer-btn"
              onClick={onRun}
              disabled={!selectedRoiAnnotation || isRunningAi}
            >
              {isRunningAi ? "Running AI..." : "Run AI"}
            </button>

            <button
              type="button"
              className="viewer-btn-secondary"
              onClick={onClearOverlay}
            >
              Clear overlay
            </button>

            <button
              type="button"
              className="viewer-btn-ghost"
              onClick={onResetDefaults}
            >
              Reset defaults
            </button>
          </div>
        </section>

        <AiResultsList
          results={results}
          onApplyResult={onApplyResult}
          onRemoveResult={onRemoveResult}
          onClearResults={onClearResults}
          onUpdateResultDisplay={onUpdateResultDisplay}
          onUpdateResultLayerStyle={onUpdateResultLayerStyle}
        />
      </div>
    </div>
  );
}

export default AiPanel;