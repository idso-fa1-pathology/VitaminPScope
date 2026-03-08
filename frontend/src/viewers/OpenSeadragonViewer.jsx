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
  return new OpenSeadragon.TileSource({
    height: metadata.sizeY,
    width: metadata.sizeX,
    tileSize: metadata.tileWidth || 256,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: Math.max((metadata.levels || 1) - 1, 0),
    getTileUrl(level, x, y) {
      return buildTileUrl(slideName, level, x, y, options);
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

const OpenSeadragonViewer = forwardRef(function OpenSeadragonViewer(
  {
    slide,
    slideInfo,
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
  },
  ref
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  const [zoomState, setZoomState] = useState({
    viewportZoom: null,
    imageZoom: null,
  });

  useImperativeHandle(ref, () => ({
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
      viewerRef.current.viewport.goHome();
    },
  }));

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
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
      visibilityRatio: 1,
      zoomPerScroll: 2,
      showNavigator: true,
      showNavigationControl: false,
      crossOriginPolicy: "Anonymous",
      ajaxWithCredentials: false,
      drawer: "canvas",
    });

    viewerRef.current = viewer;
    window.__osdViewer = viewer;

    function updateZoomState() {
      if (!viewer.viewport) return;

      const viewportZoom = viewer.viewport.getZoom(true);
      const imageZoom = viewer.viewport.viewportToImageZoom(viewportZoom);

      setZoomState({
        viewportZoom,
        imageZoom,
      });
    }

    viewer.addHandler("open", () => {
      viewer.viewport.goHome(true);
      updateZoomState();
    });

    viewer.addHandler("zoom", updateZoomState);
    viewer.addHandler("pan", updateZoomState);
    viewer.addHandler("animation", updateZoomState);
    viewer.addHandler("resize", updateZoomState);

    if (!isOme) {
      viewer.open(makeTileSource(slidePath, metadata));
    } else if (!selectedChannels.length) {
      viewer.open(
        makeTileSource(slidePath, metadata, {
          frame: 0,
          color: "ffffff",
        })
      );
    } else {
      viewer.open(
        makeTileSource(slidePath, metadata, {
          frame: selectedChannels[0].index,
          color: selectedChannels[0].color,
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
            }),
            opacity: ch.opacity,
          });
        });

        viewer.viewport.goHome(true);
        updateZoomState();
      });
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [slide, slideInfo, selectedChannels]);

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