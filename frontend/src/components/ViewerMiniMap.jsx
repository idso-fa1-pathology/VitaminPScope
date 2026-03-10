import { useMemo } from "react";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRect(rect, imageWidth, imageHeight) {
  if (!rect) {
    return {
      x: 0,
      y: 0,
      width: imageWidth || 1,
      height: imageHeight || 1,
    };
  }

  const safeImageWidth = Math.max(imageWidth || 1, 1);
  const safeImageHeight = Math.max(imageHeight || 1, 1);

  const x = clamp(rect.x || 0, 0, safeImageWidth);
  const y = clamp(rect.y || 0, 0, safeImageHeight);
  const width = clamp(rect.width || 0, 0, safeImageWidth);
  const height = clamp(rect.height || 0, 0, safeImageHeight);

  return {
    x,
    y,
    width,
    height,
  };
}

function ViewerMiniMap({
  imageWidth,
  imageHeight,
  viewportRect,
  thumbnailUrl,
  onNavigate,
  width = 180,
  maxHeight = 220,
  minWidth = 140,
  showFrame = true,
  title = "Overview",
  children,
}) {
  const safeImageWidth = Math.max(imageWidth || 1, 1);
  const safeImageHeight = Math.max(imageHeight || 1, 1);

  const layout = useMemo(() => {
    const resolvedWidth = Math.max(width || 180, minWidth || 140);
    const aspectRatio = safeImageHeight / safeImageWidth;

    let innerWidth = resolvedWidth;
    let innerHeight = resolvedWidth * aspectRatio;

    if (maxHeight && innerHeight > maxHeight) {
      innerHeight = maxHeight;
      innerWidth = innerHeight / aspectRatio;
    }

    const scaleX = innerWidth / safeImageWidth;
    const scaleY = innerHeight / safeImageHeight;

    return {
      innerWidth,
      innerHeight,
      scaleX,
      scaleY,
    };
  }, [width, minWidth, maxHeight, safeImageWidth, safeImageHeight]);

  const normalizedViewport = useMemo(
    () => normalizeRect(viewportRect, safeImageWidth, safeImageHeight),
    [viewportRect, safeImageWidth, safeImageHeight]
  );

  const viewportStyle = useMemo(() => {
    const left = normalizedViewport.x * layout.scaleX;
    const top = normalizedViewport.y * layout.scaleY;

    const rectWidth = Math.max(16, normalizedViewport.width * layout.scaleX);
    const rectHeight = Math.max(16, normalizedViewport.height * layout.scaleY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${rectWidth}px`,
      height: `${rectHeight}px`,
    };
  }, [normalizedViewport, layout.scaleX, layout.scaleY]);

  const handlePointerDown = (event) => {
    if (!onNavigate) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const localY = clamp(event.clientY - rect.top, 0, rect.height);

    const imageX = localX / layout.scaleX;
    const imageY = localY / layout.scaleY;

    onNavigate({
      x: imageX,
      y: imageY,
    });
  };

  return (
    <div
      className={[
        "viewer-minimap",
        showFrame ? "viewer-minimap--framed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {title ? <div className="viewer-minimap__title">{title}</div> : null}

      <div
        className="viewer-minimap__surface"
        onPointerDown={(event) => {
          event.preventDefault();
          handlePointerDown(event);
        }}
        title={onNavigate ? "Click to navigate" : title}
      >
        <div
          className="viewer-minimap__image-wrap"
          style={{
            width: `${layout.innerWidth}px`,
            height: `${layout.innerHeight}px`,
          }}
        >
          {children ? (
            <div className="viewer-minimap__custom-layer">{children}</div>
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="slide overview"
              className="viewer-minimap__image"
              draggable={false}
            />
          ) : (
            <div className="viewer-minimap__empty">No preview</div>
          )}

          <div className="viewer-minimap__viewport" style={viewportStyle} />
        </div>
      </div>
    </div>
  );
}

export default ViewerMiniMap;