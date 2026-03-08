const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/* -----------------------------
   Slide listing
----------------------------- */

export async function fetchSlides(path = "") {
  const params = new URLSearchParams();

  if (path) {
    params.set("path", path);
  }

  const query = params.toString();
  const url = `${BACKEND_URL}/slides${query ? `?${query}` : ""}`;

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

export async function fetchSlideMetadata(slideName) {
  const res = await fetch(
    `${BACKEND_URL}/slide/${encodeURIComponent(slideName)}/metadata`
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

export async function createFolder(name, parentPath = "") {
  const res = await fetch(`${BACKEND_URL}/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      parent_path: parentPath,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create folder");
  }

  return res.json();
}

export async function renameItem(oldPath, newName) {
  const res = await fetch(`${BACKEND_URL}/items/rename`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      old_path: oldPath,
      new_name: newName,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to rename item");
  }

  return res.json();
}

export async function deleteItem(path) {
  const res = await fetch(`${BACKEND_URL}/items`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
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

  const query = params.toString();

  return `${BACKEND_URL}/slide/${encodeURIComponent(
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

  const query = params.toString();

  return `${BACKEND_URL}/slide/${encodeURIComponent(
    slideName
  )}/thumbnail${query ? `?${query}` : ""}`;
}

export function buildSlideSourceUrl(slideName) {
  return `${BACKEND_URL}/slide/${encodeURIComponent(slideName)}/source`;
}

/* -----------------------------
   Viv viewer info
----------------------------- */

export async function fetchVivInfo(slideName) {
  const res = await fetch(
    `${BACKEND_URL}/slide/${encodeURIComponent(slideName)}/viv`
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

export async function runRoiAiSegmentation(slideName, payload) {
  const res = await fetch(
    `${BACKEND_URL}/slide/${encodeURIComponent(
      slideName
    )}/ai/roi-segmentation`,
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