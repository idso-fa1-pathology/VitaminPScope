import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import { loadOmeTiff, MultiscaleImageLayer } from "@hms-dbmi/viv";
import AnnotationOverlay from "../annotations/AnnotationOverlay";
import { TOOL_AI, TOOL_PAN, TOOL_SELECT } from "../annotations/annotationTypes";
import { getMetersPerPixel, getVivScaleBar } from "./scaleBarUtils";
import AiResultOverlay from "../overlays/AiResultOverlay";
import ViewerMiniMap from "../components/ViewerMiniMap";
const API_BASE = import.meta.env.VITE_BACKEND_URL || "/api";

const ORTHO_VIEW = new OrthographicView({ id: "ortho" });

const DECK_CONTROLLER = {
  dragPan: true,
  scrollZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
  touchRotate: false,
};

function hexToRgb(hex) {
  if (!hex) return [255, 255, 255];

  const clean = String(hex).replace("#", "");
  const expanded =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const r = parseInt(expanded.slice(0, 2), 16) || 255;
  const g = parseInt(expanded.slice(2, 4), 16) || 255;
  const b = parseInt(expanded.slice(4, 6), 16) || 255;
  return [r, g, b];
}

function fallbackContrastLimits(dtype) {
  const normalized = String(dtype || "").toLowerCase();

  if (normalized === "uint16") return [0, 12000];
  if (normalized === "uint8") return [0, 220];
  return [0, 1];
}

function getManualInitialViewState(width, height, imageWidth, imageHeight) {
  const safeWidth = Math.max(width || 1, 1);
  const safeHeight = Math.max(height || 1, 1);
  const safeImageWidth = Math.max(imageWidth || 1, 1);
  const safeImageHeight = Math.max(imageHeight || 1, 1);

  const zoomX = Math.log2(safeWidth / safeImageWidth);
  const zoomY = Math.log2(safeHeight / safeImageHeight);
  const zoom = Math.min(zoomX, zoomY);

  return {
    target: [safeImageWidth / 2, safeImageHeight / 2, 0],
    zoom,
    minZoom: zoom - 4,
    maxZoom: zoom + 8,
  };
}

function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[clamp(index, 0, sorted.length - 1)];
}

function computeAutoFromImage(img) {
  const maxSide = 160;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { autoLow: 0, autoHigh: 255 };
  }

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const luminance = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance.push(y);
  }

  if (!luminance.length) {
    return { autoLow: 0, autoHigh: 255 };
  }

  luminance.sort((a, b) => a - b);

  let autoLow = percentile(luminance, 2);
  let autoHigh = percentile(luminance, 98);

  if (autoHigh <= autoLow + 2) {
    autoLow = 0;
    autoHigh = 255;
  }

  return { autoLow, autoHigh };
}

function buildCanvasFilterString(adjustments, autoWindow) {
  if (!adjustments) return "none";

  let brightness = 1 + (adjustments.brightness || 0) / 100;
  let contrast = adjustments.contrast ?? 1;
  const saturation = adjustments.saturation ?? 1;
  const grayscale = adjustments.grayscale ? 1 : 0;
  const invert = adjustments.invert ? 1 : 0;

  if (adjustments.auto && autoWindow) {
    const span = Math.max(1, autoWindow.autoHigh - autoWindow.autoLow);
    const contrastBoost = clamp(255 / span, 0.8, 3);
    const brightnessOffset = clamp(
      ((127.5 - (autoWindow.autoLow + autoWindow.autoHigh) / 2) / 255) * 0.6,
      -0.35,
      0.35
    );

    brightness += brightnessOffset;
    contrast *= contrastBoost;
  }

  brightness = clamp(brightness, 0, 4);
  contrast = clamp(contrast, 0, 4);

  const parts = [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
  ];

  if (Math.abs(saturation - 1) > 0.001) {
    parts.push(`saturate(${clamp(saturation, 0, 4).toFixed(3)})`);
  }

  if (grayscale > 0) {
    parts.push(`grayscale(1)`);
  }

  if (invert > 0) {
    parts.push(`invert(1)`);
  }

  return parts.join(" ");
}

function percentileFromSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  );
  return sorted[idx];
}

