export function getMetersPerPixel(slideInfo) {
  const metadata = slideInfo?.metadata || {};

  // Preferred: backend already provides mm_x / mm_y
  if (metadata.mm_x && Number(metadata.mm_x) > 0) {
    return Number(metadata.mm_x) / 1000; // mm/px -> m/px
  }

  // Optional fallback if you later expose microns-per-pixel
  if (metadata.mpp_x && Number(metadata.mpp_x) > 0) {
    return Number(metadata.mpp_x) / 1_000_000; // µm/px -> m/px
  }

  return null;
}

export function getPixelsPerMeter(slideInfo) {
  const metersPerPixel = getMetersPerPixel(slideInfo);
  if (!metersPerPixel || metersPerPixel <= 0) return null;
  return 1 / metersPerPixel;
}

export function niceScaleBarValue(targetMeters) {
  if (targetMeters <= 0) return 0;

  const exponent = Math.floor(Math.log10(targetMeters));
  const base = targetMeters / Math.pow(10, exponent);

  let niceBase = 1;
  if (base >= 5) niceBase = 5;
  else if (base >= 2) niceBase = 2;
  else niceBase = 1;

  return niceBase * Math.pow(10, exponent);
}

export function formatMetricLength(meters) {
  if (meters >= 0.001) {
    return `${(meters * 1000).toFixed(meters * 1000 >= 10 ? 0 : 1)} mm`;
  }

  if (meters >= 0.000001) {
    const microns = meters * 1_000_000;
    return `${microns >= 10 ? microns.toFixed(0) : microns.toFixed(1)} µm`;
  }

  const nm = meters * 1_000_000_000;
  return `${nm.toFixed(0)} nm`;
}

export function getVivScaleBar({
  viewState,
  containerWidth,
  metersPerPixel,
  targetFraction = 0.18,
}) {
  if (!viewState || !containerWidth || !metersPerPixel) return null;

  // OrthographicView: screen pixels per image pixel = 2^zoom
  const screenPixelsPerImagePixel = Math.pow(2, viewState.zoom || 0);

  const metersPerScreenPixel = metersPerPixel / screenPixelsPerImagePixel;

  const targetScreenPixels = Math.max(80, Math.min(180, containerWidth * targetFraction));
  const targetMeters = metersPerScreenPixel * targetScreenPixels;

  const niceMeters = niceScaleBarValue(targetMeters);
  const widthPx = niceMeters / metersPerScreenPixel;

  return {
    widthPx,
    label: formatMetricLength(niceMeters),
  };
}