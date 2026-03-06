import { useEffect, useState } from "react";
import { fetchSlides, fetchSlideMetadata } from "../api/slides";
import SlideList from "../components/SlideList";
import SlideInfo from "../components/SlideInfo";
import ChannelPanel from "../components/ChannelPanel";
import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
import VivViewer from "../viewers/VivViewer";

function ViewerPage() {
  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideInfo, setSlideInfo] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);

  useEffect(() => {
    fetchSlides()
      .then((data) => setSlides(data.slides || []))
      .catch((err) => console.error("Error fetching slides:", err));
  }, []);

  useEffect(() => {
    if (!selectedSlide) return;

    fetchSlideMetadata(selectedSlide.name)
      .then((data) => {
        setSlideInfo(data);

        if (data.type === "ome-tiff" && data.channels?.length) {
          const defaultPalette = [
            "#0000ff",
            "#00ff00",
            "#ff0000",
            "#ff00ff",
            "#ffff00",
            "#00ffff",
          ];

          const defaults = data.channels
            .slice(0, Math.min(3, data.channels.length))
            .map((ch, i) => ({
              index: ch.index,
              color: defaultPalette[i] || "#ffffff",
              opacity: 1,
            }));

          setSelectedChannels(defaults);
        } else {
          setSelectedChannels([]);
        }
      })
      .catch((err) => console.error("Error loading metadata:", err));
  }, [selectedSlide]);

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
            onChange={setSelectedChannels}
          />
        ) : null}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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