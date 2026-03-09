import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createFolder,
  deleteItem,
  fetchSlides,
  renameItem,
} from "../api/slides";
import {
  createSource,
  deleteSource as deleteMountedSource,
  fetchSources,
} from "../api/sources";
import FileManagerCard from "../components/FileManagerCard";
import Modal from "../components/Modal";
import UploadPanel from "../components/UploadPanel";
import "../styles/slide-manager.css";

function normalizeType(type) {
  if (!type) return "unknown";
  return String(type).trim().toLowerCase();
}

function getTypeLabel(type) {
  const normalized = normalizeType(type);

  const labels = {
    "ome-tiff": "OME-TIFF",
    "ome.tiff": "OME-TIFF",
    tiff: "TIFF",
    tif: "TIF",
    svs: "SVS",
    ndpi: "NDPI",
    czi: "CZI",
    vms: "VMS",
    vmu: "VMU",
    scn: "SCN",
    mrxs: "MRXS",
    btf: "BTF",
    png: "PNG",
    jpg: "JPG",
    jpeg: "JPEG",
    dcm: "DICOM",
    dicom: "DICOM",
    unknown: "Unknown",
  };

  return labels[normalized] || normalized.toUpperCase();
}

function formatPathLabel(path) {
  return path ? `Path: ${path}` : "Path: Root";
}

function getTopFormatCounts(slides) {
  const countsMap = slides.reduce((acc, slide) => {
    const type = normalizeType(slide.type);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(countsMap)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 2)
    .map(([type, count]) => ({
      type,
      label: getTypeLabel(type),
      count,
    }));
}

function buildTypeFilterOptions(slides) {
  const types = Array.from(
    new Set(slides.map((slide) => normalizeType(slide.type)).filter(Boolean))
  ).sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b)));

  return [
    { value: "all", label: "All" },
    { value: "folder", label: "Folders" },
    ...types.map((type) => ({
      value: type,
      label: getTypeLabel(type),
    })),
  ];
}

