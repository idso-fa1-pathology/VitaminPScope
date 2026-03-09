import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  TOOL_MEASURE,
  TOOL_PAN,
  TOOL_RECT,
  TOOL_SELECT,
} from "../annotations/annotationTypes";
import AnnotationToolbar from "../annotations/AnnotationToolbar";
import ChannelPanel from "../components/ChannelPanel";
import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
import VivViewer from "../viewers/VivViewer";
import "../styles/viewer-page.css";

import AiPanel from "./viewer/ai/AiPanel";
import AiToolbarButton from "./viewer/ai/AiToolbarButton";
import { useAiInference } from "./viewer/ai/useAiInference";
import { getAiBadgeTone, getSlideIcon } from "./viewer/viewerHelpers";
import {
  ViewerInfoSection,
  ViewerStatusSection,
  ViewerMetadataSection,
  ViewerToolsSection,
  ViewerChannelSummarySection,
  ViewerDisplaySection,
} from "./viewer/viewerSections";
import { useViewerLogic } from "./viewer/useViewerLogic";

function ViewerPage() {
  const navigate = useNavigate();
  const { slideName } = useParams();
  const [searchParams] = useSearchParams();
  const viewerControlsRef = useRef(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const decodedSlidePath = decodeURIComponent(slideName || "");
  const currentSourceId = searchParams.get("source_id") || "default";

  const {
    ImageAdjustPanel,
    selectedSlide,
    slideInfo,
    slides,
    channelSettings,
    activeTool,
    setActiveTool,
    annotations,
    aiLayers,
    selectedAnnotationId,
    setSelectedAnnotationId,
    selectedAnnotation,
    selectedRoiAnnotation,
    annotationColor,
    setAnnotationColor,
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
    showImageAdjustPanel,
    setShowImageAdjustPanel,
    theme,
    imageAdjustments,
    normalizedChannels,
    selectedChannels,
    isMultichannel,
    useVivViewer,
    slideAnnotationKey,
    toggleChannel,
    updateChannelSettings,
    handleEnableAllChannels,
    handleDisableAllChannels,
    handleResetAllChannels,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleAddAnnotation,
    handleUpdateAnnotation,
    handleDeleteAnnotation,
    handleClearAnnotations,
    handleSetAiLayers,
    handleClearAiLayers,
    handleImageAdjustmentsChange,
    handleResetImageAdjustments,
    handleSlideChange,
    handleShowAllOverlays,
    handleHideAllOverlays,
    handleToggleTheme,
    buildPreviewUrl,
  } = useViewerLogic({
    decodedSlidePath,
    currentSourceId,
    navigate,
    viewerControlsRef,
  });

  const {
    availableModels,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    aiMode,
    setAiMode,
    aiNuclearChannel,
    setAiNuclearChannel,
    aiMembraneChannels,
    setAiMembraneChannels,
    aiMembraneCombination,
    setAiMembraneCombination,
    isRunningAi,
    aiError,
    results,
    handleResetAiDefaults,
    clearResults,
    removeResult,
    applyResultLayers,
    updateResultDisplay,
    updateResultLayerStyle,
    runInference,
  } = useAiInference({
    slideInfo,
    selectedSlide,
    selectedRoiAnnotation,
    normalizedChannels,
    currentSourceId,
    slideAnnotationKey,
    onApplyLayers: handleSetAiLayers,
  });

  if (!selectedSlide) {
    return (
      <div className="viewer-not-found">
        <div className="viewer-not-found__header">
          <button className="viewer-btn-ghost" onClick={() => navigate("/")} type="button">
            ← Back to File Manager
          </button>
          <strong>VitaminPScope Viewer</strong>
        </div>

        <div className="viewer-not-found__body">
          Slide not found. Return to the file manager and select a valid slide.
        </div>
      </div>
    );
  }

  return (
    <div className={`viewer-page viewer-page--${theme}`}>
      <header className="viewer-topbar">
        <div className="viewer-topbar__left">
          <button className="viewer-btn-ghost" onClick={() => navigate("/")} type="button">
            ← File Manager
          </button>

          <div className="viewer-brand">
            <div className="viewer-brand__title">VitaminPScope Viewer</div>
            <div className="viewer-brand__subtitle">Slide workspace</div>
          </div>

          <div className="viewer-file-chip">
            <div className="viewer-file-chip__icon">{getSlideIcon(slideInfo?.type)}</div>
            <div className="viewer-file-chip__meta">
              <div className="viewer-file-chip__label">Current slide</div>
              <div className="viewer-file-chip__name">{selectedSlide.name}</div>
            </div>
          </div>
        </div>

        <div className="viewer-topbar__right">
          <button className="viewer-btn-secondary" onClick={handleToggleTheme} type="button">
            {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
          </button>

          <div className="viewer-slide-switcher">
            <label className="viewer-slide-switcher__label">Switch slide</label>
            <select
              className="viewer-slide-switcher__select"
              value={selectedSlide.path}
              onChange={handleSlideChange}
            >
              <option value={selectedSlide.path}>{selectedSlide.name}</option>
              {slides
                .filter((slide) => (slide.path || slide.name) !== selectedSlide.path)
                .map((slide) => (
                  <option key={slide.path || slide.name} value={slide.path || slide.name}>
                    {slide.name}
                  </option>
                ))}
            </select>
          </div>

          <button className="viewer-btn-secondary" type="button">
            Export snapshot
          </button>
          <button className="viewer-btn" type="button">
            Open analysis
          </button>
        </div>
      </header>

      <div className="viewer-body">
        <aside className="viewer-sidebar">
          <ViewerInfoSection
            selectedSlide={selectedSlide}
            slideInfo={slideInfo}
            useVivViewer={useVivViewer}
            selectedChannelsCount={selectedChannels.length}
            detectedChannelCount={normalizedChannels.length}
          />

          <ViewerStatusSection
            slideInfo={slideInfo}
            isMultichannel={isMultichannel}
            selectedChannelsCount={selectedChannels.length}
            detectedChannelCount={normalizedChannels.length}
          />

          <ViewerMetadataSection slideInfo={slideInfo} />

          {useVivViewer && normalizedChannels.length ? (
            <ViewerChannelSummarySection
              channels={normalizedChannels}
              selectedChannels={selectedChannels}
            />
          ) : null}

          {useVivViewer && normalizedChannels.length ? (
            <div className="viewer-sidebar__section">
              <div className="viewer-sidebar__section-header">
                <h3 className="viewer-sidebar__section-title">Channel controls</h3>
                <p className="viewer-sidebar__section-subtitle">
                  Enable, filter, tint, and adjust multichannel rendering
                </p>
              </div>

              <div className="viewer-sidebar__section-body">
                <ChannelPanel
                  channels={normalizedChannels}
                  selectedChannels={selectedChannels}
                  channelSettings={channelSettings}
                  onToggle={toggleChannel}
                  onUpdate={updateChannelSettings}
                  onEnableAll={handleEnableAllChannels}
                  onDisableAll={handleDisableAllChannels}
                  onResetAll={handleResetAllChannels}
                />
              </div>
            </div>
          ) : null}

          <ViewerToolsSection
            onResetView={handleResetView}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetTool={setActiveTool}
            onOpenImageAdjustments={() => setShowImageAdjustPanel(true)}
          />

          <ViewerDisplaySection
            showTopOverlay={showTopOverlay}
            setShowTopOverlay={setShowTopOverlay}
            showAnnotationToolbar={showAnnotationToolbar}
            setShowAnnotationToolbar={setShowAnnotationToolbar}
            showZoomControls={showZoomControls}
            setShowZoomControls={setShowZoomControls}
            showBottomOverlay={showBottomOverlay}
            setShowBottomOverlay={setShowBottomOverlay}
            showScaleBar={showScaleBar}
            setShowScaleBar={setShowScaleBar}
            onShowAll={handleShowAllOverlays}
            onHideAll={handleHideAllOverlays}
          />
        </aside>

        <main className="viewer-stage">
          <div className="viewer-canvas-shell">
            <div className="viewer-canvas-card">
              {!slideInfo ? (
                <div className="viewer-empty-state">Loading slide workspace...</div>
              ) : (
                <div
                  className={[
                    "viewer-canvas-frame",
                    !showScaleBar ? "viewer-canvas-frame--hide-scale-bar" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {useVivViewer ? (
                    <VivViewer
                      ref={viewerControlsRef}
                      slide={selectedSlide}
                      slideInfo={slideInfo}
                      sourceId={currentSourceId}
                      selectedChannels={selectedChannels}
                      activeTool={activeTool}
                      annotations={annotations}
                      aiLayers={aiLayers}
                      onAddAnnotation={handleAddAnnotation}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onDeleteAnnotation={handleDeleteAnnotation}
                      selectedAnnotationId={selectedAnnotationId}
                      onSelectAnnotation={setSelectedAnnotationId}
                      annotationColor={annotationColor}
                      imageAdjustments={imageAdjustments}
                      buildPreviewUrl={buildPreviewUrl}
                    />
                  ) : (
                    <OpenSeadragonViewer
                      ref={viewerControlsRef}
                      slide={selectedSlide}
                      slideInfo={slideInfo}
                      sourceId={currentSourceId}
                      selectedChannels={selectedChannels}
                      activeTool={activeTool}
                      annotations={annotations}
                      aiLayers={aiLayers}
                      onAddAnnotation={handleAddAnnotation}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onDeleteAnnotation={handleDeleteAnnotation}
                      selectedAnnotationId={selectedAnnotationId}
                      onSelectAnnotation={setSelectedAnnotationId}
                      annotationColor={annotationColor}
                      imageAdjustments={imageAdjustments}
                      buildPreviewUrl={buildPreviewUrl}
                    />
                  )}

                  {showTopOverlay ? (
                    <div className="viewer-overlay viewer-overlay--top">
                      <div className="viewer-overlay__row viewer-overlay__row--compact">
                        <span className="viewer-badge viewer-badge--sm">
                          {slideInfo?.type || "unknown"}
                        </span>
                        <span className="viewer-badge viewer-badge--sm">
                          {isMultichannel ? "Multichannel" : "WSI"}
                        </span>
                        <span className="viewer-badge viewer-badge--sm">
                          {selectedModel?.label || "AI model"}
                        </span>
                        <span className="viewer-badge viewer-badge--sm">
                          AI {String(aiMode).toUpperCase()}
                        </span>
                        <span className="viewer-badge viewer-badge--sm">
                          {imageAdjustments.auto ? "Auto tone" : "Manual tone"}
                        </span>

                        {isRunningAi ? (
                          <span className="viewer-badge viewer-badge--sm viewer-badge--primary viewer-badge--blink">
                            AI running...
                          </span>
                        ) : null}

                        {!selectedRoiAnnotation && !isRunningAi ? (
                          <span className="viewer-badge viewer-badge--sm viewer-badge--warning">
                            Select ROI
                          </span>
                        ) : null}

                        {aiError ? (
                          <span className="viewer-badge viewer-badge--sm viewer-badge--danger">
                            {aiError}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {showAnnotationToolbar ? (
                    <div className="viewer-overlay viewer-overlay--left">
                      <AnnotationToolbar
                        activeTool={activeTool}
                        onToolChange={setActiveTool}
                        onClear={handleClearAnnotations}
                        color={annotationColor}
                        onColorChange={(nextColor) => {
                          setAnnotationColor(nextColor);

                          if (selectedAnnotationId) {
                            handleUpdateAnnotation(selectedAnnotationId, { color: nextColor });
                          }
                        }}
                        selectedAnnotation={selectedAnnotation}
                        onDeleteSelected={() => {
                          if (selectedAnnotationId) {
                            handleDeleteAnnotation(selectedAnnotationId);
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {showZoomControls ? (
                    <div className="viewer-overlay viewer-overlay--right">
                      <div className="viewer-fab-stack">
                        <button
                          className="viewer-fab-btn"
                          onClick={handleZoomIn}
                          type="button"
                          title="Zoom in"
                        >
                          ＋
                        </button>
                        <button
                          className="viewer-fab-btn"
                          onClick={handleZoomOut}
                          type="button"
                          title="Zoom out"
                        >
                          －
                        </button>
                        <button
                          className="viewer-fab-btn"
                          onClick={handleResetView}
                          type="button"
                          title="Reset view"
                        >
                          ⌂
                        </button>
                        <button
                          className="viewer-fab-btn"
                          onClick={() => setShowImageAdjustPanel(true)}
                          type="button"
                          title="Image adjustments"
                        >
                          🎛
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <AiToolbarButton
                    isOpen={showAiPanel}
                    hasSelectedRoi={Boolean(selectedRoiAnnotation)}
                    isRunning={isRunningAi}
                    hasResults={results.length > 0}
                    onClick={() => setShowAiPanel((prev) => !prev)}
                  />

                  <AiPanel
                    isOpen={showAiPanel}
                    isMultichannel={isMultichannel}
                    channels={normalizedChannels}
                    selectedRoiAnnotation={selectedRoiAnnotation}
                    aiMode={aiMode}
                    onAiModeChange={setAiMode}
                    selectedModelId={selectedModelId}
                    onSelectedModelIdChange={setSelectedModelId}
                    availableModels={availableModels}
                    nuclearChannel={aiNuclearChannel}
                    onNuclearChannelChange={setAiNuclearChannel}
                    membraneChannels={aiMembraneChannels}
                    onMembraneChannelsChange={setAiMembraneChannels}
                    membraneCombination={aiMembraneCombination}
                    onMembraneCombinationChange={setAiMembraneCombination}
                    onResetDefaults={handleResetAiDefaults}
                    onRun={runInference}
                    onClearOverlay={handleClearAiLayers}
                    isRunningAi={isRunningAi}
                    aiError={aiError}
                    results={results}
                    onApplyResult={applyResultLayers}
                    onRemoveResult={removeResult}
                    onClearResults={clearResults}
                    onClose={() => setShowAiPanel(false)}
                    onUpdateResultDisplay={updateResultDisplay}
                    onUpdateResultLayerStyle={updateResultLayerStyle}
                  />

                  {showBottomOverlay ? (
                    <div className="viewer-overlay viewer-overlay--bottom">
                      <div className="viewer-overlay__row viewer-overlay__row--bottom">
                        <span className="viewer-badge">
                          {selectedChannels.length} active channel
                          {selectedChannels.length === 1 ? "" : "s"}
                        </span>
                        <span className="viewer-badge">
                          {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
                        </span>
                        <span className="viewer-badge">
                          {aiLayers.length} AI layer{aiLayers.length === 1 ? "" : "s"}
                        </span>
                        <span className="viewer-badge">
                          γ {Number(imageAdjustments.gamma).toFixed(2)}
                        </span>
                        <span
                          className={`viewer-badge viewer-badge--${getAiBadgeTone(
                            aiError,
                            selectedRoiAnnotation,
                            isRunningAi
                          )}`}
                        >
                          {aiError
                            ? "AI error"
                            : isRunningAi
                              ? "AI busy"
                              : selectedRoiAnnotation
                                ? "ROI selected"
                                : "ROI required"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <ImageAdjustPanel
        isOpen={showImageAdjustPanel}
        adjustments={imageAdjustments}
        onChange={handleImageAdjustmentsChange}
        onClose={() => setShowImageAdjustPanel(false)}
        onReset={handleResetImageAdjustments}
      />
    </div>
  );
}

export default ViewerPage;