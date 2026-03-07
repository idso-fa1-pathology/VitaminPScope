import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSlides, fetchSlideMetadata } from "../api/slides";
import ChannelPanel from "../components/ChannelPanel";
import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
import VivViewer from "../viewers/VivViewer";
import "../styles/viewer-page.css";

const DEFAULT_CHANNEL_PALETTE = [
  "#0000ff",
  "#00ff00",
  "#ff0000",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
  "#ff9900",
  "#ffffff",
  "#8a2be2",
  "#7fff00",
  "#ff69b4",
  "#00bfff",
];

function getSlideIcon(type) {
  if (type === "ome-tiff") return "🧬";
  if (type === "svs") return "🔬";
  if (type === "ndpi") return "🩺";
  return "🖼️";
}

function ViewerInfoSection({ selectedSlide, slideInfo, isOme, selectedChannelsCount }) {
  return (
    <div className="viewer-sidebar__section">
      <div className="viewer-sidebar__section-header">
        <h3 className="viewer-sidebar__section-title">Slide overview</h3>
        <p className="viewer-sidebar__section-subtitle">
          Metadata and quick context for the current file
        </p>
      </div>

      <div className="viewer-sidebar__section-body">
        <div className="viewer-kv-list">
          <div className="viewer-kv-row">
            <div className="viewer-kv-key">Name</div>
            <div className="viewer-kv-value">{selectedSlide?.name || "-"}</div>
          </div>
          <div className="viewer-kv-row">
            <div className="viewer-kv-key">Type</div>
            <div className="viewer-kv-value">{slideInfo?.type || "-"}</div>
          </div>
          <div className="viewer-kv-row">
            <div className="viewer-kv-key">Viewer</div>
            <div className="viewer-kv-value">{isOme ? "Viv" : "OpenSeadragon"}</div>
          </div>
          <div className="viewer-kv-row">
            <div className="viewer-kv-key">Channels</div>
            <div className="viewer-kv-value">
              {slideInfo?.channels?.length || 0} total / {selectedChannelsCount} active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewerStatusSection({ slideInfo, isOme, selectedChannelsCount }) {
  return (
    <div className="viewer-sidebar__section">
      <div className="viewer-sidebar__section-header">
        <h3 className="viewer-sidebar__section-title">Workspace status</h3>
        <p className="viewer-sidebar__section-subtitle">
          Review-ready summary of the current viewer state
        </p>
      </div>

      <div className="viewer-sidebar__section-body">
        <div className="viewer-status-grid">
          <div className="viewer-status-card">
            <div className="viewer-status-card__label">Mode</div>
            <div className="viewer-status-card__value">{isOme ? "Multi" : "WSI"}</div>
          </div>
          <div className="viewer-status-card">
            <div className="viewer-status-card__label">Active</div>
            <div className="viewer-status-card__value">{selectedChannelsCount}</div>
          </div>
          <div className="viewer-status-card">
            <div className="viewer-status-card__label">Detected</div>
            <div className="viewer-status-card__value">{slideInfo?.channels?.length || 0}</div>
          </div>
          <div className="viewer-status-card">
            <div className="viewer-status-card__label">Format</div>
            <div className="viewer-status-card__value">{slideInfo?.type || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewerToolsSection() {
  return (
    <div className="viewer-sidebar__section">
      <div className="viewer-sidebar__section-header">
        <h3 className="viewer-sidebar__section-title">Quick tools</h3>
        <p className="viewer-sidebar__section-subtitle">
          UI placeholders for a richer review workflow
        </p>
      </div>

      <div className="viewer-sidebar__section-body">
        <div className="viewer-tool-list">
          <button className="viewer-tool-btn">🧭 Reset camera</button>
          <button className="viewer-tool-btn">📏 Measurement tools</button>
          <button className="viewer-tool-btn">📝 Annotations</button>
          <button className="viewer-tool-btn">🤖 AI overlay panel</button>
        </div>
      </div>
    </div>
  );
}

function ViewerPage() {
  const navigate = useNavigate();
  const { slideName } = useParams();

  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideInfo, setSlideInfo] = useState(null);
  const [channelSettings, setChannelSettings] = useState({});
  const [enabledChannelIndexes, setEnabledChannelIndexes] = useState([]);

  useEffect(() => {
    fetchSlides()
      .then((data) => {
        const allSlides = data.slides || [];
        const decodedSlideName = decodeURIComponent(slideName || "");
        const foundSlide = allSlides.find((slide) => slide.name === decodedSlideName);
        setSelectedSlide(foundSlide || null);
      })
      .catch((err) => console.error("Error fetching slides:", err));
  }, [slideName]);

  useEffect(() => {
    if (!selectedSlide) {
      setSlideInfo(null);
      setChannelSettings({});
      setEnabledChannelIndexes([]);
      return;
    }

    fetchSlideMetadata(selectedSlide.path || selectedSlide.name)
      .then((data) => {
        setSlideInfo(data);

        if (data.type === "ome-tiff" && data.channels?.length) {
          const nextSettings = {};

          data.channels.forEach((ch, i) => {
            nextSettings[ch.index] = {
              color: DEFAULT_CHANNEL_PALETTE[i % DEFAULT_CHANNEL_PALETTE.length],
              opacity: 1,
            };
          });

          setChannelSettings(nextSettings);

          const defaultEnabled = data.channels
            .slice(0, Math.min(4, data.channels.length))
            .map((ch) => ch.index);

          setEnabledChannelIndexes(defaultEnabled);
        } else {
          setChannelSettings({});
          setEnabledChannelIndexes([]);
        }
      })
      .catch((err) => {
        console.error("Error loading metadata:", err);
        setSlideInfo(null);
        setChannelSettings({});
        setEnabledChannelIndexes([]);
      });
  }, [selectedSlide]);

  const selectedChannels = useMemo(() => {
    return enabledChannelIndexes
      .map((index) => ({
        index,
        ...(channelSettings[index] || { color: "#ffffff", opacity: 1 }),
      }))
      .sort((a, b) => a.index - b.index);
  }, [enabledChannelIndexes, channelSettings]);

  const toggleChannel = (index) => {
    setEnabledChannelIndexes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const updateChannelSettings = (index, patch) => {
    setChannelSettings((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || { color: "#ffffff", opacity: 1 }),
        ...patch,
      },
    }));
  };

  const isOme = slideInfo?.type === "ome-tiff";

  if (!selectedSlide) {
    return (
      <div className="viewer-not-found">
        <div className="viewer-not-found__header">
          <button className="viewer-btn-ghost" onClick={() => navigate("/")}>
            ← Back to File Manager
          </button>
          <strong>VitaminPScope Viewer</strong>
        </div>

        <div className="viewer-not-found__body">
          Slide not found. Return to the file manager and select a valid slide.
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-page">
      <header className="viewer-topbar">
        <div className="viewer-topbar__left">
          <button className="viewer-btn-ghost" onClick={() => navigate("/")}>
            ← File Manager
          </button>

          <div className="viewer-brand">
            <div className="viewer-brand__title">VitaminPScope Viewer</div>
            <div className="viewer-brand__subtitle">
              Diagnostic slide workspace
            </div>
          </div>

          <div className="viewer-file-chip">
            <div className="viewer-file-chip__icon">{getSlideIcon(slideInfo?.type)}</div>
            <div className="viewer-file-chip__meta">
              <div className="viewer-file-chip__label">Current slide</div>
              <div className="viewer-file-chip__name">{selectedSlide.name}</div>
            </div>
          </div>
        </div>

        <div className="viewer-topbar__right">
          <button className="viewer-btn-secondary">Export snapshot</button>
          <button className="viewer-btn">Open analysis</button>
        </div>
      </header>

      <div className="viewer-body">
        <aside className="viewer-sidebar">
          <ViewerInfoSection
            selectedSlide={selectedSlide}
            slideInfo={slideInfo}
            isOme={isOme}
            selectedChannelsCount={selectedChannels.length}
          />

          <ViewerStatusSection
            slideInfo={slideInfo}
            isOme={isOme}
            selectedChannelsCount={selectedChannels.length}
          />

          {isOme && slideInfo?.channels?.length ? (
            <div className="viewer-sidebar__section">
              <div className="viewer-sidebar__section-header">
                <h3 className="viewer-sidebar__section-title">Channel controls</h3>
                <p className="viewer-sidebar__section-subtitle">
                  Enable, tint, and adjust multichannel rendering
                </p>
              </div>

              <div className="viewer-sidebar__section-body">
                <ChannelPanel
                  channels={slideInfo.channels}
                  selectedChannels={selectedChannels}
                  channelSettings={channelSettings}
                  onToggle={toggleChannel}
                  onUpdate={updateChannelSettings}
                />
              </div>
            </div>
          ) : null}

          <ViewerToolsSection />
        </aside>

        <main className="viewer-stage">
          <div className="viewer-stage__toolbar">
            <div className="viewer-stage__toolbar-left">
              <span className="viewer-badge">{slideInfo?.type || "unknown"}</span>
              <span className="viewer-badge">
                {isOme ? "Multichannel viewer" : "Whole-slide viewer"}
              </span>
            </div>

            <div className="viewer-stage__toolbar-right">
              <span className="viewer-badge">
                {selectedChannels.length} active channel{selectedChannels.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="viewer-canvas-shell">
            <div className="viewer-canvas-card">
              {!slideInfo ? (
                <div className="viewer-empty-state">Loading slide workspace...</div>
              ) : isOme ? (
                <VivViewer
                  slide={selectedSlide}
                  slideInfo={slideInfo}
                  selectedChannels={selectedChannels}
                />
              ) : (
                <OpenSeadragonViewer
                  slide={selectedSlide}
                  slideInfo={slideInfo}
                  selectedChannels={selectedChannels}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ViewerPage;