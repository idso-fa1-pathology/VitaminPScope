function SlideInfo({ slideInfo }) {
  if (!slideInfo) return null;

  return (
    <div style={{ marginTop: "1rem", fontSize: "14px" }}>
      <h3>Slide Info</h3>
      <div><strong>Type:</strong> {slideInfo.type}</div>
      <div><strong>Name:</strong> {slideInfo.name}</div>
      <div>
        <strong>Size:</strong> {slideInfo.metadata?.sizeX} × {slideInfo.metadata?.sizeY}
      </div>
      <div><strong>Levels:</strong> {slideInfo.metadata?.levels}</div>
      <div>
        <strong>Tile:</strong> {slideInfo.metadata?.tileWidth} × {slideInfo.metadata?.tileHeight}
      </div>
      <div><strong>Dtype:</strong> {slideInfo.metadata?.dtype}</div>
      <div><strong>Bands:</strong> {slideInfo.metadata?.bandCount ?? "n/a"}</div>
    </div>
  );
}

export default SlideInfo;