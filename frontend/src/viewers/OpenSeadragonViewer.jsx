import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import OpenSeadragon from "openseadragon";
import { buildTileUrl } from "../api/slides";

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

const OpenSeadragonViewer = forwardRef(function OpenSeadragonViewer(
  { slide, slideInfo, selectedChannels, activeTool = "pan" },
  ref
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

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
    });

    viewerRef.current = viewer;

    if (!isOme) {
      viewer.open(makeTileSource(slidePath, metadata));

      viewer.addOnceHandler("open", () => {
        viewer.viewport.goHome(true);
      });

      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    }

    if (!selectedChannels.length) {
      viewer.open(
        makeTileSource(slidePath, metadata, {
          frame: 0,
          color: "ffffff",
        })
      );

      viewer.addOnceHandler("open", () => {
        viewer.viewport.goHome(true);
      });

      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    }

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
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [slide, slideInfo, selectedChannels]);

  useEffect(() => {
    if (!viewerRef.current) return;

    const isPanMode = activeTool === "pan";

    viewerRef.current.setMouseNavEnabled(isPanMode);

    if (containerRef.current) {
      let cursor = "default";

      if (activeTool === "pan") cursor = "grab";
      if (activeTool === "measure") cursor = "crosshair";
      if (activeTool === "annotate") cursor = "crosshair";
      if (activeTool === "ai") cursor = "cell";

      containerRef.current.style.cursor = cursor;
    }
  }, [activeTool]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 500,
        backgroundColor: "#111",
      }}
    />
  );
});

export default OpenSeadragonViewer;