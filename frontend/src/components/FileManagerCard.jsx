import ActionMenu from "./ActionMenu";

function normalizeType(type) {
  if (!type) return "unknown";
  return String(type).trim().toLowerCase();
}

function getCardIcon(item) {
  if (item.kind === "folder") return "📁";

  const type = normalizeType(item.type);

  const iconMap = {
    "ome-tiff": "🧬",
    "ome.tiff": "🧬",
    svs: "🔬",
    ndpi: "🩺",
    czi: "🧪",
    mrxs: "🧫",
    scn: "🖼️",
    vms: "🗃️",
    vmu: "🗃️",
    tif: "🖼️",
    tiff: "🖼️",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    dcm: "🏥",
    dicom: "🏥",
  };

  return iconMap[type] || "🖼️";
}

function getItemLabel(item) {
  if (item.kind === "folder") return "Folder";

  const type = normalizeType(item.type);

  const labelMap = {
    "ome-tiff": "OME-TIFF",
    "ome.tiff": "OME-TIFF",
    svs: "SVS",
    ndpi: "NDPI",
    czi: "CZI",
    mrxs: "MRXS",
    scn: "SCN",
    vms: "VMS",
    vmu: "VMU",
    tif: "TIF",
    tiff: "TIFF",
    png: "PNG",
    jpg: "JPG",
    jpeg: "JPEG",
    dcm: "DICOM",
    dicom: "DICOM",
    unknown: "Unknown",
  };

  return labelMap[type] || String(item.type || "File").toUpperCase();
}

function getItemDescription(item) {
  if (item.kind === "folder") return "Organize related slide assets";

  const type = normalizeType(item.type);

  const descriptionMap = {
    "ome-tiff": "Multichannel OME-TIFF pathology image",
    "ome.tiff": "Multichannel OME-TIFF pathology image",
    svs: "Whole-slide SVS pathology image",
    ndpi: "Hamamatsu NDPI whole-slide image",
    czi: "Zeiss CZI microscopy image",
    mrxs: "3DHISTECH MRXS whole-slide image",
    scn: "Leica SCN pathology image",
    vms: "Virtual slide image file",
    vmu: "Virtual slide metadata file",
    tif: "TIFF image file",
    tiff: "TIFF image file",
    png: "PNG image file",
    jpg: "JPEG image file",
    jpeg: "JPEG image file",
    dcm: "DICOM medical image",
    dicom: "DICOM medical image",
    unknown: "Image file",
  };

  return descriptionMap[type] || `${getItemLabel(item)} image file`;
}

function FileManagerCard({
  item,
  onOpen,
  onRename,
  onDelete,
  selectionMode = false,
  isSelected = false,
}) {
  const isFolder = item.kind === "folder";
  const canSelect = selectionMode && !isFolder;
  return (
      <div
        className={[
          "slide-card",
          isFolder ? "slide-card--folder" : "",
          canSelect && isSelected ? "slide-card--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onOpen(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        style={
          canSelect && isSelected
            ? {
                outline: "3px solid #2563eb",
                outlineOffset: "2px",
                boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.15)",
              }
            : undefined
        }
      >
      <div className="slide-card__menu" onClick={(e) => e.stopPropagation()}>
        {!selectionMode ? (
          <ActionMenu
            isFolder={isFolder}
            onOpen={() => onOpen(item)}
            onRename={() => onRename(item)}
            onDelete={() => onDelete(item)}
          />
        ) : null}
      </div>

      <div
          className="slide-card__preview"
          style={{ position: "relative" }}
        >
          {getCardIcon(item)}

          {canSelect ? (
            <span
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 24,
                height: 24,
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                background: isSelected ? "#2563eb" : "#e2e8f0",
                color: isSelected ? "#fff" : "#334155",
                border: "2px solid #fff",
              }}
            >
              {isSelected ? "✓" : ""}
            </span>
          ) : null}
        </div>

      <div className="slide-card__body">
        <div className="slide-card__name" title={item.name}>
          {item.name}
        </div>

        <div className="slide-card__description">
          {getItemDescription(item)}
        </div>

        <div className="slide-card__meta">
          <span className="slide-type-badge">{getItemLabel(item)}</span>
          <span className="slide-card__action">
            {isFolder ? "Open folder" : "Open viewer"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default FileManagerCard;