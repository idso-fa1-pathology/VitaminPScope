function CompareSessionCard({
  session,
  onOpen,
  onRename,
  onDelete,
}) {
  const slides = Array.isArray(session?.slides) ? session.slides : [];
  const previewNames = slides.slice(0, 3).map((path) => {
    const parts = String(path).split("/");
    return parts[parts.length - 1] || path;
  });

  const hasMore = slides.length > 3;
  const updatedAt = session?.updated_at
    ? new Date(session.updated_at).toLocaleString()
    : "";

  return (
    <div className="compare-session-card">
      <div className="compare-session-card__top">
        <div>
          <div className="compare-session-card__eyebrow">Compare Session</div>
          <div className="compare-session-card__title">{session?.name || "Untitled session"}</div>
        </div>

        <div className="compare-session-card__count">
          {slides.length} slide{slides.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="compare-session-card__meta">
        <span className="compare-session-chip">
          Source: {session?.source_id || "default"}
        </span>
        <span className="compare-session-chip">
          Layout: {session?.layout || "auto"}
        </span>
        <span className="compare-session-chip">
          {session?.sync_enabled ? "Sync on" : "Sync off"}
        </span>
      </div>

      <div className="compare-session-card__slides">
        {previewNames.map((name, index) => (
          <span key={`${name}-${index}`} className="compare-session-card__slide-name">
            {name}
          </span>
        ))}
        {hasMore ? (
          <span className="compare-session-card__slide-more">
            +{slides.length - 3} more
          </span>
        ) : null}
      </div>

      {updatedAt ? (
        <div className="compare-session-card__updated">
          Updated {updatedAt}
        </div>
      ) : null}

      <div className="compare-session-card__actions">
        <button className="primary-btn" onClick={() => onOpen(session)} type="button">
          Open
        </button>

        <button className="secondary-btn" onClick={() => onRename(session)} type="button">
          Rename
        </button>

        <button className="danger-btn" onClick={() => onDelete(session)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}

export default CompareSessionCard;