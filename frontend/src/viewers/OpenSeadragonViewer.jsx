import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import OpenSeadragon from "openseadragon";
import { buildTileUrl } from "../api/slides";
import AnnotationOverlay from "../annotations/AnnotationOverlay";
import { TOOL_AI, TOOL_PAN, TOOL_SELECT } from "../annotations/annotationTypes";
import { getMetersPerPixel } from "./scaleBarUtils";
import AiResultOverlay from "../overlays/AiResultOverlay";

function makeTileSource(slideName, metadata, options = {}) {
  const { sourceId = "default", ...tileOptions } = options;

  return new OpenSeadragon.TileSource({
    height: metadata.sizeY,
    width: metadata.sizeX,
    tileSize: metadata.tileWidth || 256,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: Math.max((metadata.levels || 1) - 1, 0),
    getTileUrl(level, x, y) {
      return buildTileUrl(slideName, level, x, y, {
        ...tileOptions,
        sourceId,
      });
    },
  });
}

function niceScaleBarValue(targetMeters) {
  if (targetMeters <= 0) return 0;

  const exponent = Math.floor(Math.log10(targetMeters));
  const base = targetMeters / Math.pow(10, exponent);

  let niceBase = 1;
  if (base >= 5) niceBase = 5;
  else if (base >= 2) niceBase = 2;

  return niceBase * Math.pow(10, exponent);
}

