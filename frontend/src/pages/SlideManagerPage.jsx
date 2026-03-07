import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createFolder,
  deleteItem,
  fetchSlides,
  renameItem,
} from "../api/slides";
import FileManagerCard from "../components/FileManagerCard";
import Modal from "../components/Modal";
import "../styles/slide-manager.css";

function SlideManagerPage() {
  const [slides, setSlides] = useState([]);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const loadSlides = async (path = currentPath) => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchSlides(path);

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
    loadSlides(currentPath);
  }, [currentPath]);

  const handleOpenItem = (item) => {
    if (item.kind === "folder") {
      setCurrentPath(item.path || item.name);
      return;
    }
  
    navigate(`/viewer/${encodeURIComponent(item.path || item.name)}`);
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
      await createFolder(folderName.trim(), currentPath);
      setFolderName("");
      setCreateFolderOpen(false);
      await loadSlides(currentPath);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create folder.");
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
        renameValue.trim()
      );
      setRenameOpen(false);
      setSelectedItem(null);
      setRenameValue("");
      await loadSlides(currentPath);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to rename item.");
    }
  };

  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await deleteItem(selectedItem.path || selectedItem.name);
      setDeleteOpen(false);
      setSelectedItem(null);
      await loadSlides(currentPath);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete item.");
    }
  };

  const items = useMemo(() => {
    const folderItems = folders.map((folder) => ({
      ...folder,
      kind: "folder",
    }));

    const slideItems = slides.map((slide) => ({
      ...slide,
      kind: "slide",
    }));

    return [...folderItems, ...slideItems];
  }, [slides, folders]);

  const counts = useMemo(() => {
    const totalSlides = slides.length;
    const totalFolders = folders.length;
    const ome = slides.filter((s) => s.type === "ome-tiff").length;
    const svs = slides.filter((s) => s.type === "svs").length;

    return { totalSlides, totalFolders, ome, svs };
  }, [slides, folders]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "all"
          ? true
          : typeFilter === "folder"
          ? item.kind === "folder"
          : item.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  return (
    <div className="slide-manager-page">
      <div className="slide-manager-shell">
        <section className="manager-topbar">
          <div>
            <h1 className="app-title">VitaminPScope</h1>
            <div className="manager-eyebrow">File Manager</div>
            <div className="manager-path-row">
              <div className="manager-path">{currentPath || "Root"}</div>
            </div>
          </div>

          <div className="toolbar-actions">
            {currentPath ? (
              <button className="secondary-btn" onClick={handleGoBack}>
                Back
              </button>
            ) : null}

            <button
              className="primary-btn"
              onClick={() => setCreateFolderOpen(true)}
            >
              New Folder
            </button>

            <button
              className="secondary-btn"
              onClick={() => loadSlides(currentPath)}
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="slide-manager-stats slide-manager-stats--compact">
          <div className="stat-tile">
            <div className="stat-tile__label">Items</div>
            <div className="stat-tile__value">{items.length}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">Folders</div>
            <div className="stat-tile__value">{counts.totalFolders}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">OME-TIFF</div>
            <div className="stat-tile__value">{counts.ome}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">SVS</div>
            <div className="stat-tile__value">{counts.svs}</div>
          </div>
        </section>

        <section className="toolbar-card">
          <div className="manager-header-row">
            <div className="search-box">
              <span className="search-box__icon">🔎</span>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-pill-group">
              <button
                className={`filter-pill ${typeFilter === "all" ? "active" : ""}`}
                onClick={() => setTypeFilter("all")}
              >
                All
              </button>
              <button
                className={`filter-pill ${
                  typeFilter === "folder" ? "active" : ""
                }`}
                onClick={() => setTypeFilter("folder")}
              >
                Folders
              </button>
              <button
                className={`filter-pill ${typeFilter === "svs" ? "active" : ""}`}
                onClick={() => setTypeFilter("svs")}
              >
                SVS
              </button>
              <button
                className={`filter-pill ${
                  typeFilter === "ome-tiff" ? "active" : ""
                }`}
                onClick={() => setTypeFilter("ome-tiff")}
              >
                OME-TIFF
              </button>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <h2 className="content-card__title">Items</h2>
            <div className="content-card__subtitle">
              {loading ? "Loading..." : `${filteredItems.length} shown`}
            </div>
          </div>

          {error ? (
            <div className="empty-state" style={{ marginBottom: 16 }}>
              <h3 className="empty-state__title">Something went wrong</h3>
              <p className="empty-state__text">{error}</p>
              <div style={{ marginTop: 14 }}>
                <button className="secondary-btn" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">No items found</h3>
              <p className="empty-state__text">
                Try a different search or filter.
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