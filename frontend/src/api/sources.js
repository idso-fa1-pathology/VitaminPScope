const API_BASE = import.meta.env.VITE_BACKEND_URL || "/api";

export async function fetchSources() {
  const res = await fetch(`${API_BASE}/sources`);

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to fetch sources");
  }

  return res.json();
}

export async function fetchSource(sourceId) {
  const res = await fetch(
    `${API_BASE}/sources/${encodeURIComponent(sourceId)}`
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to fetch source");
  }

  return res.json();
}

export async function createSource(payload) {
  const res = await fetch(`${API_BASE}/sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create source");
  }

  return res.json();
}

export async function updateSource(sourceId, payload) {
  const res = await fetch(
    `${API_BASE}/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to update source");
  }

  return res.json();
}

export async function deleteSource(sourceId) {
  const res = await fetch(
    `${API_BASE}/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "DELETE",
    }
  );

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to delete source");
  }

  return res.json();
}