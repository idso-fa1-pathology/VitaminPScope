import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  buildThumbnailUrl,
  fetchSlides,
  fetchSlideMetadata,
  fetchVivInfo,
  runRoiAiSegmentation,
} from "../api/slides";
import {
  DEFAULT_ANNOTATION_COLOR,
  TOOL_AI,
  TOOL_MEASURE,
  TOOL_PAN,
  TOOL_RECT,
  TOOL_SELECT,
} from "../annotations/annotationTypes";
import AnnotationToolbar from "../annotations/AnnotationToolbar";
import AiSettingsPanel from "../components/AiSettingsPanel";
import ChannelPanel from "../components/ChannelPanel";
import ImageAdjustPanel, {
  DEFAULT_IMAGE_ADJUSTMENTS,
} from "../components/ImageAdjustPanel";
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

function isMultichannelSlide(slideInfo) {
  const slideType = String(slideInfo?.type || "").toLowerCase();

  if (slideType !== "ome-tiff") {
    return false;
  }

  const bandCount = getBandCount(slideInfo);
  if (bandCount > 3) return true;

  const channels = Array.isArray(slideInfo?.channels) ? slideInfo.channels : [];
  if (channels.length > 3) return true;

  return false;
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

function guessAiMode(slideInfo) {
  return isMultichannelSlide(slideInfo) ? "mif" : "he";
}

function guessNuclearChannel(channels = []) {
  if (!channels.length) return "";

  const preferredNames = ["dapi", "nucleus", "nuclei", "dna", "hoechst"];
  const match = channels.find((ch) =>
    preferredNames.some((term) => String(ch.name || "").toLowerCase().includes(term))
  );

  if (match) return String(match.index);

  const fallback = channels.find((ch) => Number(ch.index) === 2);
  if (fallback) return String(fallback.index);

  return String(channels[channels.length - 1].index);
}

function guessMembraneChannels(channels = [], nuclearChannel) {
  return channels
    .filter((ch) => String(ch.index) !== String(nuclearChannel))
    .slice(0, 2)
    .map((ch) => String(ch.index));
}

function getAiBadgeTone(aiError, selectedRoiAnnotation, isRunningAi) {
  if (aiError) return "danger";
  if (isRunningAi) return "primary";
  if (!selectedRoiAnnotation) return "warning";
  return "success";
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

function ViewerStatusSection({
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

function ViewerToolsSection({
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
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_MEASURE)} type="button">
          📏 Measurement mode
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_SELECT)} type="button">
          ↖ Select / edit
        </button>
        <button className="viewer-tool-btn" onClick={() => onSetTool(TOOL_AI)} type="button">
          🤖 AI overlay
        </button>
        <button className="viewer-tool-btn" onClick={onOpenImageAdjustments} type="button">
          🎛 Image adjustments
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

function DisplayToggle({ checked, onChange, label }) {
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

function ViewerDisplaySection({
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

function ViewerPage() {
  const navigate = useNavigate();
  const { slideName } = useParams();
  const [searchParams] = useSearchParams();
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

  const [aiLayersBySlide, setAiLayersBySlide] = useState({});
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [aiError, setAiError] = useState("");

  const [aiMode, setAiMode] = useState("he");
  const [aiNuclearChannel, setAiNuclearChannel] = useState("");
  const [aiMembraneChannels, setAiMembraneChannels] = useState([]);
  const [aiMembraneCombination, setAiMembraneCombination] = useState("max");

  const [showTopOverlay, setShowTopOverlay] = useState(true);
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(true);
  const [showZoomControls, setShowZoomControls] = useState(true);
  const [showBottomOverlay, setShowBottomOverlay] = useState(true);
  const [showScaleBar, setShowScaleBar] = useState(true);

  const [showImageAdjustPanel, setShowImageAdjustPanel] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [imageAdjustmentsBySlide, setImageAdjustmentsBySlide] = useState({});

  const decodedSlidePath = decodeURIComponent(slideName || "");
  const currentSourceId = searchParams.get("source_id") || "default";

  useEffect(() => {
    if (activeTool !== TOOL_SELECT) {
      setSelectedAnnotationId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    fetchSlides("", currentSourceId)
      .then((data) => {
        const allSlides = data.slides || [];
        setSlides(allSlides);
      })
      .catch((err) => {
        console.error("Error fetching slides:", err);
        setSlides([]);
      });
  }, [currentSourceId]);

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
      sourceId: currentSourceId,
    });

    fetchSlideMetadata(decodedSlidePath, currentSourceId)
      .then((data) => {
        setSlideInfo(data);

        const resolvedChannels = normalizeChannels(data);
        const nextAiMode = guessAiMode(data);
        const nextNuclearChannel = guessNuclearChannel(resolvedChannels);
        const nextMembraneChannels = guessMembraneChannels(
          resolvedChannels,
          nextNuclearChannel
        );
        const shouldUseViv = isMultichannelSlide(data);

        setAiMode(nextAiMode);
        setAiNuclearChannel(nextNuclearChannel);
        setAiMembraneChannels(nextMembraneChannels);
        setAiMembraneCombination("max");

        if (shouldUseViv) {
          if (resolvedChannels.length) {
            setChannelSettings(buildDefaultChannelSettings(resolvedChannels));

            const defaultEnabled = resolvedChannels
              .slice(0, Math.min(4, resolvedChannels.length))
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
    }, [decodedSlidePath, currentSourceId]);

  const normalizedChannels = useMemo(() => normalizeChannels(slideInfo), [slideInfo]);

  const selectedChannels = useMemo(() => {
    return enabledChannelIndexes
      .map((index) => ({
        index,
        ...(channelSettings[index] || { color: "#ffffff", opacity: 1 }),
      }))
      .sort((a, b) => a.index - b.index);
  }, [enabledChannelIndexes, channelSettings]);

  const slideAnnotationKey = selectedSlide
  ? `${selectedSlide.sourceId || "default"}::${selectedSlide.path || selectedSlide.name || ""}`
  : "";
  const annotations = annotationsBySlide[slideAnnotationKey] || [];
  const aiLayers = aiLayersBySlide[slideAnnotationKey] || [];

  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;

  const selectedRoiAnnotation =
    selectedAnnotation && selectedAnnotation.tool === TOOL_RECT
      ? selectedAnnotation
      : null;

  const isMultichannel = useMemo(() => isMultichannelSlide(slideInfo), [slideInfo]);
  const useVivViewer = isMultichannel;

  const imageAdjustments =
    imageAdjustmentsBySlide[slideAnnotationKey] || DEFAULT_IMAGE_ADJUSTMENTS;

  useEffect(() => {
    setSelectedAnnotationId(null);
    setAiError("");
    setShowImageAdjustPanel(false);
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

  const handleResetAiDefaults = () => {
    const nextAiMode = guessAiMode(slideInfo);
    const nextNuclearChannel = guessNuclearChannel(normalizedChannels);
    const nextMembraneChannels = guessMembraneChannels(
      normalizedChannels,
      nextNuclearChannel
    );

    setAiMode(nextAiMode);
    setAiNuclearChannel(nextNuclearChannel);
    setAiMembraneChannels(nextMembraneChannels);
    setAiMembraneCombination("max");
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

  const handleClearAiLayers = () => {
    if (!slideAnnotationKey) return;

    setAiLayersBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: [],
    }));

    setAiError("");
  };

  const handleImageAdjustmentsChange = (nextAdjustments) => {
    if (!slideAnnotationKey) return;

    setImageAdjustmentsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: nextAdjustments,
    }));
  };

  const handleResetImageAdjustments = () => {
    if (!slideAnnotationKey) return;

    setImageAdjustmentsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: { ...DEFAULT_IMAGE_ADJUSTMENTS },
    }));
  };

  const handleRunAiOnSelectedRoi = async () => {
    if (!selectedSlide?.path) return;

    if (!selectedRoiAnnotation) {
      setAiError("Select a rectangle ROI first.");
      return;
    }

    if (aiMode === "mif" && !aiNuclearChannel) {
      setAiError("Select a nuclear channel for MIF inference.");
      return;
    }

    if (aiMode === "mif" && !aiMembraneChannels.length) {
      setAiError("Select at least one membrane channel for MIF inference.");
      return;
    }

    setIsRunningAi(true);
    setAiError("");

    try {
      const payload = {
        roi: {
          x: selectedRoiAnnotation.x,
          y: selectedRoiAnnotation.y,
          width: selectedRoiAnnotation.width,
          height: selectedRoiAnnotation.height,
        },
        mode: aiMode,
        model_name: "flex",
        checkpoint_name: "vitamin_p_flex.pth",
        device: "cpu",
        branches:
          aiMode === "mif"
            ? ["mif_nuclei", "mif_cell"]
            : ["he_nuclei", "he_cell"],
        batch_size: 1,
        filter_tissue: false,
        save_visualization: false,
        mif_channel_config:
          aiMode === "mif"
            ? {
                nuclear_channel: Number(aiNuclearChannel),
                membrane_channel: aiMembraneChannels.map(Number),
                membrane_combination: aiMembraneCombination || "max",
                channel_names: Object.fromEntries(
                  normalizedChannels.map((ch) => [ch.index, ch.name])
                ),
              }
            : null,
      };

      const result = await runRoiAiSegmentation(
        selectedSlide.path,
        payload,
        selectedSlide.sourceId || currentSourceId
      );

      setAiLayersBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: result.layers || [],
      }));
    } catch (err) {
      console.error("ROI AI failed:", err);
      setAiError(err.message || "ROI AI failed");
    } finally {
      setIsRunningAi(false);
    }
  };

  const handleSlideChange = (event) => {
    const nextSlidePath = event.target.value;
    if (!nextSlidePath || nextSlidePath === selectedSlide?.path) return;
    navigate(
      `/viewer/${encodeURIComponent(nextSlidePath)}?source_id=${encodeURIComponent(
        currentSourceId
      )}`
    );
  };

  const handleShowAllOverlays = () => {
    setShowTopOverlay(true);
    setShowAnnotationToolbar(true);
    setShowZoomControls(true);
    setShowBottomOverlay(true);
    setShowScaleBar(true);
  };

  const handleHideAllOverlays = () => {
    setShowTopOverlay(false);
    setShowAnnotationToolbar(false);
    setShowZoomControls(false);
    setShowBottomOverlay(false);
    setShowScaleBar(false);
  };
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const buildPreviewUrl = (slide) => {
    const slidePath = slide?.path || slide?.name;
    return buildThumbnailUrl(slidePath, {
      max_size: 1600,
      sourceId: slide?.sourceId || currentSourceId,
    });
  };

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
          {useVivViewer ? (
            <ViewerChannelSummarySection
              channels={normalizedChannels}
              selectedChannels={selectedChannels}
            />
          ) : null}

          {useVivViewer && normalizedChannels.length ? (
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

          <AiSettingsPanel
            isOme={isMultichannel}
            channels={normalizedChannels}
            aiMode={aiMode}
            onAiModeChange={setAiMode}
            nuclearChannel={aiNuclearChannel}
            onNuclearChannelChange={setAiNuclearChannel}
            membraneChannels={aiMembraneChannels}
            onMembraneChannelsChange={setAiMembraneChannels}
            membraneCombination={aiMembraneCombination}
            onMembraneCombinationChange={setAiMembraneCombination}
            onResetDefaults={handleResetAiDefaults}
          />

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
                        <button
                          className="viewer-fab-btn"
                          onClick={handleRunAiOnSelectedRoi}
                          type="button"
                          disabled={!selectedRoiAnnotation || isRunningAi}
                          title="Run AI on selected ROI"
                        >
                          🤖
                        </button>
                        <button
                          className="viewer-fab-btn"
                          onClick={handleClearAiLayers}
                          type="button"
                          title="Clear AI overlay"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : null}

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