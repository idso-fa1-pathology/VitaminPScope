import { useEffect, useMemo, useState } from "react";
import { fetchSlides, fetchSlideMetadata } from "../api/slides";
import SlideList from "../components/SlideList";
import SlideInfo from "../components/SlideInfo";
import ChannelPanel from "../components/ChannelPanel";
import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
import VivViewer from "../viewers/VivViewer";

const DEFAULT_CHANNEL_PALETTE = [
  "#0000ff", // blue
  "#00ff00", // green
  "#ff0000", // red
  "#ffff00", // yellow
  "#ff00ff", // magenta
  "#00ffff", // cyan
  "#ff9900", // orange
  "#ffffff", // white
  "#8a2be2", // blueviolet
  "#7fff00", // chartreuse
  "#ff69b4", // hotpink
  "#00bfff", // deepskyblue
];

function ViewerPage() {
  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideInfo, setSlideInfo] = useState(null);

  // Stable per-channel settings, persisted for the current slide
  const [channelSettings, setChannelSettings] = useState({});
  // Enabled channels only
  const [enabledChannelIndexes, setEnabledChannelIndexes] = useState([]);

  useEffect(() => {
    fetchSlides()
      .then((data) => setSlides(data.slides || []))
      .catch((err) => console.error("Error fetching slides:", err));
  }, []);

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

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div
        style={{
          width: "360px",
          borderRight: "1px solid #ccc",
          padding: "1rem",
          backgroundColor: "#f8f9fa",
          overflowY: "auto",
        }}
      >
        <SlideList
          slides={slides}
          selectedSlide={selectedSlide}
          onSelect={setSelectedSlide}
        />

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
        <div style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
          <h3>
            Viewer
            {selectedSlide ? ` - ${selectedSlide.name}` : ""}
          </h3>
        </div>

        {!selectedSlide ? (
          <div
            style={{
              flex: 1,
              backgroundColor: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888",
            }}
          >
            Select a slide from the manager to view it.
          </div>
        ) : isOme ? (
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