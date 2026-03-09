import { useEffect, useMemo, useState } from "react";
import {
  buildThumbnailUrl,
  fetchSlides,
  fetchSlideMetadata,
} from "../../api/slides";
import {
  DEFAULT_ANNOTATION_COLOR,
  TOOL_PAN,
  TOOL_RECT,
  TOOL_SELECT,
} from "../../annotations/annotationTypes";
import ImageAdjustPanel, {
  DEFAULT_IMAGE_ADJUSTMENTS,
} from "../../components/ImageAdjustPanel";
import {
  buildDefaultChannelSettings,
  getAiBadgeTone,
  isMultichannelSlide,
  isOmeTiffSlide,
  normalizeChannels,
} from "./viewerHelpers";

export function useViewerLogic({
  decodedSlidePath,
  currentSourceId,
  navigate,
  viewerControlsRef,
}) {
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

  const [showTopOverlay, setShowTopOverlay] = useState(true);
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(true);
  const [showZoomControls, setShowZoomControls] = useState(true);
  const [showBottomOverlay, setShowBottomOverlay] = useState(true);
  const [showScaleBar, setShowScaleBar] = useState(true);

  const [showImageAdjustPanel, setShowImageAdjustPanel] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [imageAdjustmentsBySlide, setImageAdjustmentsBySlide] = useState({});

  useEffect(() => {
    if (activeTool !== TOOL_SELECT) {
      setSelectedAnnotationId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    fetchSlides("", currentSourceId)
      .then((data) => {
        setSlides(data.slides || []);
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
        const shouldUseViv = isOmeTiffSlide(data);
        
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
        ...(channelSettings[index] || { color: null, opacity: 1 }),
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
  const useVivViewer = useMemo(() => isOmeTiffSlide(slideInfo), [slideInfo]);

  const imageAdjustments =
    imageAdjustmentsBySlide[slideAnnotationKey] || DEFAULT_IMAGE_ADJUSTMENTS;

  useEffect(() => {
    setSelectedAnnotationId(null);
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
        ...(prev[index] || { color: null, opacity: 1 }),
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

  const handleSetAiLayers = (layers) => {
    if (!slideAnnotationKey) return;

    setAiLayersBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: Array.isArray(layers) ? layers : [],
    }));
  };

  const handleClearAiLayers = () => {
    if (!slideAnnotationKey) return;

    setAiLayersBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: [],
    }));
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

  return {
    ImageAdjustPanel,
    DEFAULT_IMAGE_ADJUSTMENTS,
    slides,
    selectedSlide,
    slideInfo,
    channelSettings,
    enabledChannelIndexes,
    activeTool,
    setActiveTool,
    annotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    selectedAnnotation,
    selectedRoiAnnotation,
    annotationColor,
    setAnnotationColor,
    aiLayers,
    normalizedChannels,
    selectedChannels,
    isMultichannel,
    useVivViewer,
    slideAnnotationKey,
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
    getAiBadgeTone,
  };
}