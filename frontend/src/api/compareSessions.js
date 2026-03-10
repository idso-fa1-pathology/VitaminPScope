const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  (typeof window !== "undefined"
    ? window.location.origin.replace(/:\d+$/, ":8000")
    : "http://localhost:8000");

async function parseResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || "Compare session request failed."
    );
  }

  return data;
}

export async function fetchCompareSessions() {
  const response = await fetch(`${API_BASE}/compare-sessions`);
  return parseResponse(response);
}

export async function createCompareSession(payload) {
  const response = await fetch(`${API_BASE}/compare-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function renameCompareSession(sessionId, name) {
  const response = await fetch(
    `${API_BASE}/compare-sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );

  return parseResponse(response);
}

export async function deleteCompareSession(sessionId) {
  const response = await fetch(
    `${API_BASE}/compare-sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
    }
  );

  return parseResponse(response);
}