import { useEffect, useRef } from "react";
import OpenSeadragon from "openseadragon";
import { buildTileUrl } from "../api/slides";

function makeTileSource(slideName, metadata, options = {}) {
  return new OpenSeadragon.TileSource({
    height: metadata.sizeY,
    width: metadata.sizeX,
    tileSize: metadata.tileWidth || 256,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: metadata.levels - 1,
    getTileUrl(level, x, y) {
      return buildTileUrl(slideName, level, x, y, options);
    },
  });
}

function OpenSeadragonViewer({ slide, slideInfo, selectedChannels }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!slide || !slideInfo || !containerRef.current) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const metadata = slideInfo.metadata;
    const isOme = slideInfo.type === "ome-tiff";

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
    });

    viewerRef.current = viewer;

    if (!isOme) {
      viewer.open(makeTileSource(slide.name, metadata));
      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    }

    if (!selectedChannels.length) {
      viewer.open(makeTileSource(slide.name, metadata, { frame: 0, color: "ffffff" }));
      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    }

    viewer.open(
      makeTileSource(slide.name, metadata, {
        frame: selectedChannels[0].index,
        color: selectedChannels[0].color,
      })
    );

    viewer.addOnceHandler("open", () => {
      viewer.world.getItemAt(0).setOpacity(selectedChannels[0].opacity);

      selectedChannels.slice(1).forEach((ch) => {
        viewer.addTiledImage({
          tileSource: makeTileSource(slide.name, metadata, {
            frame: ch.index,
            color: ch.color,
          }),
          opacity: ch.opacity,
        });
      });
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [slide, slideInfo, selectedChannels]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, backgroundColor: "#111", width: "100%", height: "100%" }}
    />
  );
}

export default OpenSeadragonViewer;