async function estimateContrastFromThumbnail(thumbnailUrl, dtype) {
  if (typeof window === "undefined") {
    return fallbackContrastLimits(dtype);
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = thumbnailUrl;
  });

  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) return fallbackContrastLimits(dtype);

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const samples = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    samples.push(lum);
  }

  if (!samples.length) return fallbackContrastLimits(dtype);

  samples.sort((a, b) => a - b);

  const p1 = percentileFromSorted(samples, 1);
  const p995 = percentileFromSorted(samples, 99.5);

  let lower8 = Math.max(0, p1 * 0.85);
  let upper8 = Math.min(255, p995 * 0.82);

  if (upper8 <= lower8 + 2) {
    upper8 = Math.min(255, lower8 + 32);
  }

  const normalized = String(dtype || "").toLowerCase();

  if (normalized === "uint16") {
    const scale16 = 65535 / 255;
    return [Math.round(lower8 * scale16), Math.round(upper8 * scale16)];
  }

  if (normalized === "uint8") {
    return [Math.round(lower8), Math.round(upper8)];
  }

  return [0, 1];
}

function getBandCount(slideInfo) {
  const metadataBandCount = Number(slideInfo?.metadata?.bandCount);
  const rootBandCount = Number(slideInfo?.bandCount);

  if (Number.isFinite(metadataBandCount) && metadataBandCount > 0) {
    return metadataBandCount;
  }

  if (Number.isFinite(rootBandCount) && rootBandCount > 0) {
    return rootBandCount;
  }

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

function buildPerChannelContrastMap(channels, limits) {
  const map = {};
  for (const ch of channels || []) {
    map[ch.index] = limits;
  }
  return map;
}

function getContainerSize(node) {
  return {
    width: Math.max(node?.clientWidth || 1200, 1),
    height: Math.max(node?.clientHeight || 800, 1),
  };
}

function getVivViewportState(viewState, containerSize, slideInfo) {
  if (!viewState || !containerSize?.width || !containerSize?.height || !slideInfo?.metadata) {
    return null;
  }

  const imageWidth = slideInfo.metadata.sizeX || 1;
  const imageHeight = slideInfo.metadata.sizeY || 1;
  const zoom = viewState.zoom ?? 0;
  const scale = Math.pow(2, zoom);

  const visibleWidth = containerSize.width / scale;
  const visibleHeight = containerSize.height / scale;

  const centerX = viewState.target?.[0] ?? imageWidth / 2;
  const centerY = viewState.target?.[1] ?? imageHeight / 2;

  return {
    x: (centerX - visibleWidth / 2) / imageWidth,
    y: (centerY - visibleHeight / 2) / imageHeight,
    width: visibleWidth / imageWidth,
    height: visibleHeight / imageHeight,
  };
}

function viewportStatesAreClose(a, b, slideInfo, pixelTolerance = 2) {
  if (!a || !b || !slideInfo?.metadata) return false;

  const imageWidth = slideInfo.metadata.sizeX || 1;
  const imageHeight = slideInfo.metadata.sizeY || 1;

  const dx = Math.abs(a.x - b.x) * imageWidth;
  const dy = Math.abs(a.y - b.y) * imageHeight;
  const dw = Math.abs(a.width - b.width) * imageWidth;
  const dh = Math.abs(a.height - b.height) * imageHeight;

  return (
    dx <= pixelTolerance &&
    dy <= pixelTolerance &&
    dw <= pixelTolerance &&
    dh <= pixelTolerance
  );
}

const VivViewer = forwardRef(function VivViewer(
  {
    slide,
    slideInfo,
    sourceId = "default",
    selectedChannels,
    activeTool = TOOL_PAN,
    annotations = [],
    aiLayers = [],
    onAddAnnotation,
    onUpdateAnnotation,
    onDeleteAnnotation,
    selectedAnnotationId,
    onSelectAnnotation,
    annotationColor,
    imageAdjustments,
    buildPreviewUrl,
    showMiniMap = true,
    miniMapWidth = 180,
    miniMapMaxHeight = 220,
    onViewportChange,
    onInteractionStart,
    onInteractionEnd,
  },
  ref
) {
  const containerRef = useRef(null);
  const currentSlideRef = useRef(null);
  const hideThumbRafRef = useRef(null);
  const stableRenderCountRef = useRef(0);
  const startupSessionRef = useRef(0);
  const contrastReadyRef = useRef(false);
  const vivStableRef = useRef(false);
  const autoRequestRef = useRef(0);
  const suppressOutgoingSyncRef = useRef(false);
  const suppressTimeoutRef = useRef(null);
  const lastSentViewportRef = useRef(null);
  const lastAppliedViewportRef = useRef(null);

  const [loader, setLoader] = useState(null);
  const [deckInitialViewState, setDeckInitialViewState] = useState(null);
  const [viewState, setViewState] = useState(null);
  const [contrastByChannel, setContrastByChannel] = useState({});
  const [loading, setLoading] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [error, setError] = useState("");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [autoWindow, setAutoWindow] = useState(null);

  const sourceUrl = useMemo(() => {
    if (!slide) return null;
  
    const slidePath = slide.path || slide.name;
    const path = `${API_BASE}/slide/${encodeURIComponent(
      slidePath
    )}/source?source_id=${encodeURIComponent(sourceId)}`;
  
    return new URL(path, window.location.origin).toString();
  }, [slide, sourceId]);

  const thumbnailUrl = useMemo(() => {
    if (!slide) return null;

    const slidePath = slide.path || slide.name;
    return `${API_BASE}/slide/${encodeURIComponent(
      slidePath
    )}/thumbnail?max_size=1400&source_id=${encodeURIComponent(sourceId)}`;
  }, [slide, sourceId]);

  const normalizedChannels = useMemo(() => normalizeChannels(slideInfo), [slideInfo]);

  const selectedChannelsSignature = useMemo(() => {
    const list = Array.isArray(selectedChannels) ? selectedChannels : [];
    return list
      .map((ch) => `${ch.index}:${ch.color || "none"}:${ch.opacity ?? 1}`)
      .sort()
      .join("|");
  }, [selectedChannels]);

  const activeChannels = useMemo(() => {
    const list = Array.isArray(selectedChannels) ? selectedChannels : [];
    return list
      .filter((ch) => ch?.index !== undefined && ch?.index !== null)
      .map((ch) => ({
        index: Number(ch.index),
        color: ch.color ?? null,
        opacity: ch.opacity ?? 1,
      }))
      .filter((ch) => Number.isFinite(ch.index))
      .sort((a, b) => a.index - b.index);
  }, [selectedChannelsSignature]);

  const coloredThumbnailUrls = useMemo(() => {
    if (!slide || !activeChannels.length) return [];

    const slidePath = slide.path || slide.name;

    return activeChannels.map((ch) => ({
      index: ch.index,
      color: ch.color,
      opacity: ch.opacity ?? 1,
      url:
      `${API_BASE}/slide/${encodeURIComponent(
        slidePath
      )}/thumbnail?max_size=1400&frame=${encodeURIComponent(
        ch.index
      )}${
        ch.color ? `&color=${encodeURIComponent(ch.color)}` : ""
      }&source_id=${encodeURIComponent(sourceId)}`,
    }));
  }, [slide, activeChannels, sourceId]);

  const contrastSignature = useMemo(() => {
    const keys = Object.keys(contrastByChannel)
      .map((k) => Number(k))
      .sort((a, b) => a - b);

    return keys
      .map((k) => {
        const limits = contrastByChannel[k] || [];
        return `${k}:${limits[0] ?? ""}:${limits[1] ?? ""}`;
      })
      .join("|");
  }, [contrastByChannel]);

  const startupLayerSignature = useMemo(() => {
    return [
      sourceId,
      slide?.path || slide?.name || "",
      loader ? "loader-ready" : "loader-empty",
      selectedChannelsSignature,
      contrastSignature,
    ].join("||");
  }, [sourceId, slide?.path, slide?.name, loader, selectedChannelsSignature, contrastSignature]);

  const canvasFilter = useMemo(() => {
    return buildCanvasFilterString(imageAdjustments, autoWindow);
  }, [imageAdjustments, autoWindow]);

  const renderOpacity = useMemo(() => {
    if (Math.abs((imageAdjustments?.gamma ?? 1) - 1) > 0.001) {
      const gamma = clamp(imageAdjustments.gamma ?? 1, 0.4, 2.5);
      return clamp(Math.pow(1 / gamma, 0.7), 0.65, 1);
    }

    return 1;
  }, [imageAdjustments?.gamma]);

  const vivScaleBar = useMemo(() => {
    const metersPerPixel = getMetersPerPixel(slideInfo);

    return getVivScaleBar({
      viewState,
      containerWidth: containerSize.width,
      metersPerPixel,
    });
  }, [slideInfo, viewState, containerSize.width]);

  const miniMapViewportRect = useMemo(() => {
    const imageWidth = slideInfo?.metadata?.sizeX || 1;
    const imageHeight = slideInfo?.metadata?.sizeY || 1;

    if (!viewState || !containerSize.width || !containerSize.height) {
      return {
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
      };
    }

    const zoom = viewState.zoom ?? 0;
    const scale = Math.pow(2, zoom);

    const visibleWidth = containerSize.width / scale;
    const visibleHeight = containerSize.height / scale;

    const targetX = viewState.target?.[0] ?? imageWidth / 2;
    const targetY = viewState.target?.[1] ?? imageHeight / 2;

    return {
      x: targetX - visibleWidth / 2,
      y: targetY - visibleHeight / 2,
      width: visibleWidth,
      height: visibleHeight,
    };
  }, [slideInfo, viewState, containerSize.width, containerSize.height]);

  const imageToScreen = useCallback(
    (point) => {
      const width = containerSize.width || 1;
      const height = containerSize.height || 1;
      const zoom = viewState?.zoom ?? 0;
      const scale = Math.pow(2, zoom);
      const targetX = viewState?.target?.[0] ?? 0;
      const targetY = viewState?.target?.[1] ?? 0;

      return {
        x: (point.x - targetX) * scale + width / 2,
        y: (point.y - targetY) * scale + height / 2,
      };
    },
    [containerSize.width, containerSize.height, viewState]
  );

  const screenToImage = useCallback(
    (point) => {
      const width = containerSize.width || 1;
      const height = containerSize.height || 1;
      const zoom = viewState?.zoom ?? 0;
      const scale = Math.pow(2, zoom);
      const targetX = viewState?.target?.[0] ?? 0;
      const targetY = viewState?.target?.[1] ?? 0;

      return {
        x: (point.x - width / 2) / scale + targetX,
        y: (point.y - height / 2) / scale + targetY,
      };
    },
    [containerSize.width, containerSize.height, viewState]
  );

  const clearSuppressionLater = useCallback(() => {
    if (suppressTimeoutRef.current) {
      clearTimeout(suppressTimeoutRef.current);
    }

    suppressTimeoutRef.current = setTimeout(() => {
      suppressOutgoingSyncRef.current = false;
    }, 120);
  }, []);

  const handleMiniMapNavigate = useCallback(
    (point) => {
      onInteractionStart?.();

      setViewState((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          target: [point.x, point.y, 0],
        };
      });

      requestAnimationFrame(() => {
        onInteractionEnd?.();
      });
    },
    [onInteractionStart, onInteractionEnd]
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        setViewState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            zoom: Math.min(prev.maxZoom ?? prev.zoom + 8, prev.zoom + 0.5),
          };
        });
      },
      zoomOut() {
        setViewState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            zoom: Math.max(prev.minZoom ?? prev.zoom - 4, prev.zoom - 0.5),
          };
        });
      },
      resetView() {
        setViewState(deckInitialViewState || null);
      },
      getViewportState() {
        return getVivViewportState(viewState, containerSize, slideInfo);
      },
      setViewportState(nextState) {
        if (!nextState || !slideInfo?.metadata || !containerSize.width || !containerSize.height) {
          return;
        }

        const currentState = getVivViewportState(viewState, containerSize, slideInfo);
        if (viewportStatesAreClose(currentState, nextState, slideInfo, 1)) {
          return;
        }

        const imageWidth = slideInfo.metadata.sizeX || 1;
        const imageHeight = slideInfo.metadata.sizeY || 1;

        const visibleWidth = Math.max(0.0001, nextState.width || 1) * imageWidth;
        const visibleHeight = Math.max(0.0001, nextState.height || 1) * imageHeight;

        const centerX = ((nextState.x ?? 0) * imageWidth) + visibleWidth / 2;
        const centerY = ((nextState.y ?? 0) * imageHeight) + visibleHeight / 2;

        const zoomX = Math.log2(containerSize.width / visibleWidth);
        const zoomY = Math.log2(containerSize.height / visibleHeight);
        const zoom = Math.min(zoomX, zoomY);

        suppressOutgoingSyncRef.current = true;
        lastAppliedViewportRef.current = nextState;

        setViewState((prev) => {
          const base = prev || deckInitialViewState || {};
          return {
            ...base,
            target: [centerX, centerY, 0],
            zoom,
          };
        });

        clearSuppressionLater();
      },
    }),
    [clearSuppressionLater, deckInitialViewState, viewState, containerSize, slideInfo]
  );

  useEffect(() => {
    return () => {
      if (hideThumbRafRef.current) {
        cancelAnimationFrame(hideThumbRafRef.current);
      }

      if (suppressTimeoutRef.current) {
        clearTimeout(suppressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      const node = containerRef.current;
      setContainerSize({
        width: node?.clientWidth || 0,
        height: node?.clientHeight || 0,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!slide || !slideInfo || !buildPreviewUrl || !imageAdjustments?.auto) {
      setAutoWindow(null);
      return;
    }

    const url = buildPreviewUrl(slide);
    if (!url) {
      setAutoWindow(null);
      return;
    }

    const requestId = autoRequestRef.current + 1;
    autoRequestRef.current = requestId;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (autoRequestRef.current !== requestId) return;

      try {
        setAutoWindow(computeAutoFromImage(img));
      } catch {
        setAutoWindow({ autoLow: 0, autoHigh: 255 });
      }
    };

    img.onerror = () => {
      if (autoRequestRef.current !== requestId) return;
      setAutoWindow({ autoLow: 0, autoHigh: 255 });
    };

    img.src = url;
  }, [slide, slideInfo, imageAdjustments?.auto, buildPreviewUrl]);

  useEffect(() => {
    if (!slide || !slideInfo || !sourceUrl || !containerRef.current) return;

    let cancelled = false;
    const mySession = startupSessionRef.current + 1;
    startupSessionRef.current = mySession;

    const slideChanged = currentSlideRef.current !== slide.name;

    if (slideChanged) {
      currentSlideRef.current = slide.name;
      stableRenderCountRef.current = 0;
      contrastReadyRef.current = false;
      vivStableRef.current = false;

      if (hideThumbRafRef.current) {
        cancelAnimationFrame(hideThumbRafRef.current);
        hideThumbRafRef.current = null;
      }

      setShowThumbnail(true);
      setLoader(null);
      setDeckInitialViewState(null);
      setViewState(null);
      setContrastByChannel({});
      setError("");
    }

    async function init() {
      try {
        setLoading(true);
        setError("");

        const dtype = slideInfo.metadata?.dtype;
        const fastDefault = fallbackContrastLimits(dtype);

        setContrastByChannel(buildPerChannelContrastMap(normalizedChannels, fastDefault));

        const contrastPromise = new Promise((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              estimateContrastFromThumbnail(thumbnailUrl, dtype)
                .then((estimatedLimits) => {
                  if (cancelled || startupSessionRef.current !== mySession) return;
        
                  setContrastByChannel(
                    buildPerChannelContrastMap(normalizedChannels, estimatedLimits)
                  );
                })
                .catch(() => {})
                .finally(() => {
                  if (cancelled || startupSessionRef.current !== mySession) return;
                  contrastReadyRef.current = true;
                  resolve();
                });
            }, 150);
          });
        });
        
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const loaded = await loadOmeTiff(sourceUrl);
        
        if (cancelled || startupSessionRef.current !== mySession) return;

        const loaderArray = loaded?.data;
        if (!Array.isArray(loaderArray) || loaderArray.length === 0) {
          throw new Error("OME-TIFF loaded, but Viv returned no image data.");
        }

        setLoader(loaderArray);

        const { width, height } = getContainerSize(containerRef.current);
        const imageWidth = slideInfo.metadata?.sizeX || 1;
        const imageHeight = slideInfo.metadata?.sizeY || 1;

        const initial = getManualInitialViewState(width, height, imageWidth, imageHeight);

        setDeckInitialViewState(initial);
        setViewState(initial);

        setLoading(false);
        
      } catch (e) {
        if (cancelled || startupSessionRef.current !== mySession) return;

        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        setShowThumbnail(true);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [slide?.name, slide?.path, sourceId, sourceUrl, thumbnailUrl, slideInfo, normalizedChannels]);

  useEffect(() => {
    if (!showThumbnail) return;
    stableRenderCountRef.current = 0;
    vivStableRef.current = false;
  }, [startupLayerSignature, showThumbnail]);

  useEffect(() => {
    if (!activeChannels.length) {
      stableRenderCountRef.current = 0;
      vivStableRef.current = false;
    }
  }, [activeChannels.length]);

  const layer = useMemo(() => {
    if (!loader || !slideInfo || !activeChannels.length) return null;

    const dtype = slideInfo.metadata?.dtype;

    const selections = activeChannels.map((ch) => ({
      c: ch.index,
      z: 0,
      t: 0,
    }));

    const colors = activeChannels.map((ch) => hexToRgb(ch.color));

    const contrastLimits = activeChannels.map(
      (ch) => contrastByChannel[ch.index] || fallbackContrastLimits(dtype)
    );

    return new MultiscaleImageLayer({
      id: `viv-layer-${sourceId}-${slide.path || slide.name}`,
      loader,
      selections,
      colors,
      contrastLimits,
      channelsVisible: activeChannels.map(() => true),
      pickable: false,
      opacity: 1,
    });
  }, [
    loader,
    slide?.name,
    slideInfo,
    activeChannels,
    contrastByChannel,
    contrastSignature,
  ]);

  const handleAfterRender = useCallback(() => {
    if (!showThumbnail) return;
    if (!loader || !layer || !activeChannels.length) return;
    if (!contrastReadyRef.current) return;
    if (!layer.isLoaded) return;

    stableRenderCountRef.current += 1;

    if (stableRenderCountRef.current < 3) return;

    vivStableRef.current = true;

    if (hideThumbRafRef.current) return;

    hideThumbRafRef.current = requestAnimationFrame(() => {
      hideThumbRafRef.current = null;
      if (vivStableRef.current) {
        setShowThumbnail(false);
      }
    });
  }, [showThumbnail, loader, layer, activeChannels.length]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyFilter = () => {
      const canvases = Array.from(container.querySelectorAll("canvas"));
      const deckCanvas = canvases.find((node) => node.width > 0 && node.height > 0);

      if (!deckCanvas) return;

      deckCanvas.style.filter = canvasFilter || "none";
      deckCanvas.style.opacity = String(renderOpacity);
      deckCanvas.style.transformOrigin = "0 0";
    };

    applyFilter();
    const raf = requestAnimationFrame(applyFilter);

    return () => {
      cancelAnimationFrame(raf);

      const canvases = Array.from(container.querySelectorAll("canvas"));
      const deckCanvas = canvases.find((node) => node.width > 0 && node.height > 0);

      if (deckCanvas) {
        deckCanvas.style.filter = "none";
        deckCanvas.style.opacity = "1";
      }
    };
  }, [canvasFilter, renderOpacity, loader, viewState, activeChannels.length]);

  if (!slide || !slideInfo) {
    return <div style={{ flex: 1, background: "#111" }} />;
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          background: "#111",
          color: "#ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        Failed to load OME-TIFF.
        <br />
        {error}
      </div>
    );
  }

  const canMountDeck = Boolean(loader && deckInitialViewState && viewState);
  const controller =
    activeTool === TOOL_PAN || activeTool === TOOL_AI
      ? DECK_CONTROLLER
      : {
          ...DECK_CONTROLLER,
          dragPan: false,
          scrollZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
        };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        background: "#111",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {showThumbnail && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            opacity: showThumbnail ? 0.98 * renderOpacity : 0,
            transition: "opacity 180ms ease",
            pointerEvents: "none",
            filter: canvasFilter || "none",
            transformOrigin: "0 0",
          }}
        >
          {activeChannels.length ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#000",
                filter: canvasFilter || "none",
                opacity: renderOpacity,
                transformOrigin: "0 0",
              }}
            >
              {coloredThumbnailUrls.map((thumb) => (
                <img
                  src={thumbnailUrl}
                  alt="thumbnail"
                  decoding="async"
                  loading="eager"
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    pointerEvents: "none",
                    userSelect: "none",
                    filter: canvasFilter || "none",
                    opacity: renderOpacity,
                    transformOrigin: "0 0",
                  }}
                />
              ))}
            </div>
          ) : (
            <img
              src={thumbnailUrl}
              alt="thumbnail"
              decoding="async"
              loading="eager"
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          )}
        </div>
      )}

      {!activeChannels.length && normalizedChannels.length > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            zIndex: 4,
          }}
        >
          No channels selected.
        </div>
      )}

      {!activeChannels.length && normalizedChannels.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            zIndex: 4,
            textAlign: "center",
            padding: "1rem",
          }}
        >
          No channel metadata detected for this OME-TIFF.
        </div>
      )}

      {canMountDeck && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
        >
          <DeckGL
            key={`${sourceId}-${slide.path || slide.name}`}
            views={ORTHO_VIEW}
            controller={controller}
            initialViewState={deckInitialViewState}
            viewState={viewState}
            onViewStateChange={({ viewState: nextViewState, interactionState }) => {
              setViewState(nextViewState);

              if (
                interactionState?.isDragging ||
                interactionState?.isPanning ||
                interactionState?.isZooming ||
                interactionState?.inTransition
              ) {
                onInteractionStart?.();
              } else {
                onInteractionEnd?.();
              }

              if (suppressOutgoingSyncRef.current) {
                return;
              }

              const state = getVivViewportState(nextViewState, containerSize, slideInfo);
              if (!state) return;

              if (viewportStatesAreClose(state, lastAppliedViewportRef.current, slideInfo, 1)) {
                return;
              }

              if (viewportStatesAreClose(state, lastSentViewportRef.current, slideInfo, 0.5)) {
                return;
              }

              lastSentViewportRef.current = state;
              onViewportChange?.(state);
            }}
            onAfterRender={handleAfterRender}
            layers={layer ? [layer] : []}
            getCursor={() => {
              if (activeTool === TOOL_PAN || activeTool === TOOL_AI) return "grab";
              if (activeTool === TOOL_SELECT) return "default";
              return "crosshair";
            }}
            useDevicePixels={getDevicePixelRatio()}
          />
        </div>
      )}

      {showMiniMap && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 7,
          }}
        >
          <ViewerMiniMap
            imageWidth={slideInfo?.metadata?.sizeX}
            imageHeight={slideInfo?.metadata?.sizeY}
            viewportRect={miniMapViewportRect}
            onNavigate={handleMiniMapNavigate}
            width={miniMapWidth}
            maxHeight={miniMapMaxHeight}
            minWidth={120}
            title="Overview"
          >
            {activeChannels.length ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#000",
                  filter: canvasFilter || "none",
                  opacity: renderOpacity,
                  transformOrigin: "0 0",
                }}
              >
                {coloredThumbnailUrls.map((thumb) => (
                  <img
                    key={`minimap-${thumb.index}-${thumb.color}-${thumb.opacity}`}
                    src={thumb.url}
                    alt={`minimap-channel-${thumb.index}`}
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      mixBlendMode: "screen",
                      opacity: Math.max(0.05, Math.min(1, thumb.opacity)),
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  />
                ))}
              </div>
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="overview"
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  userSelect: "none",
                  filter: canvasFilter || "none",
                  opacity: renderOpacity,
                  transformOrigin: "0 0",
                }}
              />
            ) : null}
          </ViewerMiniMap>
        </div>
      )}


      <AiResultOverlay
        layers={aiLayers}
        imageToScreen={imageToScreen}
      />

      <AnnotationOverlay
        activeTool={activeTool}
        annotations={annotations}
        onAddAnnotation={onAddAnnotation}
        onUpdateAnnotation={onUpdateAnnotation}
        onDeleteAnnotation={onDeleteAnnotation}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
        color={annotationColor}
        imageToScreen={imageToScreen}
        screenToImage={screenToImage}
        metersPerPixel={getMetersPerPixel(slideInfo)}
      />

      {vivScaleBar && (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            zIndex: 6,
            background: "rgba(15, 23, 42, 0.72)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 10,
            padding: "8px 10px 6px",
            backdropFilter: "blur(6px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              letterSpacing: "0.02em",
            }}
          >
            {vivScaleBar.label}
          </div>

          <div
            style={{
              width: `${Math.max(40, Math.min(220, vivScaleBar.widthPx))}px`,
              height: 0,
              borderTop: "3px solid #fff",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: -5,
                width: 0,
                height: 10,
                borderLeft: "2px solid #fff",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 0,
                top: -5,
                width: 0,
                height: 10,
                borderLeft: "2px solid #fff",
              }}
            />
          </div>
        </div>
      )}

      {loading && (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 6,
            zIndex: 5,
            fontSize: 12,
          }}
        >
          Loading OME-TIFF...
        </div>
      )}
    </div>
  );
});

export default VivViewer;