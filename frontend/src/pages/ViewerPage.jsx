import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSlides, fetchSlideMetadata } from "../api/slides";
import {
  DEFAULT_ANNOTATION_COLOR,
  TOOL_AI,
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

const DEFAULT_CHANNEL_PALETTE = [
  "#0000ff",
  "#00ff00",
  "#ff0000",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
  "#ff9900",
  "#ffffff",
  "#8a2be2",
  "#7fff00",
  "#ff69b4",
  "#00bfff",
];

function getSlideIcon(type) {
  if (type === "ome-tiff") return "🧬";
  if (type === "svs") return "🔬";
  if (type === "ndpi") return "🩺";
  return "🖼️";
}

function formatValue(value, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function formatNumber(value, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPixels(value) {
  if (value === undefined || value === null) return "-";
  return `${formatNumber(value)} px`;
}

function formatMicronsPerPixelFromMm(mmValue) {
  if (mmValue === undefined || mmValue === null || Number.isNaN(Number(mmValue))) return "-";
  const micronsPerPixel = Number(mmValue) * 1000;
  return `${formatNumber(micronsPerPixel, 3)} µm/px`;
}

function formatMagnification(value) {
  if (value === undefined || value === null || value === "") return "-";
  const normalized = String(value).replace(/x$/i, "");
  return `${normalized}×`;
}

function formatDataType(value) {
  if (!value) return "-";
  return String(value).toUpperCase();
}

function getChannelColor(index) {
  if (DEFAULT_CHANNEL_PALETTE[index]) return DEFAULT_CHANNEL_PALETTE[index];
  const hue = (index * 137.508) % 360;
  return `hsl(${hue}, 85%, 60%)`;
}

function getBandCount(slideInfo) {
  const metadataBandCount = Number(slideInfo?.metadata?.bandCount);
  const rootBandCount = Number(slideInfo?.bandCount);

  if (Number.isFinite(metadataBandCount) && metadataBandCount > 0) return metadataBandCount;
  if (Number.isFinite(rootBandCount) && rootBandCount > 0) return rootBandCount;

  return 0;
}

function normalizeChannels(slideInfo) {
  if (Array.isArray(slideInfo?.channels) && slideInfo.channels.length) {
    return slideInfo.channels.map((channel, position) => {
      const resolvedIndex =
        channel?.index !== undefined && channel?.index !== null
          ? Number(channel.index)
          : position;

      return {
        ...channel,
        index: Number.isFinite(resolvedIndex) ? resolvedIndex : position,
        name:
          channel?.name ||
          channel?.label ||
          `Channel ${Number.isFinite(resolvedIndex) ? resolvedIndex + 1 : position + 1}`,
      };
    });
  }

  const bandCount = getBandCount(slideInfo);

  if (bandCount > 0) {
    return Array.from({ length: bandCount }, (_, index) => ({
      index,
      name: `Channel ${index + 1}`,
    }));
  }

  return [];
}

function buildDefaultChannelSettings(channels = []) {
  const nextSettings = {};

  channels.forEach((channel, i) => {
    nextSettings[channel.index] = {
      color: getChannelColor(i),
      opacity: 1,
    };
  });

  return nextSettings;
}

function buildMetadataRows(metadata) {
  return [
    { label: "Image width", value: formatPixels(metadata.sizeX) },
    { label: "Image height", value: formatPixels(metadata.sizeY) },
    { label: "Resolution X", value: formatMicronsPerPixelFromMm(metadata.mm_x) },
    { label: "Resolution Y", value: formatMicronsPerPixelFromMm(metadata.mm_y) },
    { label: "Pyramid levels", value: formatValue(metadata.levels) },
    { label: "Tile width", value: formatPixels(metadata.tileWidth) },
    { label: "Tile height", value: formatPixels(metadata.tileHeight) },
    { label: "Magnification", value: formatMagnification(metadata.magnification) },
    { label: "Data type", value: formatDataType(metadata.dtype) },
    { label: "Band count", value: formatValue(metadata.bandCount) },
  ].filter((row) => row.value !== "-");
}

function SidebarSection({ title, subtitle, children }) {
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

function KvList({ rows }) {
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

function ViewerInfoSection({
  selectedSlide,
  slideInfo,
  isOme,
  selectedChannelsCount,
  detectedChannelCount,
}) {
  const rows = [
    { label: "Slide name", value: formatValue(selectedSlide?.name) },
    { label: "Format", value: formatValue(slideInfo?.type) },
    { label: "Viewer engine", value: isOme ? "Viv" : "OpenSeadragon" },
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

function ViewerStatusSection({ slideInfo, isOme, selectedChannelsCount, detectedChannelCount }) {
  return (
    <SidebarSection
      title="Workspace status"
      subtitle="Quick review of the current viewing session"
    >
      <div className="viewer-status-grid">
        <div className="viewer-status-card">
          <div className="viewer-status-card__label">Mode</div>
          <div className="viewer-status-card__value">{isOme ? "Multichannel" : "WSI"}</div>
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

function ViewerMetadataSection({ slideInfo }) {
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

function ViewerToolsSection({ onResetView, onZoomIn, onZoomOut, onSetTool }) {
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
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_MEASURE)} type="button">
          📏 Measurement mode
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_SELECT)} type="button">
          ↖ Select / edit
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_AI)} type="button">
          🤖 AI overlay
        </button>
      </div>
    </SidebarSection>
  );
}

function ViewerChannelSummarySection({ channels, selectedChannels }) {
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

function ViewerPage() {
  const navigate = useNavigate();
  const { slideName } = useParams();
  const viewerControlsRef = useRef(null);

  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideInfo, setSlideInfo] = useState(null);
  const [channelSettings, setChannelSettings] = useState({});
  const [enabledChannelIndexes, setEnabledChannelIndexes] = useState([]);
  const [activeTool, setActiveTool] = useState(TOOL_PAN);
  const [annotationsBySlide, setAnnotationsBySlide] = useState({});
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [annotationColor, setAnnotationColor] = useState(DEFAULT_ANNOTATION_COLOR);

  const decodedSlidePath = decodeURIComponent(slideName || "");
  useEffect(() => {
    if (activeTool !== TOOL_SELECT) {
      setSelectedAnnotationId(null);
    }
  }, [activeTool]);
  useEffect(() => {
    fetchSlides()
      .then((data) => {
        const allSlides = data.slides || [];
        setSlides(allSlides);
      })
      .catch((err) => {
        console.error("Error fetching slides:", err);
        setSlides([]);
      });
  }, []);

  useEffect(() => {
    if (!decodedSlidePath) {
      setSelectedSlide(null);
      setSlideInfo(null);
      setChannelSettings({});
      setEnabledChannelIndexes([]);
      return;
    }

    const filename = decodedSlidePath.split("/").pop() || decodedSlidePath;

    setSelectedSlide({
      name: filename,
      path: decodedSlidePath,
    });

    fetchSlideMetadata(decodedSlidePath)
      .then((data) => {
        setSlideInfo(data);

        if (data.type === "ome-tiff") {
          const resolvedChannels = normalizeChannels(data);

          if (resolvedChannels.length) {
            setChannelSettings(buildDefaultChannelSettings(resolvedChannels));

            const defaultEnabled = resolvedChannels
              .slice(0, Math.min(6, resolvedChannels.length))
              .map((channel) => channel.index);

            setEnabledChannelIndexes(defaultEnabled);
          } else {
            setChannelSettings({});
            setEnabledChannelIndexes([]);
          }
        } else {
          setChannelSettings({});
          setEnabledChannelIndexes([]);
        }
      })
      .catch((err) => {
        console.error("Error loading metadata:", err);
        setSelectedSlide(null);
        setSlideInfo(null);
        setChannelSettings({});
        setEnabledChannelIndexes([]);
      });
  }, [decodedSlidePath]);

  const normalizedChannels = useMemo(() => normalizeChannels(slideInfo), [slideInfo]);

  const selectedChannels = useMemo(() => {
    return enabledChannelIndexes
      .map((index) => ({
        index,
        ...(channelSettings[index] || { color: "#ffffff", opacity: 1 }),
      }))
      .sort((a, b) => a.index - b.index);
  }, [enabledChannelIndexes, channelSettings]);

  const slideAnnotationKey = selectedSlide?.path || selectedSlide?.name || "";
  const annotations = annotationsBySlide[slideAnnotationKey] || [];
  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;

  useEffect(() => {
    setSelectedAnnotationId(null);
  }, [slideAnnotationKey]);

  useEffect(() => {
    if (selectedAnnotation?.color) {
      setAnnotationColor(selectedAnnotation.color);
    }
  }, [selectedAnnotation?.color]);

  const toggleChannel = (index) => {
    setEnabledChannelIndexes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const updateChannelSettings = (index, patch) => {
    setChannelSettings((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || { color: "#ffffff", opacity: 1 }),
        ...patch,
      },
    }));
  };

  const handleEnableAllChannels = () => {
    if (!normalizedChannels.length) return;
    setEnabledChannelIndexes(normalizedChannels.map((channel) => channel.index));
  };

  const handleDisableAllChannels = () => {
    setEnabledChannelIndexes([]);
  };

  const handleResetAllChannels = () => {
    if (!normalizedChannels.length) return;
    setChannelSettings(buildDefaultChannelSettings(normalizedChannels));
  };

  const handleZoomIn = () => {
    viewerControlsRef.current?.zoomIn?.();
  };

  const handleZoomOut = () => {
    viewerControlsRef.current?.zoomOut?.();
  };

  const handleResetView = () => {
    viewerControlsRef.current?.resetView?.();
  };

  const handleAddAnnotation = (annotation) => {
    if (!slideAnnotationKey) return;

    setAnnotationsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: [...(prev[slideAnnotationKey] || []), annotation],
    }));
  };

  const handleUpdateAnnotation = (annotationId, patch) => {
    if (!slideAnnotationKey) return;

    setAnnotationsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: (prev[slideAnnotationKey] || []).map((annotation) =>
        annotation.id === annotationId ? { ...annotation, ...patch } : annotation
      ),
    }));
  };

  const handleDeleteAnnotation = (annotationId) => {
    if (!slideAnnotationKey) return;

    setAnnotationsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: (prev[slideAnnotationKey] || []).filter(
        (annotation) => annotation.id !== annotationId
      ),
    }));

    setSelectedAnnotationId((prev) => (prev === annotationId ? null : prev));
  };

  const handleClearAnnotations = () => {
    if (!slideAnnotationKey) return;

    setAnnotationsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: [],
    }));

    setSelectedAnnotationId(null);
  };

  const handleSlideChange = (event) => {
    const nextSlidePath = event.target.value;
    if (!nextSlidePath || nextSlidePath === selectedSlide?.path) return;
    navigate(`/viewer/${encodeURIComponent(nextSlidePath)}`);
  };

  const isOme = slideInfo?.type === "ome-tiff";

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
    <div className="viewer-page">
      <header className="viewer-topbar">
        <div className="viewer-topbar__left">
          <button className="viewer-btn-ghost" onClick={() => navigate("/")} type="button">
            ← File Manager
          </button>

          <div className="viewer-brand">
            <div className="viewer-brand__title">VitaminPScope Viewer</div>
            <div className="viewer-brand__subtitle">Diagnostic slide workspace</div>
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
            isOme={isOme}
            selectedChannelsCount={selectedChannels.length}
            detectedChannelCount={normalizedChannels.length}
          />

          <ViewerStatusSection
            slideInfo={slideInfo}
            isOme={isOme}
            selectedChannelsCount={selectedChannels.length}
            detectedChannelCount={normalizedChannels.length}
          />

          <ViewerMetadataSection slideInfo={slideInfo} />

          {isOme ? (
            <ViewerChannelSummarySection
              channels={normalizedChannels}
              selectedChannels={selectedChannels}
            />
          ) : null}

          {isOme && normalizedChannels.length ? (
            <SidebarSection
              title="Channel controls"
              subtitle="Enable, filter, tint, and adjust multichannel rendering"
            >
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
            </SidebarSection>
          ) : null}

          <ViewerToolsSection
            onResetView={handleResetView}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetTool={setActiveTool}
          />
        </aside>

        <main className="viewer-stage">
          <div className="viewer-stage__toolbar">
            <div className="viewer-stage__toolbar-left">
              <span className="viewer-badge">{slideInfo?.type || "unknown"}</span>
              <span className="viewer-badge">
                {isOme ? "Multichannel viewer" : "Whole-slide viewer"}
              </span>
            </div>

            <div className="viewer-stage__toolbar-center">
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

            <div className="viewer-stage__toolbar-right">
              <button className="viewer-stage-icon-btn" onClick={handleZoomIn} type="button">
                ＋
              </button>
              <button className="viewer-stage-icon-btn" onClick={handleZoomOut} type="button">
                －
              </button>
              <button className="viewer-stage-icon-btn" onClick={handleResetView} type="button">
                ⌂
              </button>
              <span className="viewer-badge">
                {selectedChannels.length} active channel
                {selectedChannels.length === 1 ? "" : "s"}
              </span>
              <span className="viewer-badge">
                {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="viewer-canvas-shell">
            <div className="viewer-canvas-card">
              {!slideInfo ? (
                <div className="viewer-empty-state">Loading slide workspace...</div>
              ) : isOme ? (
                <VivViewer
                  ref={viewerControlsRef}
                  slide={selectedSlide}
                  slideInfo={slideInfo}
                  selectedChannels={selectedChannels}
                  activeTool={activeTool}
                  annotations={annotations}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  annotationColor={annotationColor}
                />
              ) : (
                <OpenSeadragonViewer
                  ref={viewerControlsRef}
                  slide={selectedSlide}
                  slideInfo={slideInfo}
                  selectedChannels={selectedChannels}
                  activeTool={activeTool}
                  annotations={annotations}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  annotationColor={annotationColor}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ViewerPage;