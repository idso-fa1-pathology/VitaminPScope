function getSlideEmoji(type) {
  if (type === "ome-tiff") return "🧬";
  if (type === "svs") return "🔬";
  return "🖼️";
}

function SlideCard({ slide, onOpen }) {
  return (
    <div className="slide-card" onClick={() => onOpen(slide)}>
      <div className="slide-card__preview">{getSlideEmoji(slide.type)}</div>

      <div className="slide-card__name">{slide.name}</div>

      <div className="slide-card__meta">
        <span className="slide-type-badge">{slide.type}</span>
        <span className="slide-card__action">Open viewer →</span>
      </div>
    </div>
  );
}

export default SlideCard;