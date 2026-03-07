import ActionMenu from "./ActionMenu";

function getCardIcon(item) {
  if (item.kind === "folder") return "📁";
  if (item.type === "ome-tiff") return "🧬";
  if (item.type === "svs") return "🔬";
  return "🖼️";
}

function FileManagerCard({ item, onOpen, onRename, onDelete }) {
  const isFolder = item.kind === "folder";

  return (
    <div
      onClick={() => {
        if (isFolder) return;
        onOpen(item);
      }}
      className="slide-card"
      style={{ position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 5,
        }}
      >
        <ActionMenu
          isFolder={isFolder}
          onOpen={() => onOpen(item)}
          onRename={() => onRename(item)}
          onDelete={() => onDelete(item)}
        />
      </div>

      <div className="slide-card__preview">{getCardIcon(item)}</div>

      <div className="slide-card__name">{item.name}</div>

      <div className="slide-card__meta">
        <span className="slide-type-badge">
          {isFolder ? "folder" : item.type}
        </span>
        <span className="slide-card__action">
          {isFolder ? "Container" : "Open viewer →"}
        </span>
      </div>
    </div>
  );
}

export default FileManagerCard;