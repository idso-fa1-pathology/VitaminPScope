import React from "react";
import {
  TOOL_MEASURE,
  TOOL_RECT,
  TOOL_SELECT,
} from "../../annotations/annotationTypes";
import {
  buildMetadataRows,
  formatValue,
} from "./viewerHelpers";

export function SidebarSection({ title, subtitle, children }) {
  return (
    <section className="viewer-sidebar__section">
      <div className="viewer-sidebar__section-header">
        <h3 className="viewer-sidebar__section-title">{title}</h3>
        {subtitle ? <p className="viewer-sidebar__section-subtitle">{subtitle}</p> : null}
      </div>

      <div className="viewer-sidebar__section-body">{children}</div>
    </section>
  );
}

export function KvList({ rows }) {
  if (!rows?.length) return null;

  return (
    <div className="viewer-kv-list">
      {rows.map((row) => (
        <div className="viewer-kv-row" key={row.label}>
          <div className="viewer-kv-key">{row.label}</div>
          <div className="viewer-kv-value">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ViewerInfoSection({
  selectedSlide,
  slideInfo,
  useVivViewer,
  selectedChannelsCount,
  detectedChannelCount,
}) {
  const rows = [
    { label: "Slide name", value: formatValue(selectedSlide?.name) },
    { label: "Format", value: formatValue(slideInfo?.type) },
    { label: "Viewer engine", value: useVivViewer ? "Viv" : "OpenSeadragon" },
    {
      label: "Channels",
      value: `${detectedChannelCount} total • ${selectedChannelsCount} active`,
    },
  ];

  return (
    <SidebarSection
      title="Slide overview"
      subtitle="Core information for the file currently open"
    >
      <KvList rows={rows} />
    </SidebarSection>
  );
}

export function ViewerStatusSection({
  slideInfo,
  isMultichannel,
  selectedChannelsCount,
  detectedChannelCount,
}) {
  return (
    <SidebarSection
      title="Workspace status"
      subtitle="Quick review of the current viewing session"
    >
      <div className="viewer-status-grid">
        <div className="viewer-status-card">
          <div className="viewer-status-card__label">Mode</div>
          <div className="viewer-status-card__value">{isMultichannel ? "Multichannel" : "WSI"}</div>
        </div>

        <div className="viewer-status-card">
          <div className="viewer-status-card__label">Format</div>
          <div className="viewer-status-card__value">{formatValue(slideInfo?.type)}</div>
        </div>

        <div className="viewer-status-card">
          <div className="viewer-status-card__label">Active</div>
          <div className="viewer-status-card__value">{selectedChannelsCount}</div>
        </div>

        <div className="viewer-status-card">
          <div className="viewer-status-card__label">Detected</div>
          <div className="viewer-status-card__value">{detectedChannelCount}</div>
        </div>
      </div>
    </SidebarSection>
  );
}

export function ViewerMetadataSection({ slideInfo }) {
  const metadata = slideInfo?.metadata || {};
  const rows = buildMetadataRows(metadata);

  if (!rows.length) return null;

  return (
    <SidebarSection
      title="Image metadata"
      subtitle="Technical properties reported by the slide"
    >
      <KvList rows={rows} />
    </SidebarSection>
  );
}

export function ViewerToolsSection({
  onResetView,
  onZoomIn,
  onZoomOut,
  onSetTool,
  onOpenImageAdjustments,
}) {
  return (
    <SidebarSection
      title="Quick actions"
      subtitle="Common viewer actions for faster workflow"
    >
      <div className="viewer-tool-list">
        <button className="viewer-tool-btn" onClick={onResetView} type="button">
          🧭 Reset view
        </button>
        <button className="viewer-tool-btn" onClick={onZoomIn} type="button">
          ＋ Zoom in
        </button>
        <button className="viewer-tool-btn" onClick={onZoomOut} type="button">
          － Zoom out
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_RECT)} type="button">
          ▭ Draw rectangle ROI
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_MEASURE)} type="button">
          📏 Measurement mode
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_SELECT)} type="button">
          ↖ Select / edit
        </button>
        <button className="viewer-tool-btn" onClick={onOpenImageAdjustments} type="button">
          🎛 Image adjustments
        </button>
      </div>
    </SidebarSection>
  );
}

export function ViewerChannelSummarySection({ channels, selectedChannels }) {
  if (!channels?.length) return null;

  const activeNames = channels
    .filter((channel) => selectedChannels.some((selected) => selected.index === channel.index))
    .map((channel) => channel.name || `Channel ${channel.index + 1}`);

  return (
    <SidebarSection
      title="Channel summary"
      subtitle="Overview of currently enabled channels"
    >
      <div className="viewer-kv-list">
        <div className="viewer-kv-row">
          <div className="viewer-kv-key">Enabled channels</div>
          <div className="viewer-kv-value">
            {selectedChannels.length} / {channels.length}
          </div>
        </div>

        <div className="viewer-kv-row">
          <div className="viewer-kv-key">Active names</div>
          <div className="viewer-kv-value">
            {activeNames.length ? activeNames.join(", ") : "None selected"}
          </div>
        </div>
      </div>
    </SidebarSection>
  );
}

export function DisplayToggle({ checked, onChange, label }) {
  return (
    <label className="viewer-display-toggle">
      <input
        className="viewer-display-toggle__input"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="viewer-display-toggle__control" />
      <span className="viewer-display-toggle__label">{label}</span>
    </label>
  );
}

export function ViewerDisplaySection({
  showTopOverlay,
  setShowTopOverlay,
  showAnnotationToolbar,
  setShowAnnotationToolbar,
  showZoomControls,
  setShowZoomControls,
  showBottomOverlay,
  setShowBottomOverlay,
  showScaleBar,
  setShowScaleBar,
  onShowAll,
  onHideAll,
}) {
  return (
    <SidebarSection
      title="Viewer overlays"
      subtitle="Show or hide floating UI without changing viewer logic"
    >
      <div className="viewer-display-grid">
        <DisplayToggle
          checked={showTopOverlay}
          onChange={setShowTopOverlay}
          label="Top status bar"
        />
        <DisplayToggle
          checked={showAnnotationToolbar}
          onChange={setShowAnnotationToolbar}
          label="Annotation toolbar"
        />
        <DisplayToggle
          checked={showZoomControls}
          onChange={setShowZoomControls}
          label="Zoom controls"
        />
        <DisplayToggle
          checked={showBottomOverlay}
          onChange={setShowBottomOverlay}
          label="Bottom status bar"
        />
        <DisplayToggle
          checked={showScaleBar}
          onChange={setShowScaleBar}
          label="Scale bar"
        />
      </div>

      <div className="viewer-display-actions">
        <button className="viewer-tool-btn" type="button" onClick={onShowAll}>
          Show all overlays
        </button>
        <button className="viewer-tool-btn" type="button" onClick={onHideAll}>
          Hide all overlays
        </button>
      </div>
    </SidebarSection>
  );
}