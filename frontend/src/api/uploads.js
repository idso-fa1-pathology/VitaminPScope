const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export function uploadFiles(files, targetPath = "", { overwrite = false, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    Array.from(files || []).forEach((file) => {
      formData.append("files", file);
    });

    formData.append("target_path", targetPath || "");
    formData.append("overwrite", String(Boolean(overwrite)));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}/uploads`);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;

      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent,
      });
    };

    xhr.onload = () => {
      let payload = null;

      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      const message =
        payload?.detail ||
        payload?.message ||
        xhr.responseText ||
        "Upload failed";

      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    xhr.send(formData);
  });
}