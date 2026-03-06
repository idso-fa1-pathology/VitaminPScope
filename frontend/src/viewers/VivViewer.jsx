import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import {
  loadOmeTiff,
  MultiscaleImageLayer,
  getChannelStats,
} from "@hms-dbmi/viv";

function hexToRgbArray(hex, opacity = 1) {
  const clean = (hex || "#ffffff").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;

  return [
    Math.round(r * opacity),
    Math.round(g * opacity),
    Math.round(b * opacity),
  ];
}

function fallbackContrastLimits(dtype) {
  if (dtype === "uint16") return [0, 65535];
  if (dtype === "uint8") return [0, 255];
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

function VivViewer({ slide, slideInfo, selectedChannels }) {
  const containerRef = useRef(null);
  const [loader, setLoader] = useState(null);
  const [viewState, setViewState] = useState(null);
  const [contrastByChannel, setContrastByChannel] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sourceUrl = useMemo(() => {
    if (!slide) return null;
    return `http://localhost:8000/slide/${encodeURIComponent(slide.name)}/source`;
  }, [slide]);

  useEffect(() => {
    if (!slide || !slideInfo || !sourceUrl || !containerRef.current) return;

    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError("");
        setLoader(null);
        setViewState(null);

        const loaded = await loadOmeTiff(sourceUrl);
        if (cancelled) return;

        console.log("Viv loaded object:", loaded);
        console.log("Viv loaded data:", loaded?.data);
        console.log("Viv loaded metadata:", loaded?.metadata);

        const loaderArray = loaded?.data;

        if (!Array.isArray(loaderArray) || !loaderArray.length) {
          throw new Error("OME-TIFF loaded, but Viv returned no image data.");
        }

        const baseLoader =
          loaderArray.find((item) => item && item.shape) || loaderArray[0];

        if (!baseLoader) {
          throw new Error("OME-TIFF loaded, but no usable loader was found.");
        }

        setLoader(loaderArray);

        const width = containerRef.current?.clientWidth || 1200;
        const height = containerRef.current?.clientHeight || 800;
        const imageWidth = slideInfo.metadata?.sizeX || 1;
        const imageHeight = slideInfo.metadata?.sizeY || 1;

        const initial = getManualInitialViewState(
          width,
          height,
          imageWidth,
          imageHeight
        );

        if (!cancelled) {
          setViewState(initial);
        }

        const channels = slideInfo.channels || [];
        const dtype = slideInfo.metadata?.dtype;
        const nextContrast = {};

        if (typeof baseLoader.getRaster === "function") {
          for (const ch of channels) {
            try {
              const raster = await baseLoader.getRaster({
                selection: { c: ch.index, z: 0, t: 0 },
              });

              const stats = getChannelStats(raster.data);
              let limits = stats?.contrastLimits || fallbackContrastLimits(dtype);

              if (
                !Array.isArray(limits) ||
                limits.length !== 2 ||
                limits[0] === limits[1]
              ) {
                limits = stats?.domain || fallbackContrastLimits(dtype);
              }

              nextContrast[ch.index] = limits;
            } catch (e) {
              console.warn(`Failed to get stats for channel ${ch.index}`, e);
              nextContrast[ch.index] = fallbackContrastLimits(dtype);
            }
          }
        } else {
          for (const ch of channels) {
            nextContrast[ch.index] = fallbackContrastLimits(dtype);
          }
        }

        if (!cancelled) {
          setContrastByChannel(nextContrast);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Viv load error:", e);
          setError(String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [slide, slideInfo, sourceUrl]);

  const activeChannels = selectedChannels || [];

  const layer = useMemo(() => {
    if (!loader || !slideInfo) return null;
    if (!Array.isArray(loader) || !loader.length) return null;
    if (!activeChannels.length) return null;

    const selections = activeChannels.map((ch) => ({
      c: ch.index,
      z: 0,
      t: 0,
    }));

    const colors = activeChannels.map((ch) =>
      hexToRgbArray(ch.color, ch.opacity ?? 1)
    );

    const contrastLimits = activeChannels.map(
      (ch) =>
        contrastByChannel[ch.index] ||
        fallbackContrastLimits(slideInfo.metadata?.dtype)
    );

    const channelsVisible = activeChannels.map(() => true);

    return new MultiscaleImageLayer({
      id: `viv-layer-${slide.name}`,
      loader,
      selections,
      colors,
      contrastLimits,
      channelsVisible,
    });
  }, [loader, slideInfo, slide?.name, activeChannels, contrastByChannel]);

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
        Failed to load OME-TIFF in Viv.
        <br />
        {error}
      </div>
    );
  }

  if (!viewState) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: "#111",
          color: "#aaa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? "Loading OME-TIFF..." : "Preparing viewer..."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        background: "#111",
        position: "relative",
      }}
    >
      {!activeChannels.length ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            zIndex: 1,
          }}
        >
          No channels selected.
        </div>
      ) : null}

      <DeckGL
        views={new OrthographicView({ id: "ortho" })}
        controller={true}
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          setViewState(nextViewState);
        }}
        layers={layer ? [layer] : []}
        getCursor={() => "grab"}
      />
    </div>
  );
}

export default VivViewer;