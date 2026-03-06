import { useEffect, useState, useRef } from "react";
import OpenSeadragon from "openseadragon";

function App() {
  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const viewerRef = useRef(null);

  // Fetch slides
  useEffect(() => {
    fetch("http://localhost:8000/slides")
      .then((res) => res.json())
      .then((data) => setSlides(data.slides))
      .catch((err) => console.error("Error fetching slides:", err));
  }, []);

  // Initialize viewer when slide changes
  useEffect(() => {
    if (!selectedSlide) return;

    fetch(`http://localhost:8000/slide/${selectedSlide}/metadata`)
      .then((res) => res.json())
      .then((metadata) => {
        if (viewerRef.current) {
          viewerRef.current.destroy();
        }

        viewerRef.current = OpenSeadragon({
          id: "osd-viewer",
          prefixUrl:
            "https://openseadragon.github.io/openseadragon/images/",

          tileSources: new OpenSeadragon.TileSource({
            height: metadata.sizeY,
            width: metadata.sizeX,
            tileSize: metadata.tileWidth || 240,
            tileOverlap: 0,
            minLevel: 0,
            maxLevel: metadata.levels - 1,

            getTileUrl: function (level, x, y) {
              return `http://localhost:8000/slide/${selectedSlide}/tiles/${level}/${x}/${y}`;
            },
          }),

          animationTime: 0.5,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 2,
          visibilityRatio: 1,
          zoomPerScroll: 2,
        });
      });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, [selectedSlide]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ccc",
          padding: "1rem",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2>Slide Manager</h2>

        {slides.length === 0 ? (
          <p>No slides found. Put an .svs file in data/sample_slides/</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {slides.map((slide) => (
              <li
                key={slide}
                onClick={() => setSelectedSlide(slide)}
                style={{
                  padding: "10px",
                  margin: "5px 0",
                  backgroundColor:
                    selectedSlide === slide ? "#007bff" : "#fff",
                  color: selectedSlide === slide ? "#fff" : "#000",
                  cursor: "pointer",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                {slide}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
          <h3>Viewer {selectedSlide ? `- ${selectedSlide}` : ""}</h3>
        </div>

        <div id="osd-viewer" style={{ flex: 1, backgroundColor: "#222" }}>
          {!selectedSlide && (
            <div
              style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "#888",
              }}
            >
              Select a slide from the manager to view it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;