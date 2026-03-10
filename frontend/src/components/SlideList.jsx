function SlideList({ slides, selectedSlide, onSelect }) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Slides</h2>

      {slides.length === 0 ? (
        <p>No slides found. Put files in data/sample_slides/</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {slides.map((slide) => {
            const isSelected = selectedSlide?.name === slide.name;

            return (
              <li
                key={slide.name}
                onClick={() => onSelect(slide)}
                style={{
                  padding: "14px",
                  margin: "8px 0",
                  backgroundColor: isSelected ? "#007bff" : "#fff",
                  color: isSelected ? "#fff" : "#000",
                  cursor: "pointer",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontWeight: "bold", wordBreak: "break-word" }}>
                  {slide.name}
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "4px" }}>
                  {slide.type}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default SlideList;