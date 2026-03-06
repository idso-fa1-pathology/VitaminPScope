function SlideList({ slides, selectedSlide, onSelect }) {
  return (
    <>
      <h2>Slide Manager</h2>

      {slides.length === 0 ? (
        <p>No slides found. Put files in data/sample_slides/</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {slides.map((slide) => (
            <li
              key={slide.name}
              onClick={() => onSelect(slide)}
              style={{
                padding: "10px",
                margin: "5px 0",
                backgroundColor:
                  selectedSlide?.name === slide.name ? "#007bff" : "#fff",
                color: selectedSlide?.name === slide.name ? "#fff" : "#000",
                cursor: "pointer",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontWeight: "bold", wordBreak: "break-word" }}>
                {slide.name}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>{slide.type}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default SlideList;