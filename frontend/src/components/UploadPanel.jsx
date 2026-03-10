import { useMemo, useRef, useState } from "react";
import { uploadFiles } from "../api/uploads";

const DEFAULT_ACCEPT = [
  ".svs",
  ".ndpi",
  ".tif",
  ".tiff",
  ".ome.tif",
  ".ome.tiff",
  ".png",
  ".jpg",
  ".jpeg",
  ".czi",
  ".mrxs",
  ".scn",
  ".vms",
  ".vmu",
  ".dcm",
  ".dicom",
].join(",");

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function UploadPanel({
  isOpen,
  currentPath = "",
  onClose,
  onUploaded,
  accept = DEFAULT_ACCEPT,
}) {
  const inputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [overwrite, setOverwrite] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedCount = selectedFiles.length;
  const totalSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [selectedFiles]
  );

  if (!isOpen) return null;

  const mergeFiles = (incoming) => {
    const next = Array.from(incoming || []);
    if (!next.length) return;

    setSelectedFiles((prev) => {
      const map = new Map();

      [...prev, ...next].forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!map.has(key)) {
          map.set(key, file);
        }
      });

      return Array.from(map.values());
    });
  };

  const handleFileInput = (event) => {
    mergeFiles(event.target.files);
    event.target.value = "";
    setError("");
    setResult(null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    mergeFiles(event.dataTransfer.files);
    setError("");
    setResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || uploading) return;

    setUploading(true);
    setError("");
    setResult(null);
    setProgress({ percent: 0, loaded: 0, total: 0 });

    try {
      const response = await uploadFiles(selectedFiles, currentPath, {
        overwrite,
        onProgress: setProgress,
      });

      setResult(response);
      setSelectedFiles([]);

      if (onUploaded) {
        onUploaded(response);
      }
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFileAt = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={styles.root}>
      <div style={styles.panel} role="dialog" aria-modal="false" aria-label="Upload files">
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Upload files</div>
            <div style={styles.subtitle}>
              Add slide files to {currentPath ? `/${currentPath}` : "the root folder"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div style={styles.content}>
          <div
            style={{
              ...styles.dropzone,
              ...(dragActive ? styles.dropzoneActive : {}),
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <div style={styles.dropzoneIcon}>⬆</div>
            <div style={styles.dropzoneTitle}>Drag and drop slide files here</div>
            <div style={styles.dropzoneText}>
              or choose files from your computer
            </div>

            <button
              type="button"
              style={styles.browseButton}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Browse files
            </button>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept={accept}
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>

          <div style={styles.targetBox}>
            <div style={styles.targetLabel}>Target folder</div>
            <div style={styles.targetValue}>{currentPath || "/"}</div>
          </div>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              disabled={uploading}
            />
            <span>Overwrite matching filenames</span>
          </label>

          <div style={styles.summaryRow}>
            <div style={styles.summaryChip}>
              {selectedCount} file{selectedCount === 1 ? "" : "s"}
            </div>
            <div style={styles.summaryChip}>{formatBytes(totalSize)}</div>
          </div>

          {selectedFiles.length ? (
            <div style={styles.fileList}>
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} style={styles.fileRow}>
                  <div style={styles.fileMeta}>
                    <div style={styles.fileName} title={file.name}>
                      {file.name}
                    </div>
                    <div style={styles.fileSize}>{formatBytes(file.size)}</div>
                  </div>

                  <button
                    type="button"
                    style={styles.removeButton}
                    onClick={() => removeFileAt(index)}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyHint}>No files selected yet.</div>
          )}

          {uploading ? (
            <div style={styles.progressBox}>
              <div style={styles.progressHeader}>
                <span>Uploading...</span>
                <span>{progress.percent || 0}%</span>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${progress.percent || 0}%`,
                  }}
                />
              </div>

              <div style={styles.progressText}>
                {formatBytes(progress.loaded || 0)} / {formatBytes(progress.total || 0)}
              </div>
            </div>
          ) : null}

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {result?.message ? <div style={styles.successBox}>{result.message}</div> : null}

          {result?.failed?.length ? (
            <div style={styles.resultBox}>
              <div style={styles.resultTitle}>Failed files</div>
              {result.failed.map((item) => (
                <div key={`${item.name}-${item.error}`} style={styles.resultRow}>
                  <strong>{item.name}</strong>: {item.error}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Close
          </button>

          <button
            type="button"
            onClick={handleUpload}
            style={styles.primaryButton}
            disabled={!selectedFiles.length || uploading}
          >
            {uploading ? "Uploading..." : "Start upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    position: "fixed",
    top: 88,
    right: 18,
    zIndex: 1200,
    pointerEvents: "none",
  },
  panel: {
    width: "min(460px, 94vw)",
    maxHeight: "calc(100vh - 120px)",
    overflow: "auto",
    background: "rgba(255,255,255,0.96)",
    color: "#1f2937",
    borderRadius: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
    border: "1px solid rgba(148,163,184,0.28)",
    backdropFilter: "blur(10px)",
    pointerEvents: "auto",
  },
  header: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    position: "sticky",
    top: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  closeButton: {
    border: "none",
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 10,
    width: 34,
    height: 34,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  content: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  dropzone: {
    border: "2px dashed #cbd5e1",
    borderRadius: 16,
    padding: "24px 16px",
    textAlign: "center",
    background: "#f8fafc",
    transition: "0.2s ease",
  },
  dropzoneActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
  },
  dropzoneIcon: {
    fontSize: 28,
    marginBottom: 8,
    color: "#2563eb",
  },
  dropzoneTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
  },
  dropzoneText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 14,
  },
  browseButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  targetBox: {
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  targetValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#1e293b",
  },
  summaryRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  summaryChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    background: "#f1f5f9",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
  },
  fileList: {
    display: "grid",
    gap: 8,
    maxHeight: 220,
    overflow: "auto",
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  fileMeta: {
    minWidth: 0,
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fileSize: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  removeButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  emptyHint: {
    fontSize: 13,
    color: "#64748b",
    padding: "8px 2px",
  },
  progressBox: {
    border: "1px solid rgba(37,99,235,0.15)",
    background: "#eff6ff",
    borderRadius: 12,
    padding: 12,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    fontWeight: 700,
    color: "#1d4ed8",
    marginBottom: 8,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "#2563eb",
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    color: "#475569",
  },
  errorBox: {
    border: "1px solid rgba(239,68,68,0.18)",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  successBox: {
    border: "1px solid rgba(34,197,94,0.18)",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  resultBox: {
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  resultRow: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(148,163,184,0.18)",
    position: "sticky",
    bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
};

export default UploadPanel;