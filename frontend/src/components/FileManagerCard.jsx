import ActionMenu from "./ActionMenu";

function getCardIcon(item) {
  if (item.kind === "folder") return "📁";
  if (item.type === "ome-tiff") return "🧬";
  if (item.type === "svs") return "🔬";
  return "🖼️";
}

function getItemLabel(item) {
  if (item.kind === "folder") return "Folder";
  if (item.type === "ome-tiff") return "OME-TIFF";
  if (item.type === "svs") return "SVS";
  return item.type || "File";
}

function FileManagerCard({ item, onOpen, onRename, onDelete }) {
  const isFolder = item.kind === "folder";

  const handleCardClick = () => {
    if (!isFolder) onOpen(item);
  };

  return (
    <div
      className={`slide-card ${isFolder ? "slide-card--folder" : ""}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !isFolder) {
          onOpen(item);
        }
      }}
    >
      <div className="slide-card__menu" onClick={(e) => e.stopPropagation()}>
        <ActionMenu
          isFolder={isFolder}
          onOpen={() => onOpen(item)}
          onRename={() => onRename(item)}
          onDelete={() => onDelete(item)}
        />
      </div>

      <div className="slide-card__preview">{getCardIcon(item)}</div>

      <div className="slide-card__body">
        <div className="slide-card__name" title={item.name}>
          {item.name}
        </div>

        <div className="slide-card__meta">
          <span className="slide-type-badge">{getItemLabel(item)}</span>
          <span className="slide-card__action">
            {isFolder ? "Manage" : "Open"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default FileManagerCard;