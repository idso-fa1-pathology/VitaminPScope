import { useEffect, useState, useRef } from 'react';
import OpenSeadragon from 'openseadragon';

function App() {
  const [slides, setSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const viewerRef = useRef(null); // Keeps track of the OpenSeadragon instance

  // Fetch the list of slides when the app loads
  useEffect(() => {
    fetch('http://localhost:8000/slides')
      .then(res => res.json())
      .then(data => setSlides(data.slides))
      .catch(err => console.error("Error fetching slides:", err));
  }, []);

  // Initialize OpenSeadragon when a slide is selected
  useEffect(() => {
    if (!selectedSlide) return;

    // First, fetch the metadata to know how big the slide is
    fetch(`http://localhost:8000/slide/${selectedSlide}/metadata`)
      .then(res => res.json())
      .then(metadata => {
        // Destroy the old viewer if we are opening a new slide
        if (viewerRef.current) {
          viewerRef.current.destroy();
        }

        // Configure OpenSeadragon to talk to our FastAPI backend
        viewerRef.current = OpenSeadragon({
          id: "osd-viewer",
          prefixUrl: "https://openseadragon.github.io/openseadragon/images/", // Default icons
          tileSources: {
            height: metadata.sizeY,
            width: metadata.sizeX,
            tileSize: metadata.tileWidth || 256,
            minLevel: 0,
            maxLevel: metadata.levels - 1,
            getTileUrl: function(level, x, y) {
              return `http://localhost:8000/slide/${selectedSlide}/tiles/${level}/${x}/${y}`;
            }
          },
          animationTime: 0.5,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 2,
          visibilityRatio: 1,
          zoomPerScroll: 2,
        });
      });

    // Cleanup function to destroy viewer when component unmounts
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, [selectedSlide]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar: Slide Manager */}
      <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '1rem', backgroundColor: '#f8f9fa' }}>
        <h2>Slide Manager</h2>
        {slides.length === 0 ? (
          <p>No slides found. Put an .svs file in data/sample_slides/</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {slides.map(slide => (
              <li 
                key={slide} 
                onClick={() => setSelectedSlide(slide)}
                style={{ 
                  padding: '10px', 
                  margin: '5px 0', 
                  backgroundColor: selectedSlide === slide ? '#007bff' : '#fff',
                  color: selectedSlide === slide ? '#fff' : '#000',
                  cursor: 'pointer',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                {slide}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main Area: OpenSeadragon Viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
          <h3>Viewer {selectedSlide ? `- ${selectedSlide}` : ''}</h3>
        </div>
        
        {/* The div where OpenSeadragon renders the image */}
        <div id="osd-viewer" style={{ flex: 1, backgroundColor: '#222' }}>
          {!selectedSlide && (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              Select a slide from the manager to view it.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default App;