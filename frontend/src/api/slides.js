const API_BASE = import.meta.env.VITE_BACKEND_URL || "/api";

function appendSourceId(params, sourceId = "default") {
  params.set("source_id", sourceId || "default");
  return params;
}

/* -----------------------------
   Slide listing
----------------------------- */

export async function fetchSlides(path = "", sourceId = "default") {
  const params = new URLSearchParams();

  if (path) {
    params.set("path", path);
  }

  appendSourceId(params, sourceId);

  const query = params.toString();
  const url = `${API_BASE}/slides${query ? `?${query}` : ""}`;

  const res = await fetch(url);

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to fetch slides");
  }

  return res.json();
}

/* -----------------------------
   Slide metadata
----------------------------- */

export async function fetchSlideMetadata(slideName, sourceId = "default") {
  const params = new URLSearchParams();
  appendSourceId(params, sourceId);

  const res = await fetch(
    `${API_BASE}/slide/${encodeURIComponent(slideName)}/metadata?${params.toString()}`
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to fetch slide metadata");
  }

  return res.json();
}

/* -----------------------------
   Folder operations
----------------------------- */

export async function createFolder(name, parentPath = "", sourceId = "default") {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      parent_path: parentPath,
      source_id: sourceId,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create folder");
  }

  return res.json();
}

export async function renameItem(oldPath, newName, sourceId = "default") {
  const res = await fetch(`${API_BASE}/items/rename`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      old_path: oldPath,
      new_name: newName,
      source_id: sourceId,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to rename item");
  }

  return res.json();
}

export async function deleteItem(path, sourceId = "default") {
  const res = await fetch(`${API_BASE}/items`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      source_id: sourceId,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to delete item");
  }

  return res.json();
}

/* -----------------------------
   Tile + thumbnail helpers
----------------------------- */

export function buildTileUrl(slideName, z, x, y, options = {}) {
  const params = new URLSearchParams();

  if (options.frame !== undefined) {
    params.set("frame", options.frame);
  }

  if (options.color) {
    params.set("color", options.color);
  }

  appendSourceId(params, options.sourceId);

  const query = params.toString();

  return `${API_BASE}/slide/${encodeURIComponent(
    slideName
  )}/tiles/${z}/${x}/${y}${query ? `?${query}` : ""}`;
}

export function buildThumbnailUrl(slideName, options = {}) {
  const params = new URLSearchParams();

  if (options.frame !== undefined) {
    params.set("frame", options.frame);
  }

  if (options.color) {
    params.set("color", options.color);
  }

  if (options.max_size !== undefined) {
    params.set("max_size", options.max_size);
  }

  appendSourceId(params, options.sourceId);

  const query = params.toString();

  return `${API_BASE}/slide/${encodeURIComponent(
    slideName
  )}/thumbnail${query ? `?${query}` : ""}`;
}

export function buildSlideSourceUrl(slideName, sourceId = "default") {
  const params = new URLSearchParams();
  appendSourceId(params, sourceId);

  return `${API_BASE}/slide/${encodeURIComponent(
    slideName
  )}/source?${params.toString()}`;
}

/* -----------------------------
   Viv viewer info
----------------------------- */

export async function fetchVivInfo(slideName, sourceId = "default") {
  const params = new URLSearchParams();
  appendSourceId(params, sourceId);

  const res = await fetch(
    `${API_BASE}/slide/${encodeURIComponent(slideName)}/viv?${params.toString()}`
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to fetch Viv info");
  }

  return res.json();
}

/* -----------------------------
   ROI AI segmentation
----------------------------- */

export async function runRoiAiSegmentation(slideName, payload, sourceId = "default") {
  const params = new URLSearchParams();
  appendSourceId(params, sourceId);

  const res = await fetch(
    `${API_BASE}/slide/${encodeURIComponent(
      slideName
    )}/ai/roi-segmentation?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    let message = "Failed to run ROI AI segmentation";

    try {
      const errorData = await res.json();
      message = errorData?.detail || message;
    } catch {
      const text = await res.text();
      message = text || message;
    }

    throw new Error(message);
  }

  return res.json();
}