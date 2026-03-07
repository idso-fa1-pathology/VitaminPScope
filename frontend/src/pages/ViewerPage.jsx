import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSlides, fetchSlideMetadata } from "../api/slides";
import SlideInfo from "../components/SlideInfo";
import ChannelPanel from "../components/ChannelPanel";
import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
import VivViewer from "../viewers/VivViewer";

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

function ViewerPage() {
  const navigate = useNavigate();
  const { slideName } = useParams();

  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideInfo, setSlideInfo] = useState(null);

  const [channelSettings, setChannelSettings] = useState({});
  const [enabledChannelIndexes, setEnabledChannelIndexes] = useState([]);

  useEffect(() => {
    fetchSlides()
      .then((data) => {
        const allSlides = data.slides || [];
        setSlides(allSlides);

        const decodedSlideName = decodeURIComponent(slideName || "");
        const foundSlide = allSlides.find((slide) => slide.name === decodedSlideName);

        setSelectedSlide(foundSlide || null);
      })
      .catch((err) => console.error("Error fetching slides:", err));
  }, [slideName]);

  useEffect(() => {
    if (!selectedSlide) {
      setSlideInfo(null);
      setChannelSettings({});
      setEnabledChannelIndexes([]);
      return;
    }

    fetchSlideMetadata(selectedSlide.name)
      .then((data) => {
        setSlideInfo(data);

        if (data.type === "ome-tiff" && data.channels?.length) {
          const nextSettings = {};

          data.channels.forEach((ch, i) => {
            nextSettings[ch.index] = {
              color: DEFAULT_CHANNEL_PALETTE[i % DEFAULT_CHANNEL_PALETTE.length],
              opacity: 1,
            };
          });

          setChannelSettings(nextSettings);

          const defaultEnabled = data.channels
            .slice(0, Math.min(4, data.channels.length))
            .map((ch) => ch.index);

          setEnabledChannelIndexes(defaultEnabled);
        } else {
          setChannelSettings({});
          setEnabledChannelIndexes([]);
        }
      })
      .catch((err) => {
        console.error("Error loading metadata:", err);
        setSlideInfo(null);
        setChannelSettings({});
        setEnabledChannelIndexes([]);
      });
  }, [selectedSlide]);

  const selectedChannels = useMemo(() => {
    return enabledChannelIndexes
      .map((index) => ({
        index,
        ...(channelSettings[index] || { color: "#ffffff", opacity: 1 }),
      }))
      .sort((a, b) => a.index - b.index);
  }, [enabledChannelIndexes, channelSettings]);

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

  const isOme = slideInfo?.type === "ome-tiff";

  if (!selectedSlide) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#111",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #444",
              background: "#1f1f1f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <h3 style={{ margin: 0 }}>Viewer</h3>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            padding: "24px",
          }}
        >
          Slide not found. Go back to Slide Manager and choose a valid slide.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div
        style={{
          width: "360px",
          borderRight: "1px solid #ccc",
          padding: "1rem",
          backgroundColor: "#f8f9fa",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ← Back to Slide Manager
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 8px 0" }}>Viewer Panel</h2>
          <div style={{ fontSize: "13px", color: "#666", wordBreak: "break-word" }}>
            {selectedSlide.name}
          </div>
        </div>

        <SlideInfo slideInfo={slideInfo} />

        {isOme && slideInfo?.channels?.length ? (
          <ChannelPanel
            channels={slideInfo.channels}
            selectedChannels={selectedChannels}
            channelSettings={channelSettings}
            onToggle={toggleChannel}
            onUpdate={updateChannelSettings}
          />
        ) : null}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid #ccc",
            background: "#fff",
          }}
        >
          <h3 style={{ margin: 0 }}>Slide Viewer</h3>
        </div>

        {isOme ? (
          <VivViewer
            slide={selectedSlide}
            slideInfo={slideInfo}
            selectedChannels={selectedChannels}
          />
        ) : (
          <OpenSeadragonViewer
            slide={selectedSlide}
            slideInfo={slideInfo}
            selectedChannels={selectedChannels}
          />
        )}
      </div>
    </div>
  );
}

export default ViewerPage;