import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSlides } from "../api/slides";
import SlideCard from "../components/SlideCard";
import "../styles/slide-manager.css";

function SlideManagerPage() {
  const [slides, setSlides] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    fetchSlides()
      .then((data) => setSlides(data.slides || []))
      .catch((err) => console.error("Error fetching slides:", err));
  }, []);

  const handleOpenSlide = (slide) => {
    navigate(`/viewer/${encodeURIComponent(slide.name)}`);
  };

  const counts = useMemo(() => {
    const total = slides.length;
    const ome = slides.filter((s) => s.type === "ome-tiff").length;
    const svs = slides.filter((s) => s.type === "svs").length;
    const other = total - ome - svs;

    return { total, ome, svs, other };
  }, [slides]);

  const filteredSlides = useMemo(() => {
    return slides.filter((slide) => {
      const matchesSearch = slide.name.toLowerCase().includes(search.toLowerCase());

      const matchesType =
        typeFilter === "all" ? true : slide.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [slides, search, typeFilter]);

  return (
    <div className="slide-manager-page">
      <div className="slide-manager-shell">
        <section className="slide-manager-hero">
          <div className="slide-manager-hero__left">
            <div className="slide-manager-badge">Polyscope workspace</div>
            <h1 className="slide-manager-title">Pathology Slide Manager</h1>
            <p className="slide-manager-subtitle">
              Browse whole-slide images, organize available files, and launch a
              dedicated viewing workspace for review and channel exploration.
            </p>
          </div>

          <div className="slide-manager-hero__right">
            <div className="hero-panel">
              <div className="hero-panel__label">Available dataset</div>
              <div className="hero-panel__value">{counts.total}</div>
              <div className="hero-panel__hint">
                Slides ready to open in the dedicated viewer page.
              </div>
            </div>
          </div>
        </section>

        <section className="slide-manager-stats">
          <div className="stat-tile">
            <div className="stat-tile__label">Total slides</div>
            <div className="stat-tile__value">{counts.total}</div>
            <div className="stat-tile__meta">All available files</div>
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

          <div className="stat-tile">
            <div className="stat-tile__label">Other formats</div>
            <div className="stat-tile__value">{counts.other}</div>
            <div className="stat-tile__meta">Additional image types</div>
          </div>
        </section>

        <section className="slide-manager-toolbar">
          <div className="toolbar-card">
            <div className="toolbar-row">
              <div className="search-box">
                <span className="search-box__icon">🔎</span>
                <input
                  type="text"
                  placeholder="Search slide name..."
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
              <h3 className="upload-card__title">Slide intake</h3>
              <p className="upload-card__text">
                This area can later become your upload, sync, or drag-and-drop
                entry point for new pathology files.
              </p>
            </div>

            <div className="upload-dropzone">
              <div className="upload-dropzone__label">Drop files here</div>
              <div className="upload-dropzone__hint">
                Future-ready space for uploads, ingestion status, and supported
                slide formats.
              </div>
            </div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card__top">
            <div>
              <h2 className="content-card__title">Available slides</h2>
              <p className="content-card__subtitle">
                Click any slide card to open the dedicated viewer.
              </p>
            </div>

            <div className="content-card__subtitle">
              Showing {filteredSlides.length} of {slides.length}
            </div>
          </div>

          {filteredSlides.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">No matching slides</h3>
              <p className="empty-state__text">
                Try another search term or switch the selected format filter.
              </p>
            </div>
          ) : (
            <div className="slides-grid">
              {filteredSlides.map((slide) => (
                <SlideCard
                  key={slide.name}
                  slide={slide}
                  onOpen={handleOpenSlide}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SlideManagerPage;