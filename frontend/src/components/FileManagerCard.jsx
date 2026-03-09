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

function FileManagerCard({ item, onOpen, onRename, onDelete }) {
  const isFolder = item.kind === "folder";

  return (
    <div
      className={`slide-card ${isFolder ? "slide-card--folder" : ""}`}
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
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