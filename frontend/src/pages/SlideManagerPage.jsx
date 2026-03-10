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
import {
  deleteCompareSession,
  fetchCompareSessions,
  renameCompareSession,
} from "../api/compareSessions";
import CompareSessionCard from "../components/CompareSessionCard";
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

function formatBytes(size) {
  if (size === null || size === undefined || Number.isNaN(Number(size))) {
    return "—";
  }

  const value = Number(size);
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let unitIndex = -1;
  let nextValue = value;

  do {
    nextValue /= 1024;
    unitIndex += 1;
  } while (nextValue >= 1024 && unitIndex < units.length - 1);

  return `${nextValue.toFixed(nextValue >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function SlideManagerPage() {
  const [slides, setSlides] = useState([]);
  const [folders, setFolders] = useState([]);
  const [compareSessions, setCompareSessions] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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

  const [selectedSession, setSelectedSession] = useState(null);
  const [renameSessionOpen, setRenameSessionOpen] = useState(false);
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);
  const [renameSessionValue, setRenameSessionValue] = useState("");

  const navigate = useNavigate();
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const loadSources = async () => {
    try {
      setSourcesLoading(true);
      const data = await fetchSources();
      const nextSources = data.sources || [];
      setSources(nextSources);

      if (
        !nextSources.some((source) => source.id === currentSourceId) &&
        nextSources.length
      ) {
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

  const loadCompareSessions = async () => {
    try {
      setSessionsLoading(true);
      const data = await fetchCompareSessions();
      setCompareSessions(data.sessions || []);
    } catch (err) {
      console.error("Error fetching compare sessions:", err);
      setError(err.message || "Failed to load compare sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
    loadCompareSessions();
  }, []);

  useEffect(() => {
    loadSlides(currentPath, currentSourceId);
  }, [currentPath, currentSourceId]);

  useEffect(() => {
    setSelectedSlides([]);
    setSelectionMode(false);
  }, [currentPath, currentSourceId]);

  const handleOpenItem = (item) => {
    if (selectionMode && item.kind === "slide") {
      const itemKey = `${item.source_id || currentSourceId}::${item.path || item.name}`;

      setSelectedSlides((prev) => {
        const exists = prev.some(
          (slide) =>
            `${slide.source_id || currentSourceId}::${slide.path || slide.name}` ===
            itemKey
        );

        if (exists) {
          return prev.filter(
            (slide) =>
              `${slide.source_id || currentSourceId}::${slide.path || slide.name}` !==
              itemKey
          );
        }

        return [...prev, item];
      });

      return;
    }

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

  const handleBreadcrumbClick = (index) => {
    if (index < 0) {
      setCurrentPath("");
      return;
    }

    const parts = currentPath.split("/").filter(Boolean);
    setCurrentPath(parts.slice(0, index + 1).join("/"));
  };

  const handleClearSelection = () => {
    setSelectedSlides([]);
    setSelectionMode(false);
  };

  const handleOpenCompare = () => {
    if (selectedSlides.length < 2) return;

    const encodedSlides = selectedSlides
      .map((slide) => slide.path || slide.name)
      .join("||");

    navigate(
      `/compare?source_id=${encodeURIComponent(currentSourceId)}&slides=${encodeURIComponent(
        encodedSlides
      )}`
    );
  };

  const handleOpenCompareSession = (session) => {
    const slides = Array.isArray(session?.slides) ? session.slides : [];
    if (slides.length < 2) return;

    navigate(
      `/compare?source_id=${encodeURIComponent(
        session.source_id || "default"
      )}&slides=${encodeURIComponent(slides.join("||"))}`
    );
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

  const openRenameSessionModal = (session) => {
    setSelectedSession(session);
    setRenameSessionValue(session?.name || "");
    setRenameSessionOpen(true);
  };

  const openDeleteSessionModal = (session) => {
    setSelectedSession(session);
    setDeleteSessionOpen(true);
  };

  const handleRenameSession = async () => {
    if (!selectedSession || !renameSessionValue.trim()) return;

    try {
      await renameCompareSession(selectedSession.id, renameSessionValue.trim());
      setRenameSessionOpen(false);
      setSelectedSession(null);
      setRenameSessionValue("");
      await loadCompareSessions();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to rename compare session.");
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;

    try {
      await deleteCompareSession(selectedSession.id);
      setDeleteSessionOpen(false);
      setSelectedSession(null);
      await loadCompareSessions();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete compare session.");
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
    const totalSize = slides.reduce((sum, slide) => {
      const n = Number(slide?.size || 0);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);

    return {
      totalSlides,
      totalFolders,
      totalItems,
      uniqueFormats,
      topFormats,
      totalSize,
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

  const breadcrumbParts = useMemo(() => {
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const selectedCountLabel = `${selectedSlides.length} selected`;

  return (
    <div className="slide-manager-page">
      <div className="slide-manager-shell">
        <section className="hero-panel hero-panel--compact">
          <div className="hero-panel__content">
            <div className="manager-eyebrow">Digital Pathology Workspace</div>
            <div className="workspace-header">
              <div>
                <h1 className="app-title app-title--compact">Slide Manager</h1>
                <p className="hero-panel__subtitle">
                  Browse pathology slides, manage folders, mount data sources, and reopen
                  synchronized compare sessions from one streamlined workspace.
                </p>
              </div>

              <div className="workspace-status">
                <span className="hero-badge">
                  Source: {currentSource?.name || currentSourceId}
                </span>
                {currentSource ? (
                  <span className="hero-badge">
                    {currentSource.read_only ? "Read-only" : "Writable"}
                  </span>
                ) : null}
                <span className="hero-badge">
                  {counts.totalSlides} slide{counts.totalSlides === 1 ? "" : "s"}
                </span>
                <span className="hero-badge">
                  {compareSessions.length} compare session
                  {compareSessions.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="workspace-topbar toolbar-card">
          <div className="workspace-topbar__main">
            <div className="workspace-field workspace-field--source">
              <div className="toolbar-field__label">Workspace Source</div>
              <select
                value={currentSourceId}
                onChange={handleSourceChange}
                disabled={sourcesLoading || !sources.length}
                className="workspace-select"
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                    {source.read_only ? " • read-only" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="workspace-field workspace-field--search">
              <div className="toolbar-field__label">Search Library</div>
              <div className="search-box">
                <span className="search-box__icon">⌕</span>
                <input
                  type="text"
                  placeholder="Search slides, folders, paths, or formats..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="quick-actions-bar">
            <div className="quick-actions-bar__title">Quick Actions</div>

            <div className="quick-actions-bar__items">
              <button
                className="primary-btn"
                onClick={() => setUploadOpen(true)}
                disabled={currentSource?.read_only}
                type="button"
              >
                Upload Slides
              </button>

              <button
                className="secondary-btn"
                onClick={() => setCreateFolderOpen(true)}
                disabled={currentSource?.read_only}
                type="button"
              >
                New Folder
              </button>

              <button
                className="secondary-btn"
                onClick={() => setCreateSourceOpen(true)}
                type="button"
              >
                Mount Source
              </button>

              {currentSourceId !== "default" ? (
                <button
                  className="secondary-btn"
                  onClick={() => openDeleteSourceModal(currentSource)}
                  disabled={!currentSource}
                  type="button"
                >
                  Unmount
                </button>
              ) : null}

              <button
                className="secondary-btn"
                onClick={() => {
                  if (selectionMode) {
                    handleClearSelection();
                  } else {
                    setSelectionMode(true);
                  }
                }}
                type="button"
              >
                {selectionMode ? "Cancel Selection" : "Select for Compare"}
              </button>

              <button
                className="primary-btn"
                onClick={handleOpenCompare}
                disabled={selectedSlides.length < 2}
                type="button"
              >
                Open Compare ({selectedSlides.length})
              </button>
            </div>
          </div>
        </section>

        <section className="slide-manager-stats">
          <div className="stat-tile">
            <div className="stat-tile__label">Visible Items</div>
            <div className="stat-tile__value">{filteredItems.length}</div>
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
            <div className="stat-tile__label">Library Size</div>
            <div className="stat-tile__value stat-tile__value--small">
              {formatBytes(counts.totalSize)}
            </div>
          </div>
        </section>

        <section className="toolbar-card library-toolbar-card">
          <div className="library-toolbar-card__top">
            <div>
              <div className="toolbar-field__label">Current Location</div>
              <div className="path-shell" title={currentPath || "Root"}>
                <div className="breadcrumb-trail">
                  <button
                    type="button"
                    className={`breadcrumb-chip ${!currentPath ? "active" : ""}`}
                    onClick={() => handleBreadcrumbClick(-1)}
                  >
                    Root
                  </button>

                  {breadcrumbParts.map((part, index) => {
                    const isActive = index === breadcrumbParts.length - 1;

                    return (
                      <div key={`${part}-${index}`} className="breadcrumb-segment">
                        <span className="breadcrumb-divider">/</span>
                        <button
                          type="button"
                          className={`breadcrumb-chip ${isActive ? "active" : ""}`}
                          onClick={() => handleBreadcrumbClick(index)}
                        >
                          {part}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="library-toolbar-card__actions">
              {currentPath ? (
                <button className="secondary-btn" onClick={handleGoBack} type="button">
                  ← Parent
                </button>
              ) : null}

              <button
                className="secondary-btn"
                onClick={() => loadSlides(currentPath, currentSourceId)}
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="library-toolbar-card__bottom">
            <div className="filter-row">
              <div className="toolbar-field__label">Smart Filters</div>
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

            {(selectionMode || search || typeFilter !== "all") && (
              <div className="library-status-row">
                {selectionMode ? (
                  <div className="content-summary-chip">{selectedCountLabel}</div>
                ) : null}

                {search ? (
                  <div className="content-summary-chip">Search: {search}</div>
                ) : null}

                {typeFilter !== "all" ? (
                  <div className="content-summary-chip">
                    Filter: {getTypeLabel(typeFilter)}
                  </div>
                ) : null}

                {(selectionMode || search || typeFilter !== "all") && (
                  <button
                    className="secondary-btn secondary-btn--small"
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      handleClearSelection();
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <div>
              <h2 className="content-card__title">Saved Compare Sessions</h2>
              <p className="content-card__subtitle">
                Reopen synchronized multi-slide workspaces and continue where you left off
              </p>
            </div>

            <div className="content-summary-chip">
              {sessionsLoading ? "Loading..." : `${compareSessions.length} saved`}
            </div>
          </div>

          {compareSessions.length === 0 && !sessionsLoading ? (
            <div className="empty-state">
              <div className="empty-state__icon">🔗</div>
              <h3 className="empty-state__title">No saved compare sessions yet</h3>
              <p className="empty-state__text">
                Select 2 or more slides, open compare view, and save the session to make
                it available here.
              </p>
            </div>
          ) : (
            <div className="compare-session-grid">
              {compareSessions.map((session) => (
                <CompareSessionCard
                  key={session.id}
                  session={session}
                  onOpen={handleOpenCompareSession}
                  onRename={openRenameSessionModal}
                  onDelete={openDeleteSessionModal}
                />
              ))}
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <div>
              <h2 className="content-card__title">Library Browser</h2>
              <p className="content-card__subtitle">
                Browse folders and pathology slide files in the active workspace
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
                <button className="secondary-btn" onClick={() => setError("")} type="button">
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
                Try a different search, change the filter, upload slides, or create a new
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
                  selectionMode={selectionMode}
                  isSelected={selectedSlides.some(
                    (slide) =>
                      (slide.path || slide.name) === (item.path || item.name) &&
                      (slide.source_id || currentSourceId) ===
                        (item.source_id || currentSourceId)
                  )}
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
              type="button"
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleCreateSource} type="button">
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
              type="button"
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleCreateFolder} type="button">
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
              type="button"
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleRename} type="button">
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
        open={renameSessionOpen}
        title="Rename Compare Session"
        onClose={() => setRenameSessionOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setRenameSessionOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-btn" onClick={handleRenameSession} type="button">
              Save
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Session name</label>
          <input
            className="form-input"
            value={renameSessionValue}
            onChange={(e) => setRenameSessionValue(e.target.value)}
            placeholder="New session name"
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
              type="button"
            >
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDeleteSource} type="button">
              Unmount
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Unmount <strong>{selectedSource?.name || "this source"}</strong>? This removes
          the library from the app, but does not delete files on disk.
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
              type="button"
            >
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDelete} type="button">
              Delete
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Delete <strong>{selectedItem?.name || "this item"}</strong>? This cannot be
          undone.
        </p>
      </Modal>

      <Modal
        open={deleteSessionOpen}
        title="Delete Compare Session"
        onClose={() => setDeleteSessionOpen(false)}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setDeleteSessionOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDeleteSession} type="button">
              Delete
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Delete compare session{" "}
          <strong>{selectedSession?.name || "this session"}</strong>? This only removes
          the saved workspace, not the actual slide files.
        </p>
      </Modal>
    </div>
  );
}

export default SlideManagerPage;