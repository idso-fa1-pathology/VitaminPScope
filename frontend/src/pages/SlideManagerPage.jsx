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

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const loadSlides = async () => {
    try {
      setLoading(true);
      const data = await fetchSlides();

      setSlides(data.slides || []);
      setFolders(data.folders || []);
    } catch (err) {
      console.error("Error fetching slides:", err);
      setError("Failed to load file manager data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlides();
  }, []);

  const handleOpenSlide = (slide) => {
    navigate(`/viewer/${encodeURIComponent(slide.name)}`);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      await createFolder(folderName.trim());
      setFolderName("");
      setCreateFolderOpen(false);
      await loadSlides();
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
      await renameItem(selectedItem.path || selectedItem.name, renameValue.trim());
      setRenameOpen(false);
      setSelectedItem(null);
      setRenameValue("");
      await loadSlides();
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
      await loadSlides();
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
    const ome = slides.filter((s) => s.type === "ome-tiff").length;
    const svs = slides.filter((s) => s.type === "svs").length;
    const totalFolders = folders.length;

    return { totalSlides, totalFolders, ome, svs };
  }, [slides, folders]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());

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
        <section className="slide-manager-hero">
          <div className="slide-manager-hero__left">
            <div className="slide-manager-badge">VitaminPScope workspace</div>
            <h1 className="slide-manager-title">VitaminPScope File Manager</h1>
            <p className="slide-manager-subtitle">
              Organize digital pathology files, manage folders, and launch a
              dedicated slide viewer from a cleaner and more professional workspace.
            </p>
          </div>

          <div className="slide-manager-hero__right">
            <div className="hero-panel">
              <div className="hero-panel__label">Available items</div>
              <div className="hero-panel__value">{items.length}</div>
              <div className="hero-panel__hint">
                Files and folders available in your current workspace.
              </div>
            </div>
          </div>
        </section>

        <section className="slide-manager-stats">
          <div className="stat-tile">
            <div className="stat-tile__label">Folders</div>
            <div className="stat-tile__value">{counts.totalFolders}</div>
            <div className="stat-tile__meta">Organized containers</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">Slides</div>
            <div className="stat-tile__value">{counts.totalSlides}</div>
            <div className="stat-tile__meta">Available pathology files</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">OME-TIFF</div>
            <div className="stat-tile__value">{counts.ome}</div>
            <div className="stat-tile__meta">Multichannel slides</div>
          </div>

          <div className="stat-tile">
            <div className="stat-tile__label">SVS</div>
            <div className="stat-tile__value">{counts.svs}</div>
            <div className="stat-tile__meta">Whole-slide pathology</div>
          </div>
        </section>

        <section className="slide-manager-toolbar">
          <div className="toolbar-card">
            <div className="manager-header-row">
              <div className="search-box">
                <span className="search-box__icon">🔎</span>
                <input
                  type="text"
                  placeholder="Search folders or slides..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="toolbar-actions">
                <button
                  className="primary-btn"
                  onClick={() => setCreateFolderOpen(true)}
                >
                  + New Folder
                </button>

                <button className="secondary-btn" onClick={loadSlides}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="toolbar-row">
              <div className="filter-pill-group">
                <button
                  className={`filter-pill ${typeFilter === "all" ? "active" : ""}`}
                  onClick={() => setTypeFilter("all")}
                >
                  All
                </button>
                <button
                  className={`filter-pill ${typeFilter === "folder" ? "active" : ""}`}
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
                  className={`filter-pill ${typeFilter === "ome-tiff" ? "active" : ""}`}
                  onClick={() => setTypeFilter("ome-tiff")}
                >
                  OME-TIFF
                </button>
              </div>
            </div>
          </div>

          <div className="upload-card">
            <div>
              <h3 className="upload-card__title">Workspace actions</h3>
              <p className="upload-card__text">
                Create folders, rename assets, and remove files from a cleaner
                management interface.
              </p>
            </div>

            <div className="upload-dropzone">
              <div className="upload-dropzone__label">Professional workflow</div>
              <div className="upload-dropzone__hint">
                Next step can be drag-and-drop uploads, move-to-folder support,
                and breadcrumbs for nested folder navigation.
              </div>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <div>
              <h2 className="content-card__title">Workspace items</h2>
              <p className="content-card__subtitle">
                Open slides in the viewer, or manage folders and file names.
              </p>
            </div>

            <div className="content-card__subtitle">
              {loading ? "Loading..." : `Showing ${filteredItems.length} items`}
            </div>
          </div>

          {error ? (
            <div className="empty-state" style={{ marginBottom: "16px" }}>
              <h3 className="empty-state__title">Action failed</h3>
              <p className="empty-state__text">{error}</p>
              <div style={{ marginTop: "14px" }}>
                <button
                  className="secondary-btn"
                  onClick={() => setError("")}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">No matching items</h3>
              <p className="empty-state__text">
                Try another search term, create a folder, or change the filter.
              </p>
            </div>
          ) : (
            <div className="slides-grid">
              {filteredItems.map((item) => (
                <FileManagerCard
                  key={`${item.kind}-${item.path || item.name}`}
                  item={item}
                  onOpen={handleOpenSlide}
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
        title="Create new folder"
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
              Create folder
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Folder name</label>
          <input
            className="form-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
          />
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        title="Rename item"
        onClose={() => setRenameOpen(false)}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setRenameOpen(false)}>
              Cancel
            </button>
            <button className="primary-btn" onClick={handleRename}>
              Save changes
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">New name</label>
          <input
            className="form-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter new item name"
          />
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete item"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button className="danger-btn" onClick={handleDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="modal-help-text">
          Are you sure you want to delete{" "}
          <strong>{selectedItem?.name || "this item"}</strong>? This action cannot
          be undone.
        </p>
      </Modal>
    </div>
  );
}

export default SlideManagerPage;