function SlideManagerPage() {
  const [slides, setSlides] = useState([]);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [currentSourceId, setCurrentSourceId] = useState("default");

  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createSourceOpen, setCreateSourceOpen] = useState(false);
  const [deleteSourceOpen, setDeleteSourceOpen] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState("");

  const [sourceName, setSourceName] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [sourceReadOnly, setSourceReadOnly] = useState(true);
  const [selectedSource, setSelectedSource] = useState(null);

  const navigate = useNavigate();

  const loadSources = async () => {
    try {
      setSourcesLoading(true);
      const data = await fetchSources();
      const nextSources = data.sources || [];
      setSources(nextSources);

      if (!nextSources.some((source) => source.id === currentSourceId) && nextSources.length) {
        const defaultSource =
          nextSources.find((source) => source.is_default) || nextSources[0];
        setCurrentSourceId(defaultSource.id);
        setCurrentPath("");
      }
    } catch (err) {
      console.error("Error fetching sources:", err);
      setError(err.message || "Failed to load mounted sources.");
    } finally {
      setSourcesLoading(false);
    }
  };

  const loadSlides = async (path = currentPath, sourceId = currentSourceId) => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchSlides(path, sourceId);
      setSlides(data.slides || []);
      setFolders(data.folders || []);
    } catch (err) {
      console.error("Error fetching slides:", err);
      setError("Failed to load items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    loadSlides(currentPath, currentSourceId);
  }, [currentPath, currentSourceId]);

  const handleOpenItem = (item) => {
    if (item.kind === "folder") {
      setCurrentPath(item.path || item.name);
      return;
    }

    navigate(
      `/viewer/${encodeURIComponent(item.path || item.name)}?source_id=${encodeURIComponent(
        item.source_id || currentSourceId
      )}`
    );
  };

  const handleGoBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      await createFolder(folderName.trim(), currentPath, currentSourceId);
      setFolderName("");
      setCreateFolderOpen(false);
      await loadSlides(currentPath, currentSourceId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create folder.");
    }
  };

  const handleCreateSource = async () => {
    if (!sourceName.trim() || !sourcePath.trim()) return;

    try {
      await createSource({
        name: sourceName.trim(),
        path: sourcePath.trim(),
        enabled: true,
        read_only: sourceReadOnly,
        source_type: "local",
      });

      setSourceName("");
      setSourcePath("");
      setSourceReadOnly(true);
      setCreateSourceOpen(false);
      await loadSources();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create mounted source.");
    }
  };

  const openRenameModal = (item) => {
    setSelectedItem(item);
    setRenameValue(item.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!selectedItem || !renameValue.trim()) return;

    try {
      await renameItem(
        selectedItem.path || selectedItem.name,
        renameValue.trim(),
        selectedItem?.source_id || currentSourceId
      );
      setRenameOpen(false);
      setSelectedItem(null);
      setRenameValue("");
      await loadSlides(currentPath, currentSourceId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to rename item.");
    }
  };

  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  const openDeleteSourceModal = (source) => {
    setSelectedSource(source);
    setDeleteSourceOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await deleteItem(
        selectedItem.path || selectedItem.name,
        selectedItem?.source_id || currentSourceId
      );
      setDeleteOpen(false);
      setSelectedItem(null);
      await loadSlides(currentPath, currentSourceId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete item.");
    }
  };

  const handleDeleteSource = async () => {
    if (!selectedSource) return;

    try {
      await deleteMountedSource(selectedSource.id);
      setDeleteSourceOpen(false);

      const deletedId = selectedSource.id;
      setSelectedSource(null);

      await loadSources();

      if (deletedId === currentSourceId) {
        setCurrentPath("");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete mounted source.");
    }
  };

  const handleUploadComplete = async (response) => {
    await loadSlides(currentPath, currentSourceId);

    const failedCount = response?.failed?.length || 0;
    if (failedCount === 0) {
      setUploadOpen(false);
    }
  };

  const handleSourceChange = (event) => {
    const nextSourceId = event.target.value;
    if (!nextSourceId || nextSourceId === currentSourceId) return;

    setCurrentSourceId(nextSourceId);
    setCurrentPath("");
  };

  const items = useMemo(() => {
    const folderItems = folders.map((folder) => ({
      ...folder,
      kind: "folder",
      normalizedType: "folder",
    }));

    const slideItems = slides.map((slide) => ({
      ...slide,
      kind: "slide",
      normalizedType: normalizeType(slide.type),
    }));

    return [...folderItems, ...slideItems];
  }, [slides, folders]);

  const counts = useMemo(() => {
    const totalSlides = slides.length;
    const totalFolders = folders.length;
    const totalItems = totalSlides + totalFolders;
    const uniqueFormats = new Set(slides.map((s) => normalizeType(s.type))).size;
    const topFormats = getTopFormatCounts(slides);

    return {
      totalSlides,
      totalFolders,
      totalItems,
      uniqueFormats,
      topFormats,
    };
  }, [slides, folders]);

  const currentSource = useMemo(() => {
    return (
      sources.find((source) => source.id === currentSourceId) ||
      sources.find((source) => source.is_default) ||
      null
    );
  }, [sources, currentSourceId]);

  const typeFilterOptions = useMemo(() => {
    return buildTypeFilterOptions(slides);
  }, [slides]);

  useEffect(() => {
    const stillValid = typeFilterOptions.some((option) => option.value === typeFilter);
    if (!stillValid) {
      setTypeFilter("all");
    }
  }, [typeFilter, typeFilterOptions]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !q ||
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.path || "").toLowerCase().includes(q) ||
        String(item.type || "").toLowerCase().includes(q);

      const matchesType =
        typeFilter === "all"
          ? true
          : typeFilter === "folder"
            ? item.kind === "folder"
            : item.normalizedType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  return (
    <div className="slide-manager-page">
      <div className="slide-manager-shell">
        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="manager-eyebrow">Digital Pathology Workspace</div>
            <h1 className="app-title">VitaminPScope</h1>
            <p className="hero-panel__subtitle">
              Manage pathology slides, organize folders, and open whole-slide
              images in a cleaner, faster workspace.
            </p>

            <div className="hero-panel__meta">
              <span className="hero-badge">Workspace</span>
              <span className="hero-badge">
                Source: {currentSource?.name || currentSourceId}
              </span>
              {currentSource ? (
                <span className="hero-badge">
                  {currentSource.read_only ? "Read-only" : "Writable"}
                </span>
              ) : null}
              <span className="hero-badge">{formatPathLabel(currentPath)}</span>
              <span className="hero-badge">
                {counts.uniqueFormats} format{counts.uniqueFormats === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="hero-panel__actions">
            {currentPath ? (
              <button className="secondary-btn" onClick={handleGoBack}>
                ← Back
              </button>
            ) : null}

            <button
              className="primary-btn"
              onClick={() => setCreateFolderOpen(true)}
              disabled={currentSource?.read_only}
            >
              + New Folder
            </button>

            <button
              className="secondary-btn"
              onClick={() => setUploadOpen(true)}
              disabled={currentSource?.read_only}
            >
              Upload
            </button>

            <button
              className="secondary-btn"
              onClick={() => setCreateSourceOpen(true)}
            >
              + Mount Folder
            </button>

            {currentSourceId !== "default" ? (
              <button
                className="secondary-btn"
                onClick={() => openDeleteSourceModal(currentSource)}
                disabled={!currentSource}
              >
                Unmount
              </button>
            ) : null}

            <button
              className="secondary-btn"
              onClick={() => loadSlides(currentPath, currentSourceId)}
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="slide-manager-stats">
          <div className="stat-tile">
            <div className="stat-tile__label">Total items</div>
            <div className="stat-tile__value">{counts.totalItems}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">Folders</div>
            <div className="stat-tile__value">{counts.totalFolders}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">
              {counts.topFormats[0]?.label || "Slides"}
            </div>
            <div className="stat-tile__value">{counts.topFormats[0]?.count || 0}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">
              {counts.topFormats[1]?.label || "Formats"}
            </div>
            <div className="stat-tile__value">
              {counts.topFormats[1]?.count || counts.uniqueFormats}
            </div>
          </div>
        </section>

        <section className="toolbar-card">
          <div className="manager-header-row">
            <div style={{ minWidth: 260 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Mounted library
              </div>

              <select
                value={currentSourceId}
                onChange={handleSourceChange}
                disabled={sourcesLoading || !sources.length}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(203, 213, 225, 0.9)",
                  padding: "0 14px",
                  fontSize: 14,
                  color: "#0f172a",
                  background: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                    {source.read_only ? " • read-only" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="search-box">
            <div className="toolbar-field__label">Search Bar</div>

              <span className="search-box__icon">⌕</span>
              <input
                type="text"
                placeholder="Search slides, folders, paths, or formats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-inline-actions">
              {typeFilterOptions.map((option) => (
                <button
                  key={option.value}
                  className={`filter-pill ${typeFilter === option.value ? "active" : ""}`}
                  onClick={() => setTypeFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <div>
              <h2 className="content-card__title">Library</h2>
              <p className="content-card__subtitle">
                Browse your folders and pathology slide files
              </p>
            </div>

            <div className="content-summary-chip">
              {loading ? "Loading..." : `${filteredItems.length} shown`}
            </div>
          </div>

          {error ? (
            <div className="empty-state empty-state--error">
              <h3 className="empty-state__title">Something went wrong</h3>
              <p className="empty-state__text">{error}</p>
              <div style={{ marginTop: 16 }}>
                <button className="secondary-btn" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {!loading && filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🗂️</div>
              <h3 className="empty-state__title">No items found</h3>
              <p className="empty-state__text">
                Try a different search, change the filter, upload files, or create a new
                folder to get started.
              </p>
            </div>
          ) : (
            <div className="slides-grid">
              {filteredItems.map((item) => (
                <FileManagerCard
                  key={`${item.kind}-${item.path || item.name}`}
                  item={item}
                  onOpen={handleOpenItem}
                  onRename={openRenameModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <UploadPanel
        isOpen={uploadOpen}
        currentPath={currentPath}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploadComplete}
      />

      <Modal
        open={createSourceOpen}
        title="Mount Folder"
        onClose={() => setCreateSourceOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setCreateSourceOpen(false)}
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleCreateSource}>
              Mount
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Display name</label>
          <input
            className="form-input"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Lab Archive"
          />
        </div>

        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Container-visible path</label>
          <input
            className="form-input"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="/data/archive"
          />
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            fontSize: 14,
            color: "#334155",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={sourceReadOnly}
            onChange={(e) => setSourceReadOnly(e.target.checked)}
          />
          Read-only mounted source
        </label>
      </Modal>

      <Modal
        open={createFolderOpen}
        title="New Folder"
        onClose={() => setCreateFolderOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setCreateFolderOpen(false)}
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleCreateFolder}>
              Create
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Name</label>
          <input
            className="form-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
          />
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        title="Rename"
        onClose={() => setRenameOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleRename}>
              Save
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Name</label>
          <input
            className="form-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New name"
          />
        </div>
      </Modal>

      <Modal
        open={deleteSourceOpen}
        title="Unmount Folder"
        onClose={() => setDeleteSourceOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setDeleteSourceOpen(false)}
            >
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDeleteSource}>
              Unmount
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Unmount <strong>{selectedSource?.name || "this source"}</strong>?
          This removes the library from the app, but does not delete files on disk.
        </p>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Delete <strong>{selectedItem?.name || "this item"}</strong>? This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export default SlideManagerPage;