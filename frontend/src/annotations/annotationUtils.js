export function clampNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  
  export function distance(a, b) {
    const dx = clampNumber(b.x) - clampNumber(a.x);
    const dy = clampNumber(b.y) - clampNumber(a.y);
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  export function rectFromPoints(a, b) {
    const x1 = clampNumber(a.x);
    const y1 = clampNumber(a.y);
    const x2 = clampNumber(b.x);
    const y2 = clampNumber(b.y);
  
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }
  
  export function formatLengthFromPixels(pixelLength, metersPerPixel) {
    if (!metersPerPixel || !Number.isFinite(pixelLength)) {
      return `${pixelLength.toFixed(1)} px`;
    }
  
    const meters = pixelLength * metersPerPixel;
  
    if (meters >= 0.001) {
      const mm = meters * 1000;
      return `${mm >= 10 ? mm.toFixed(0) : mm.toFixed(1)} mm`;
    }
  
    if (meters >= 0.000001) {
      const um = meters * 1_000_000;
      return `${um >= 10 ? um.toFixed(0) : um.toFixed(1)} µm`;
    }
  
    const nm = meters * 1_000_000_000;
    return `${nm.toFixed(0)} nm`;
  }
  
  export function getRectLabel(annotation, metersPerPixel) {
    const widthLabel = formatLengthFromPixels(annotation.width, metersPerPixel);
    const heightLabel = formatLengthFromPixels(annotation.height, metersPerPixel);
    return `${widthLabel} × ${heightLabel}`;
  }
  
  export function annotationToSvg(annotation, imageToScreen) {
    if (!annotation) return null;
  
    if (annotation.tool === "point") {
      const p = imageToScreen({ x: annotation.x, y: annotation.y });
      return { kind: "point", cx: p.x, cy: p.y, r: 4 };
    }
  
    if (annotation.tool === "line" || annotation.tool === "measure") {
      const a = imageToScreen(annotation.start);
      const b = imageToScreen(annotation.end);
      return { kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
  
    if (annotation.tool === "rect") {
      const tl = imageToScreen({ x: annotation.x, y: annotation.y });
      const br = imageToScreen({
        x: annotation.x + annotation.width,
        y: annotation.y + annotation.height,
      });
  
      return {
        kind: "rect",
        x: Math.min(tl.x, br.x),
        y: Math.min(tl.y, br.y),
        width: Math.abs(br.x - tl.x),
        height: Math.abs(br.y - tl.y),
      };
    }
  
    return null;
  }