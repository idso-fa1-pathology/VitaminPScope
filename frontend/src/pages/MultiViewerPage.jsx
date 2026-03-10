import {
    createRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from "react";
  import { useNavigate, useSearchParams } from "react-router-dom";
  import { buildThumbnailUrl, fetchSlideMetadata } from "../api/slides";
  import { createCompareSession } from "../api/compareSessions";
  import {
    DEFAULT_ANNOTATION_COLOR,
    TOOL_PAN,
  } from "../annotations/annotationTypes";
  import { DEFAULT_IMAGE_ADJUSTMENTS } from "../components/ImageAdjustPanel";
  import {
    getSlideIcon,
    isOmeTiffSlide,
    normalizeChannels,
  } from "./viewer/viewerHelpers";
  import OpenSeadragonViewer from "../viewers/OpenSeadragonViewer";
  import VivViewer from "../viewers/VivViewer";
  import "../styles/viewer-page.css";
  import "../styles/multi-viewer.css";
  import Modal from "../components/Modal";

  function moveItem(list, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }
  
  function MultiViewerPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
  
    const sourceId = searchParams.get("source_id") || "default";
    const slidesParam = searchParams.get("slides") || "";
  
    const slidePaths = useMemo(() => {
      return slidesParam
        .split("||")
        .map((s) => s.trim())
        .filter(Boolean);
    }, [slidesParam]);
  
    const [slideEntries, setSlideEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [theme, setTheme] = useState("dark");
    const [gridMode, setGridMode] = useState("auto");
    const [showTileOverlays, setShowTileOverlays] = useState(true);
    const [showTileZoomControls, setShowTileZoomControls] = useState(true);
    const [lockedLeaderId, setLockedLeaderId] = useState(null);
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [savingSession, setSavingSession] = useState(false);
    const [saveCompareOpen, setSaveCompareOpen] = useState(false);
    const [saveCompareName, setSaveCompareName] = useState("");
    const [saveCompareMessage, setSaveCompareMessage] = useState("");
    const [saveCompareError, setSaveCompareError] = useState("");
  
    const viewerRefs = useRef({});
    const leaderRef = useRef(null);
    const leaderReleaseTimerRef = useRef(null);
  
    const EMPTY_ARRAY = useMemo(() => [], []);
    const NOOP = useCallback(() => {}, []);
  
    useEffect(() => {
      return () => {
        if (leaderReleaseTimerRef.current) {
          clearTimeout(leaderReleaseTimerRef.current);
        }
      };
    }, []);
  
    useEffect(() => {
      let cancelled = false;
  
      async function loadSlides() {
        if (slidePaths.length === 0) {
          setSlideEntries([]);
          return;
        }
  
        try {
          setLoading(true);
  
          const results = await Promise.all(
            slidePaths.map(async (slidePath) => {
              try {
                const slideInfo = await fetchSlideMetadata(slidePath, sourceId);
                const normalizedChannels = normalizeChannels(slideInfo);
                const useViv = isOmeTiffSlide(slideInfo);
                const id = `${sourceId}::${slidePath}`;
  
                if (!viewerRefs.current[id]) {
                  viewerRefs.current[id] = createRef();
                }
  
                return {
                  id,
                  slide: {
                    name: slidePath.split("/").pop() || slidePath,
                    path: slidePath,
                    sourceId,
                  },
                  slideInfo,
                  normalizedChannels,
                  selectedChannels: useViv
                    ? normalizedChannels
                        .slice(0, Math.min(4, normalizedChannels.length))
                        .map((ch) => ({
                          index: ch.index,
                          color: ch.color ?? null,
                          opacity: 1,
                        }))
                    : [],
                  useVivViewer: useViv,
                  error: "",
                };
              } catch (error) {
                const id = `${sourceId}::${slidePath}`;
  
                if (!viewerRefs.current[id]) {
                  viewerRefs.current[id] = createRef();
                }
  
                return {
                  id,
                  slide: {
                    name: slidePath.split("/").pop() || slidePath,
                    path: slidePath,
                    sourceId,
                  },
                  slideInfo: null,
                  normalizedChannels: [],
                  selectedChannels: [],
                  useVivViewer: false,
                  error: error.message || "Failed to load metadata",
                };
              }
            })
          );
  
          if (!cancelled) {
            setSlideEntries(results);
            setLockedLeaderId((prev) =>
              results.some((entry) => entry.id === prev) ? prev : null
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }
  
      loadSlides();
  
      return () => {
        cancelled = true;
      };
    }, [slidePaths, sourceId]);
  
    const buildPreviewUrl = useCallback(
      (slide) => {
        const slidePath = slide?.path || slide?.name;
        return buildThumbnailUrl(slidePath, {
          max_size: 1600,
          sourceId: slide?.sourceId || sourceId,
        });
      },
      [sourceId]
    );
  
    const claimLeader = useCallback(
      (entryId) => {
        if (!syncEnabled) return;
  
        if (lockedLeaderId && lockedLeaderId !== entryId) {
          leaderRef.current = lockedLeaderId;
          return;
        }
  
        leaderRef.current = entryId;
  
        if (leaderReleaseTimerRef.current) {
          clearTimeout(leaderReleaseTimerRef.current);
          leaderReleaseTimerRef.current = null;
        }
      },
      [syncEnabled, lockedLeaderId]
    );
  
    const releaseLeaderSoon = useCallback(
      (entryId) => {
        if (lockedLeaderId && lockedLeaderId === entryId) {
          leaderRef.current = lockedLeaderId;
          return;
        }
  
        if (leaderRef.current !== entryId) return;
  
        if (leaderReleaseTimerRef.current) {
          clearTimeout(leaderReleaseTimerRef.current);
        }
  
        leaderReleaseTimerRef.current = setTimeout(() => {
          if (leaderRef.current === entryId) {
            leaderRef.current = null;
          }
        }, 150);
      },
      [lockedLeaderId]
    );
  
    const handleViewportChange = useCallback(
      (sourceEntryId, nextViewport) => {
        if (!syncEnabled || !nextViewport) return;
        if (leaderRef.current !== sourceEntryId) return;
  
        for (const entry of slideEntries) {
          if (entry.id === sourceEntryId) continue;
  
          const targetRef = viewerRefs.current[entry.id]?.current;
          targetRef?.setViewportState?.(nextViewport);
        }
      },
      [slideEntries, syncEnabled]
    );
  
    const handleResetAllViews = useCallback(() => {
      slideEntries.forEach((entry) => {
        const viewerRef = viewerRefs.current[entry.id]?.current;
        viewerRef?.resetView?.();
      });
    }, [slideEntries]);
  
    const handleZoomAllIn = useCallback(() => {
      slideEntries.forEach((entry) => {
        const viewerRef = viewerRefs.current[entry.id]?.current;
        viewerRef?.zoomIn?.();
      });
    }, [slideEntries]);
  
    const handleZoomAllOut = useCallback(() => {
      slideEntries.forEach((entry) => {
        const viewerRef = viewerRefs.current[entry.id]?.current;
        viewerRef?.zoomOut?.();
      });
    }, [slideEntries]);
  
    const handleToggleLeaderLock = useCallback((entryId) => {
      setLockedLeaderId((prev) => {
        const next = prev === entryId ? null : entryId;
        leaderRef.current = next || entryId;
        return next;
      });
    }, []);
  
    const handleDragStart = useCallback((entryId) => {
      setDraggingId(entryId);
      setDragOverId(entryId);
    }, []);
  
    const handleDragOver = useCallback(
      (event, entryId) => {
        event.preventDefault();
        if (dragOverId !== entryId) {
          setDragOverId(entryId);
        }
      },
      [dragOverId]
    );
  
    const handleDrop = useCallback(
      (event, targetId) => {
        event.preventDefault();
  
        setSlideEntries((prev) => {
          const fromIndex = prev.findIndex((entry) => entry.id === draggingId);
          const toIndex = prev.findIndex((entry) => entry.id === targetId);
          return moveItem(prev, fromIndex, toIndex);
        });
  
        setDraggingId(null);
        setDragOverId(null);
      },
      [draggingId]
    );
  
    const handleDragEnd = useCallback(() => {
      setDraggingId(null);
      setDragOverId(null);
    }, []);
  
    const handleSaveCompare = useCallback(() => {
        if (slideEntries.length < 2) return;
    
        const defaultName =
          slideEntries.length <= 3
            ? slideEntries.map((entry) => entry.slide.name).join(" vs ")
            : `${slideEntries[0]?.slide?.name || "Compare"} + ${slideEntries.length - 1} more`;
    
        setSaveCompareName(defaultName);
        setSaveCompareError("");
        setSaveCompareOpen(true);
      }, [slideEntries]);

      const handleConfirmSaveCompare = useCallback(async () => {
        if (!saveCompareName.trim() || slideEntries.length < 2) {
          setSaveCompareError("Please enter a session name.");
          return;
        }
    
        try {
          setSavingSession(true);
          setSaveCompareError("");
    
          await createCompareSession({
            name: saveCompareName.trim(),
            source_id: sourceId,
            slides: slideEntries.map((entry) => entry.slide.path || entry.slide.name),
            layout: gridMode,
            sync_enabled: syncEnabled,
          });
    
          setSaveCompareOpen(false);
          setSaveCompareMessage(`Saved compare session: ${saveCompareName.trim()}`);
    
          window.setTimeout(() => {
            setSaveCompareMessage("");
          }, 2600);
        } catch (error) {
          setSaveCompareError(error.message || "Failed to save compare session.");
        } finally {
          setSavingSession(false);
        }
      }, [gridMode, saveCompareName, slideEntries, sourceId, syncEnabled]);
  
    useEffect(() => {
      if (!syncEnabled) {
        leaderRef.current = null;
  
        if (leaderReleaseTimerRef.current) {
          clearTimeout(leaderReleaseTimerRef.current);
          leaderReleaseTimerRef.current = null;
        }
      } else if (lockedLeaderId) {
        leaderRef.current = lockedLeaderId;
      }
    }, [syncEnabled, lockedLeaderId]);
  
    const gridTemplateColumns = useMemo(() => {
      if (gridMode === "1") return "1fr";
      if (gridMode === "2") return "repeat(2, minmax(0, 1fr))";
      if (gridMode === "3") return "repeat(3, minmax(0, 1fr))";
  
      if (slideEntries.length <= 1) return "1fr";
      if (slideEntries.length === 2) return "repeat(2, minmax(0, 1fr))";
      if (slideEntries.length <= 4) return "repeat(2, minmax(0, 1fr))";
      return "repeat(3, minmax(0, 1fr))";
    }, [gridMode, slideEntries.length]);
  
    const pageStyle =
      theme === "dark"
        ? {
            minHeight: "100vh",
            background:
              "linear-gradient(180deg, #0b1220 0%, #0f172a 45%, #111827 100%)",
            color: "#e2e8f0",
          }
        : {
            minHeight: "100vh",
            background:
              "linear-gradient(180deg, #f8fafc 0%, #eef2ff 40%, #e2e8f0 100%)",
            color: "#0f172a",
          };
  
    const cardBg = theme === "dark" ? "#111827" : "rgba(255,255,255,0.92)";
    const cardBorder = theme === "dark" ? "#334155" : "rgba(148,163,184,0.35)";
    const cardHeaderBg = theme === "dark" ? "#0b1220" : "rgba(248,250,252,0.95)";
    const mutedText = theme === "dark" ? "#94a3b8" : "#475569";
    const titleText = theme === "dark" ? "#e2e8f0" : "#0f172a";
    const chipBg =
      theme === "dark" ? "rgba(30, 41, 59, 0.85)" : "rgba(255,255,255,0.9)";
    const chipBorder =
      theme === "dark" ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)";
  
    return (
      <div className={`viewer-page viewer-page--${theme} multi-viewer-page`} style={pageStyle}>
        <header className="viewer-topbar">
          <div className="viewer-topbar__left">
            <button className="viewer-btn-ghost" onClick={() => navigate("/")} type="button">
              ← File Manager
            </button>
  
            <div className="viewer-brand">
              <div className="viewer-brand__title">VitaminPScope Compare</div>
              <div className="viewer-brand__subtitle">MultiZoom / synchronized view</div>
            </div>
  
            <div className="viewer-file-chip">
              <div className="viewer-file-chip__icon">🪟</div>
              <div className="viewer-file-chip__meta">
                <div className="viewer-file-chip__label">Workspace</div>
                <div className="viewer-file-chip__name">
                  {slideEntries.length} slide{slideEntries.length === 1 ? "" : "s"} • Source {sourceId}
                </div>
              </div>
            </div>
          </div>
  
          <div className="viewer-topbar__right">
            <button
              className="viewer-btn-secondary"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              type="button"
            >
              {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
  
            <button
              className="viewer-btn-secondary"
              onClick={() => setShowTileOverlays((prev) => !prev)}
              type="button"
            >
              {showTileOverlays ? "Hide labels" : "Show labels"}
            </button>
  
            <button
              className="viewer-btn-secondary"
              onClick={() => setShowTileZoomControls((prev) => !prev)}
              type="button"
            >
              {showTileZoomControls ? "Hide controls" : "Show controls"}
            </button>
  
            <button
              className="viewer-btn-secondary"
              onClick={() => setSyncEnabled((prev) => !prev)}
              type="button"
            >
              {syncEnabled ? "🔗 Sync on" : "⛓️ Sync off"}
            </button>
  
            <button className="viewer-btn-secondary" onClick={handleResetAllViews} type="button">
              Reset all
            </button>
  
            <button
              className="viewer-btn"
              onClick={handleSaveCompare}
              type="button"
              disabled={slideEntries.length < 2 || savingSession}
            >
              {savingSession ? "Saving..." : "Save Compare"}
            </button>
          </div>
        </header>
        {saveCompareMessage ? (
            <div className="multi-viewer-toast">
            {saveCompareMessage}
            </div>
        ) : null}
        <div className="viewer-body multi-viewer-body">
          <main className="viewer-stage multi-viewer-stage">
            <div className="viewer-canvas-shell multi-viewer-shell">
              <div
                className="viewer-canvas-card multi-viewer-card"
                style={{
                  padding: 18,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow:
                    theme === "dark"
                      ? "0 18px 50px rgba(2, 6, 23, 0.42)"
                      : "0 18px 50px rgba(15, 23, 42, 0.10)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                        color: mutedText,
                        marginBottom: 6,
                      }}
                    >
                      Compare workspace
                    </div>
  
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 24,
                        color: titleText,
                      }}
                    >
                      MultiZoom synchronized review
                    </h2>
  
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: mutedText,
                        fontSize: 14,
                      }}
                    >
                      Drag cards to reorder. Pan and zoom one viewer to update the others.
                    </p>
                  </div>
  
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button className="viewer-btn-secondary" onClick={handleZoomAllIn} type="button">
                      Zoom all in
                    </button>
  
                    <button className="viewer-btn-secondary" onClick={handleZoomAllOut} type="button">
                      Zoom all out
                    </button>
  
                    <button className="viewer-btn-secondary" onClick={handleResetAllViews} type="button">
                      Reset all views
                    </button>
  
                    <select
                      value={gridMode}
                      onChange={(e) => setGridMode(e.target.value)}
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: `1px solid ${cardBorder}`,
                        padding: "0 12px",
                        background: theme === "dark" ? "#0f172a" : "#fff",
                        color: titleText,
                        fontSize: 14,
                        outline: "none",
                      }}
                    >
                      <option value="auto">Grid: Auto</option>
                      <option value="1">Grid: 1 column</option>
                      <option value="2">Grid: 2 columns</option>
                      <option value="3">Grid: 3 columns</option>
                    </select>
                  </div>
                </div>
  
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <span
                    className="viewer-badge"
                    style={{
                      background: chipBg,
                      border: `1px solid ${chipBorder}`,
                      color: titleText,
                    }}
                  >
                    {slideEntries.length} viewer{slideEntries.length === 1 ? "" : "s"}
                  </span>
  
                  <span
                    className={`viewer-badge ${syncEnabled ? "viewer-badge--primary" : ""}`}
                    style={{
                      background: syncEnabled ? undefined : chipBg,
                      border: syncEnabled ? undefined : `1px solid ${chipBorder}`,
                      color: syncEnabled ? undefined : titleText,
                    }}
                  >
                    {syncEnabled ? "Sync enabled" : "Sync disabled"}
                  </span>
  
                  <span
                    className="viewer-badge"
                    style={{
                      background: chipBg,
                      border: `1px solid ${chipBorder}`,
                      color: titleText,
                    }}
                  >
                    Source: {sourceId}
                  </span>
  
                  <span
                    className="viewer-badge"
                    style={{
                      background: chipBg,
                      border: `1px solid ${chipBorder}`,
                      color: titleText,
                    }}
                  >
                    Locked leader:{" "}
                    {lockedLeaderId
                      ? slideEntries.find((entry) => entry.id === lockedLeaderId)?.slide?.name ||
                        "Selected"
                      : "None"}
                  </span>
                </div>
  
                {slidePaths.length < 2 ? (
                  <div className="viewer-empty-state">
                    Select at least 2 slides from the manager to open compare view.
                  </div>
                ) : loading && slideEntries.length === 0 ? (
                  <div className="viewer-empty-state">Loading compare viewers...</div>
                ) : (
                  <div
                    className="multi-viewer-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns,
                      gap: 16,
                      alignItems: "stretch",
                    }}
                  >
                    {slideEntries.map((entry) => {
                      const isLeader = leaderRef.current === entry.id;
                      const isLockedLeader = lockedLeaderId === entry.id;
                      const isMultichannel = entry.useVivViewer;
                      const selectedChannelsCount = entry.selectedChannels?.length || 0;
                      const viewerKind = entry.useVivViewer ? "Viv" : "OpenSeadragon";
                      const isDragging = draggingId === entry.id;
                      const isDropTarget = dragOverId === entry.id && draggingId !== entry.id;
  
                      return (
                        <div
                          key={entry.id}
                          draggable
                          onDragStart={() => handleDragStart(entry.id)}
                          onDragOver={(event) => handleDragOver(event, entry.id)}
                          onDrop={(event) => handleDrop(event, entry.id)}
                          onDragEnd={handleDragEnd}
                          className={[
                            "multi-viewer-tile",
                            isDragging ? "multi-viewer-tile--dragging" : "",
                            isDropTarget ? "multi-viewer-tile--drop-target" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            background: cardBg,
                            border: `1px solid ${cardBorder}`,
                            borderRadius: 18,
                            overflow: "hidden",
                            minHeight: 560,
                            display: "flex",
                            flexDirection: "column",
                            boxShadow:
                              (isLeader || isLockedLeader) && syncEnabled
                                ? theme === "dark"
                                  ? "0 0 0 1px rgba(59,130,246,0.65), 0 12px 34px rgba(37,99,235,0.18)"
                                  : "0 0 0 1px rgba(37,99,235,0.5), 0 12px 34px rgba(37,99,235,0.12)"
                                : "none",
                          }}
                        >
                          <div
                            className="multi-viewer-tile__header"
                            style={{
                              padding: "12px 14px",
                              borderBottom: `1px solid ${cardBorder}`,
                              background: cardHeaderBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <button
                                type="button"
                                className="multi-viewer-drag-handle"
                                title="Drag to reorder"
                                aria-label="Drag to reorder"
                              >
                                ⋮⋮
                              </button>
  
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 12,
                                  display: "grid",
                                  placeItems: "center",
                                  background: theme === "dark" ? "#0f172a" : "#eef2ff",
                                  border: `1px solid ${cardBorder}`,
                                  fontSize: 18,
                                  flexShrink: 0,
                                }}
                              >
                                {getSlideIcon(entry.slideInfo?.type)}
                              </div>
  
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: titleText,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "100%",
                                  }}
                                  title={entry.slide.name}
                                >
                                  {entry.slide.name}
                                </div>
  
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: mutedText,
                                    marginTop: 4,
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span>{entry.slideInfo?.type || "unknown"}</span>
                                  <span>•</span>
                                  <span>{viewerKind}</span>
                                  <span>•</span>
                                  <span>{isMultichannel ? "Multichannel" : "WSI"}</span>
                                </div>
                              </div>
                            </div>
  
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                className={`viewer-btn-secondary ${isLockedLeader ? "multi-viewer-lock-btn--active" : ""}`}
                                onClick={() => handleToggleLeaderLock(entry.id)}
                                type="button"
                                title={isLockedLeader ? "Unlock leader" : "Lock as leader"}
                              >
                                {isLockedLeader ? "📌 Leader" : "Pin leader"}
                              </button>
  
                              {syncEnabled ? (
                                <span
                                  className={`viewer-badge ${isLeader ? "viewer-badge--primary" : ""}`}
                                  style={
                                    isLeader
                                      ? undefined
                                      : {
                                          background: chipBg,
                                          border: `1px solid ${chipBorder}`,
                                          color: titleText,
                                        }
                                  }
                                >
                                  {isLockedLeader ? "Locked leader" : isLeader ? "Leader" : "Following"}
                                </span>
                              ) : (
                                <span
                                  className="viewer-badge"
                                  style={{
                                    background: chipBg,
                                    border: `1px solid ${chipBorder}`,
                                    color: titleText,
                                  }}
                                >
                                  Independent
                                </span>
                              )}
  
                              <button
                                className="viewer-btn-secondary"
                                onClick={() =>
                                  navigate(
                                    `/viewer/${encodeURIComponent(entry.slide.path)}?source_id=${encodeURIComponent(
                                      sourceId
                                    )}`
                                  )
                                }
                                type="button"
                              >
                                Open single
                              </button>
                            </div>
                          </div>
  
                          <div
                            style={{
                              position: "relative",
                              flex: 1,
                              minHeight: 470,
                              background: "#020617",
                            }}
                          >
                            {entry.error ? (
                              <div
                                className="viewer-empty-state"
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  zIndex: 2,
                                  color: "#fca5a5",
                                }}
                              >
                                {entry.error}
                              </div>
                            ) : !entry.slideInfo ? (
                              <div
                                className="viewer-empty-state"
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  zIndex: 2,
                                }}
                              >
                                Loading viewer...
                              </div>
                            ) : (
                              <>
                                {entry.useVivViewer ? (
                                  <VivViewer
                                    ref={viewerRefs.current[entry.id]}
                                    slide={entry.slide}
                                    slideInfo={entry.slideInfo}
                                    sourceId={sourceId}
                                    selectedChannels={entry.selectedChannels}
                                    activeTool={TOOL_PAN}
                                    annotations={EMPTY_ARRAY}
                                    aiLayers={EMPTY_ARRAY}
                                    onAddAnnotation={NOOP}
                                    onUpdateAnnotation={NOOP}
                                    onDeleteAnnotation={NOOP}
                                    selectedAnnotationId={null}
                                    onSelectAnnotation={NOOP}
                                    annotationColor={DEFAULT_ANNOTATION_COLOR}
                                    imageAdjustments={DEFAULT_IMAGE_ADJUSTMENTS}
                                    buildPreviewUrl={buildPreviewUrl}
                                    showMiniMap={false}
                                    onInteractionStart={() => claimLeader(entry.id)}
                                    onInteractionEnd={() => releaseLeaderSoon(entry.id)}
                                    onViewportChange={(viewport) =>
                                      handleViewportChange(entry.id, viewport)
                                    }
                                  />
                                ) : (
                                  <OpenSeadragonViewer
                                    ref={viewerRefs.current[entry.id]}
                                    slide={entry.slide}
                                    slideInfo={entry.slideInfo}
                                    sourceId={sourceId}
                                    selectedChannels={EMPTY_ARRAY}
                                    activeTool={TOOL_PAN}
                                    annotations={EMPTY_ARRAY}
                                    aiLayers={EMPTY_ARRAY}
                                    onAddAnnotation={NOOP}
                                    onUpdateAnnotation={NOOP}
                                    onDeleteAnnotation={NOOP}
                                    selectedAnnotationId={null}
                                    onSelectAnnotation={NOOP}
                                    annotationColor={DEFAULT_ANNOTATION_COLOR}
                                    imageAdjustments={DEFAULT_IMAGE_ADJUSTMENTS}
                                    buildPreviewUrl={buildPreviewUrl}
                                    onInteractionStart={() => claimLeader(entry.id)}
                                    onInteractionEnd={() => releaseLeaderSoon(entry.id)}
                                    onViewportChange={(viewport) =>
                                      handleViewportChange(entry.id, viewport)
                                    }
                                  />
                                )}
  
                                {showTileOverlays ? (
                                  <>
                                    <div className="viewer-overlay viewer-overlay--top">
                                      <div className="viewer-overlay__row viewer-overlay__row--compact">
                                        <span className="viewer-badge viewer-badge--sm">
                                          {entry.slideInfo?.type || "unknown"}
                                        </span>
                                        <span className="viewer-badge viewer-badge--sm">
                                          {isMultichannel ? "Multichannel" : "WSI"}
                                        </span>
                                        <span className="viewer-badge viewer-badge--sm">
                                          {viewerKind}
                                        </span>
                                        {syncEnabled ? (
                                          <span
                                            className={`viewer-badge viewer-badge--sm ${
                                              isLeader ? "viewer-badge--primary" : ""
                                            }`}
                                          >
                                            {isLockedLeader
                                              ? "Locked leader"
                                              : isLeader
                                                ? "Sync leader"
                                                : "Sync follower"}
                                          </span>
                                        ) : (
                                          <span className="viewer-badge viewer-badge--sm">
                                            Sync off
                                          </span>
                                        )}
                                      </div>
                                    </div>
  
                                    <div className="viewer-overlay viewer-overlay--bottom">
                                      <div className="viewer-overlay__row viewer-overlay__row--bottom">
                                        <span className="viewer-badge">
                                          {selectedChannelsCount} active channel
                                          {selectedChannelsCount === 1 ? "" : "s"}
                                        </span>
                                        <span className="viewer-badge">
                                          {entry.normalizedChannels?.length || 0} detected
                                        </span>
                                        <span className="viewer-badge">
                                          {entry.slideInfo?.metadata?.sizeX || "?"} ×{" "}
                                          {entry.slideInfo?.metadata?.sizeY || "?"}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                ) : null}
  
                                {showTileZoomControls ? (
                                  <div className="viewer-overlay viewer-overlay--right">
                                    <div className="viewer-fab-stack">
                                      <button
                                        className="viewer-fab-btn"
                                        onClick={() =>
                                          viewerRefs.current[entry.id]?.current?.zoomIn?.()
                                        }
                                        type="button"
                                        title="Zoom in"
                                      >
                                        ＋
                                      </button>
  
                                      <button
                                        className="viewer-fab-btn"
                                        onClick={() =>
                                          viewerRefs.current[entry.id]?.current?.zoomOut?.()
                                        }
                                        type="button"
                                        title="Zoom out"
                                      >
                                        －
                                      </button>
  
                                      <button
                                        className="viewer-fab-btn"
                                        onClick={() =>
                                          viewerRefs.current[entry.id]?.current?.resetView?.()
                                        }
                                        type="button"
                                        title="Reset view"
                                      >
                                        ⌂
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
        <Modal
        open={saveCompareOpen}
        title="Save Compare Session"
        onClose={() => {
          if (!savingSession) {
            setSaveCompareOpen(false);
            setSaveCompareError("");
          }
        }}
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => {
                if (!savingSession) {
                  setSaveCompareOpen(false);
                  setSaveCompareError("");
                }
              }}
              type="button"
            >
              Cancel
            </button>

            <button
              className="primary-btn"
              onClick={handleConfirmSaveCompare}
              type="button"
              disabled={savingSession}
            >
              {savingSession ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">Session name</label>
          <input
            className="form-input"
            value={saveCompareName}
            onChange={(e) => setSaveCompareName(e.target.value)}
            placeholder="Tumor vs Adjacent"
            autoFocus
          />
        </div>

        <div className="multi-viewer-save-preview">
          <div className="multi-viewer-save-preview__label">Slides in this session</div>
          <div className="multi-viewer-save-preview__list">
            {slideEntries.map((entry) => (
              <span key={entry.id} className="multi-viewer-save-preview__chip">
                {entry.slide.name}
              </span>
            ))}
          </div>
        </div>

        {saveCompareError ? (
          <div className="multi-viewer-save-error">{saveCompareError}</div>
        ) : null}
      </Modal>
      </div>
    );
  }
  
  export default MultiViewerPage;