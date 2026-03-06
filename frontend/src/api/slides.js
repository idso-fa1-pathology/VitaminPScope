const API_BASE = "http://localhost:8000";

export async function fetchSlides() {
  const res = await fetch(`${API_BASE}/slides`);
  if (!res.ok) {
    throw new Error("Failed to fetch slides");
  }
  return res.json();
}

export async function fetchSlideMetadata(slideName) {
  const res = await fetch(
    `${API_BASE}/slide/${encodeURIComponent(slideName)}/metadata`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch slide metadata");
  }
  return res.json();
}

export function buildTileUrl(slideName, level, x, y, options = {}) {
  const base = `${API_BASE}/slide/${encodeURIComponent(slideName)}/tiles/${level}/${x}/${y}`;
  const params = new URLSearchParams();

  if (options.frame !== undefined) {
    params.set("frame", String(options.frame));
  }

  if (options.color) {
    params.set("color", options.color.replace("#", ""));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}