function formatMetricLength(meters) {
  if (meters >= 0.001) {
    const mm = meters * 1000;
    return `${mm >= 10 ? mm.toFixed(0) : mm.toFixed(1)} mm`;
  }

  if (meters >= 0.000001) {
    const um = meters * 1_000_000;
    return `${um >= 10 ? um.toFixed(0) : um.toFixed(1)} µm`;
  }

  const nm = meters * 1_000_000_000;
  return `${nm.toFixed(0)} nm`;
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

function getOsdViewportState(viewer, slideInfo) {
  if (!viewer?.viewport || !slideInfo?.metadata) return null;

  const imageWidth = slideInfo.metadata.sizeX || 1;
  const imageHeight = slideInfo.metadata.sizeY || 1;
  const bounds = viewer.viewport.getBounds(true);

  const topLeft = viewer.viewport.viewportToImageCoordinates(
    new OpenSeadragon.Point(bounds.x, bounds.y)
  );

  const bottomRight = viewer.viewport.viewportToImageCoordinates(
    new OpenSeadragon.Point(bounds.x + bounds.width, bounds.y + bounds.height)
  );

  return {
    x: topLeft.x / imageWidth,
    y: topLeft.y / imageHeight,
    width: Math.max(0.000001, (bottomRight.x - topLeft.x) / imageWidth),
    height: Math.max(0.000001, (bottomRight.y - topLeft.y) / imageHeight),
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

const OpenSeadragonViewer = forwardRef(function OpenSeadragonViewer(
  {
    slide,
    slideInfo,
    sourceId = "default",
    selectedChannels = [],
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
    onViewportChange,
    onInteractionStart,
    onInteractionEnd,
  },
  ref
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const autoRequestRef = useRef(0);

  const suppressOutgoingSyncRef = useRef(false);
  const suppressTimeoutRef = useRef(null);
  const emitRafRef = useRef(0);
  const lastSentViewportRef = useRef(null);
  const lastAppliedViewportRef = useRef(null);

  const [zoomState, setZoomState] = useState({
    viewportZoom: null,
    imageZoom: null,
  });
  const [autoWindow, setAutoWindow] = useState(null);

  const selectedChannelsKey = useMemo(() => {
    return JSON.stringify(
      (selectedChannels || []).map((ch) => ({
        index: ch.index,
        color: ch.color,
        opacity: ch.opacity,
      }))
    );
  }, [selectedChannels]);

  const clearSuppressionLater = useCallback(() => {
    if (suppressTimeoutRef.current) {
      clearTimeout(suppressTimeoutRef.current);
    }

    suppressTimeoutRef.current = setTimeout(() => {
      suppressOutgoingSyncRef.current = false;
    }, 120);
  }, []);

  const emitViewportNow = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport) return;

    const viewportZoom = viewer.viewport.getZoom(true);
    const imageZoom = viewer.viewport.viewportToImageZoom(viewportZoom);

    setZoomState({
      viewportZoom,
      imageZoom,
    });

    if (suppressOutgoingSyncRef.current) return;

    const state = getOsdViewportState(viewer, slideInfo);
    if (!state) return;

    if (viewportStatesAreClose(state, lastAppliedViewportRef.current, slideInfo, 1)) {
      return;
    }

    if (viewportStatesAreClose(state, lastSentViewportRef.current, slideInfo, 0.5)) {
      return;
    }

    lastSentViewportRef.current = state;
    onViewportChange?.(state);
  }, [onViewportChange, slideInfo]);

  const scheduleEmitViewport = useCallback(() => {
    if (emitRafRef.current) return;

    emitRafRef.current = requestAnimationFrame(() => {
      emitRafRef.current = 0;
      emitViewportNow();
    });
  }, [emitViewportNow]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        if (!viewerRef.current) return;
        viewerRef.current.viewport.zoomBy(1.2);
        viewerRef.current.viewport.applyConstraints();
      },
      zoomOut() {
        if (!viewerRef.current) return;
        viewerRef.current.viewport.zoomBy(0.8);
        viewerRef.current.viewport.applyConstraints();
      },
      resetView() {
        if (!viewerRef.current) return;
        viewerRef.current.viewport.goHome(true);
      },
      getViewportState() {
        return getOsdViewportState(viewerRef.current, slideInfo);
      },
      setViewportState(nextState) {
        const viewer = viewerRef.current;
        if (!viewer?.viewport || !slideInfo?.metadata || !nextState) return;

        const currentState = getOsdViewportState(viewer, slideInfo);
        if (viewportStatesAreClose(currentState, nextState, slideInfo, 1)) {
          return;
        }

        const imageWidth = slideInfo.metadata.sizeX || 1;
        const imageHeight = slideInfo.metadata.sizeY || 1;

        const imageRect = new OpenSeadragon.Rect(
          (nextState.x ?? 0) * imageWidth,
          (nextState.y ?? 0) * imageHeight,
          Math.max(0.0001, (nextState.width ?? 1) * imageWidth),
          Math.max(0.0001, (nextState.height ?? 1) * imageHeight)
        );

        const viewportRect = viewer.viewport.imageToViewportRectangle(imageRect);

        suppressOutgoingSyncRef.current = true;
        lastAppliedViewportRef.current = nextState;

        viewer.viewport.fitBounds(viewportRect, true);
        viewer.viewport.applyConstraints(true);

        clearSuppressionLater();
      },
    }),
    [clearSuppressionLater, slideInfo]
  );

  useEffect(() => {
    if (!slide || !slideInfo || !containerRef.current) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const metadata = slideInfo.metadata;
    const isOme = slideInfo.type === "ome-tiff";
    const slidePath = slide.path || slide.name;

    const viewer = OpenSeadragon({
      element: containerRef.current,
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
      animationTime: 0,
      blendTime: 0,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
      visibilityRatio: 1,
      zoomPerScroll: 1.2,
      showNavigator: true,
      showNavigationControl: false,
      crossOriginPolicy: "Anonymous",
      ajaxWithCredentials: false,
      drawer: "canvas",
    });

    viewerRef.current = viewer;
    window.__osdViewer = viewer;

    const handleOpen = () => {
      viewer.viewport.goHome(true);
      scheduleEmitViewport();
    };

    const handlePan = () => {
      scheduleEmitViewport();
    };

    const handleZoom = () => {
      scheduleEmitViewport();
    };

    const handleResize = () => {
      scheduleEmitViewport();
    };

    const handleCanvasPress = () => {
      onInteractionStart?.();
    };

    const handleCanvasDrag = () => {
      onInteractionStart?.();
    };

    const handleCanvasScroll = () => {
      onInteractionStart?.();
    };

    const handleCanvasRelease = () => {
      onInteractionEnd?.();
    };

    viewer.addHandler("open", handleOpen);
    viewer.addHandler("pan", handlePan);
    viewer.addHandler("zoom", handleZoom);
    viewer.addHandler("resize", handleResize);

    viewer.addHandler("canvas-press", handleCanvasPress);
    viewer.addHandler("canvas-drag", handleCanvasDrag);
    viewer.addHandler("canvas-scroll", handleCanvasScroll);
    viewer.addHandler("canvas-release", handleCanvasRelease);

    if (!isOme) {
      viewer.open(makeTileSource(slidePath, metadata, { sourceId }));
    } else if (!selectedChannels.length) {
      viewer.open(
        makeTileSource(slidePath, metadata, {
          frame: 0,
          color: "ffffff",
          sourceId,
        })
      );
    } else {
      viewer.open(
        makeTileSource(slidePath, metadata, {
          frame: selectedChannels[0].index,
          color: selectedChannels[0].color,
          sourceId,
        })
      );

      viewer.addOnceHandler("open", () => {
        const firstItem = viewer.world.getItemAt(0);

        if (firstItem) {
          firstItem.setOpacity(selectedChannels[0].opacity);
        }

        selectedChannels.slice(1).forEach((ch) => {
          viewer.addTiledImage({
            tileSource: makeTileSource(slidePath, metadata, {
              frame: ch.index,
              color: ch.color,
              sourceId,
            }),
            opacity: ch.opacity,
          });
        });

        viewer.viewport.goHome(true);
        scheduleEmitViewport();
      });
    }

    return () => {
      if (emitRafRef.current) {
        cancelAnimationFrame(emitRafRef.current);
        emitRafRef.current = 0;
      }

      if (suppressTimeoutRef.current) {
        clearTimeout(suppressTimeoutRef.current);
      }

      viewer.removeHandler("open", handleOpen);
      viewer.removeHandler("pan", handlePan);
      viewer.removeHandler("zoom", handleZoom);
      viewer.removeHandler("resize", handleResize);

      viewer.removeHandler("canvas-press", handleCanvasPress);
      viewer.removeHandler("canvas-drag", handleCanvasDrag);
      viewer.removeHandler("canvas-scroll", handleCanvasScroll);
      viewer.removeHandler("canvas-release", handleCanvasRelease);

      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [
    slide,
    slideInfo,
    sourceId,
    selectedChannelsKey,
    scheduleEmitViewport,
    onInteractionStart,
    onInteractionEnd,
    selectedChannels,
  ]);

  useEffect(() => {
    if (!viewerRef.current) return;

    const isPanMode = activeTool === TOOL_PAN || activeTool === TOOL_AI;
    viewerRef.current.setMouseNavEnabled(isPanMode);

    if (containerRef.current) {
      let cursor = "default";

      if (activeTool === TOOL_PAN) cursor = "grab";
      if (activeTool === TOOL_SELECT) cursor = "default";
      if (activeTool === "measure") cursor = "crosshair";
      if (activeTool === "line") cursor = "crosshair";
      if (activeTool === "rect") cursor = "crosshair";
      if (activeTool === "point") cursor = "crosshair";
      if (activeTool === TOOL_AI) cursor = "cell";

      containerRef.current.style.cursor = cursor;
    }
  }, [activeTool]);

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

  const canvasFilter = useMemo(() => {
    return buildCanvasFilterString(imageAdjustments, autoWindow);
  }, [imageAdjustments, autoWindow]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const applyCanvasFilter = () => {
      const canvas = viewer.drawer?.canvas;
      if (!canvas) return;

      canvas.style.filter = canvasFilter || "none";
      canvas.style.transformOrigin = "0 0";

      if (Math.abs((imageAdjustments?.gamma ?? 1) - 1) > 0.001) {
        const gamma = clamp(imageAdjustments.gamma ?? 1, 0.4, 2.5);
        const opacity = clamp(Math.pow(1 / gamma, 0.7), 0.65, 1);
        canvas.style.opacity = String(opacity);
      } else {
        canvas.style.opacity = "1";
      }
    };

    applyCanvasFilter();

    viewer.addHandler("update-viewport", applyCanvasFilter);
    viewer.addHandler("open", applyCanvasFilter);
    viewer.addHandler("tile-drawn", applyCanvasFilter);

    return () => {
      viewer.removeHandler("update-viewport", applyCanvasFilter);
      viewer.removeHandler("open", applyCanvasFilter);
      viewer.removeHandler("tile-drawn", applyCanvasFilter);

      const canvas = viewer.drawer?.canvas;
      if (canvas) {
        canvas.style.filter = "none";
        canvas.style.opacity = "1";
      }
    };
  }, [canvasFilter, imageAdjustments?.gamma]);

  const imageToScreen = useCallback((point) => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport) return { x: 0, y: 0 };

    const p = viewer.viewport.imageToViewerElementCoordinates(
      new OpenSeadragon.Point(point.x, point.y)
    );

    return { x: p.x, y: p.y };
  }, []);

  const screenToImage = useCallback((point) => {
    const viewer = viewerRef.current;
    if (!viewer?.viewport) return null;

    const p = viewer.viewport.viewerElementToImageCoordinates(
      new OpenSeadragon.Point(point.x, point.y)
    );

    return { x: p.x, y: p.y };
  }, []);

  const scaleBar = useMemo(() => {
    const metersPerPixel = getMetersPerPixel(slideInfo);
    const imageZoom = zoomState.imageZoom;

    if (!metersPerPixel || !imageZoom || imageZoom <= 0) return null;

    const metersPerScreenPixel = metersPerPixel / imageZoom;
    const targetPx = 140;
    const targetMeters = targetPx * metersPerScreenPixel;
    const niceMeters = niceScaleBarValue(targetMeters);
    const widthPx = niceMeters / metersPerScreenPixel;

    return {
      label: formatMetricLength(niceMeters),
      widthPx: Math.max(40, Math.min(220, widthPx)),
    };
  }, [slideInfo, zoomState]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 500,
        backgroundColor: "#111",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AiResultOverlay layers={aiLayers} imageToScreen={imageToScreen} />

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

      {scaleBar && (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            zIndex: 20,
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
            {scaleBar.label}
          </div>

          <div
            style={{
              width: `${scaleBar.widthPx}px`,
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
    </div>
  );
});

export default OpenSeadragonViewer;