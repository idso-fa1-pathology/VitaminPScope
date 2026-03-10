import { useEffect, useMemo, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[clamp(index, 0, sorted.length - 1)];
}

function computeAutoFromImage(img) {
  const maxSide = 160;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { autoLow: 0, autoHigh: 255 };
  }

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const luminance = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance.push(y);
  }

  if (!luminance.length) {
    return { autoLow: 0, autoHigh: 255 };
  }

  luminance.sort((a, b) => a - b);

  let autoLow = percentile(luminance, 2);
  let autoHigh = percentile(luminance, 98);

  if (autoHigh <= autoLow + 2) {
    autoLow = 0;
    autoHigh = 255;
  }

  return { autoLow, autoHigh };
}

function buildFilterString(adjustments, autoWindow) {
  const brightnessMultiplier = 1 + adjustments.brightness / 100;
  const contrastPercent = Math.round(adjustments.contrast * 100);
  const grayscalePercent = adjustments.grayscale ? 100 : 0;
  const invertPercent = adjustments.invert ? 100 : 0;
  const saturatePercent = Math.round(adjustments.saturation * 100);

  const filters = [];

  if (adjustments.auto && autoWindow) {
    const span = Math.max(1, autoWindow.autoHigh - autoWindow.autoLow);
    const contrastBoost = clamp(255 / span, 0.8, 3);
    const brightnessOffset = clamp(
      ((127.5 - (autoWindow.autoLow + autoWindow.autoHigh) / 2) / 255) * 100,
      -35,
      35
    );

    filters.push(`brightness(${(brightnessMultiplier + brightnessOffset / 100).toFixed(3)})`);
    filters.push(`contrast(${Math.round(contrastBoost * adjustments.contrast * 100)}%)`);
  } else {
    filters.push(`brightness(${brightnessMultiplier.toFixed(3)})`);
    filters.push(`contrast(${contrastPercent}%)`);
  }

  if (Math.abs(adjustments.gamma - 1) > 0.001) {
    const approximateBrightness = clamp(Math.pow(1 / adjustments.gamma, 0.8), 0.5, 1.8);
    filters.push(`brightness(${approximateBrightness.toFixed(3)})`);
  }

  if (grayscalePercent > 0) {
    filters.push(`grayscale(${grayscalePercent}%)`);
  }

  if (saturatePercent !== 100) {
    filters.push(`saturate(${saturatePercent}%)`);
  }

  if (invertPercent > 0) {
    filters.push(`invert(${invertPercent}%)`);
  }

  return filters.join(" ");
}

function ImageAdjustmentOverlay({
  slide,
  slideInfo,
  adjustments,
  buildPreviewUrl,
  zIndex = 3,
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [autoWindow, setAutoWindow] = useState(null);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    if (!slide || !slideInfo || !buildPreviewUrl) {
      setPreviewUrl("");
      setAutoWindow(null);
      return;
    }

    const url = buildPreviewUrl(slide);
    setPreviewUrl(url);

    if (!adjustments?.auto) {
      setAutoWindow(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    img.onload = () => {
      if (activeRequestRef.current !== requestId) return;
      try {
        setAutoWindow(computeAutoFromImage(img));
      } catch {
        setAutoWindow({ autoLow: 0, autoHigh: 255 });
      }
    };

    img.onerror = () => {
      if (activeRequestRef.current !== requestId) return;
      setAutoWindow({ autoLow: 0, autoHigh: 255 });
    };

    img.src = url;
  }, [slide, slideInfo, adjustments?.auto, buildPreviewUrl]);

  const filter = useMemo(() => {
    if (!adjustments) return "";
    return buildFilterString(adjustments, autoWindow);
  }, [adjustments, autoWindow]);

  if (!previewUrl || !adjustments) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <img
        src={previewUrl}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter,
          mixBlendMode: "normal",
          opacity: 0.999,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default ImageAdjustmentOverlay;