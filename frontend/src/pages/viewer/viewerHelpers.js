export const DEFAULT_CHANNEL_PALETTE = [
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
  
  export function getSlideIcon(type) {
    if (type === "ome-tiff") return "🧬";
    if (type === "svs") return "🔬";
    if (type === "ndpi") return "🩺";
    return "🖼️";
  }
  
  export function formatValue(value, fallback = "-") {
    return value === undefined || value === null || value === "" ? fallback : String(value);
  }
  
  export function formatNumber(value, decimals = 0) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
  
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  
  export function formatPixels(value) {
    if (value === undefined || value === null) return "-";
    return `${formatNumber(value)} px`;
  }
  export function isOmeTiffSlide(slideInfo) {
    return String(slideInfo?.type || "").toLowerCase() === "ome-tiff";
  }
  export function formatMicronsPerPixelFromMm(mmValue) {
    if (mmValue === undefined || mmValue === null || Number.isNaN(Number(mmValue))) return "-";
    const micronsPerPixel = Number(mmValue) * 1000;
    return `${formatNumber(micronsPerPixel, 3)} µm/px`;
  }
  
  export function formatMagnification(value) {
    if (value === undefined || value === null || value === "") return "-";
    const normalized = String(value).replace(/x$/i, "");
    return `${normalized}×`;
  }
  
  export function formatDataType(value) {
    if (!value) return "-";
    return String(value).toUpperCase();
  }
  
  export function getChannelColor(index) {
    if (DEFAULT_CHANNEL_PALETTE[index]) return DEFAULT_CHANNEL_PALETTE[index];
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 85%, 60%)`;
  }
  
  export function getBandCount(slideInfo) {
    const metadataBandCount = Number(slideInfo?.metadata?.bandCount);
    const rootBandCount = Number(slideInfo?.bandCount);
  
    if (Number.isFinite(metadataBandCount) && metadataBandCount > 0) return metadataBandCount;
    if (Number.isFinite(rootBandCount) && rootBandCount > 0) return rootBandCount;
  
    return 0;
  }
  
  export function isMultichannelSlide(slideInfo) {
    const slideType = String(slideInfo?.type || "").toLowerCase();
  
    if (slideType !== "ome-tiff") {
      return false;
    }
  
    const bandCount = getBandCount(slideInfo);
    if (bandCount > 3) return true;
  
    const channels = Array.isArray(slideInfo?.channels) ? slideInfo.channels : [];
    if (channels.length > 3) return true;
  
    return false;
  }
  
  export function normalizeChannels(slideInfo) {
    if (Array.isArray(slideInfo?.channels) && slideInfo.channels.length) {
      return slideInfo.channels.map((channel, position) => {
        const resolvedIndex =
          channel?.index !== undefined && channel?.index !== null
            ? Number(channel.index)
            : position;
  
        return {
          ...channel,
          index: Number.isFinite(resolvedIndex) ? resolvedIndex : position,
          name:
            channel?.name ||
            channel?.label ||
            `Channel ${Number.isFinite(resolvedIndex) ? resolvedIndex + 1 : position + 1}`,
        };
      });
    }
  
    const bandCount = getBandCount(slideInfo);
  
    if (bandCount > 0) {
      return Array.from({ length: bandCount }, (_, index) => ({
        index,
        name: `Channel ${index + 1}`,
      }));
    }
  
    return [];
  }
  
  export function buildDefaultChannelSettings(channels = []) {
    const nextSettings = {};
  
    channels.forEach((channel) => {
      nextSettings[channel.index] = {
        color: null,
        opacity: 1,
      };
    });
  
    return nextSettings;
  }
  
  export function buildMetadataRows(metadata) {
    return [
      { label: "Image width", value: formatPixels(metadata.sizeX) },
      { label: "Image height", value: formatPixels(metadata.sizeY) },
      { label: "Resolution X", value: formatMicronsPerPixelFromMm(metadata.mm_x) },
      { label: "Resolution Y", value: formatMicronsPerPixelFromMm(metadata.mm_y) },
      { label: "Pyramid levels", value: formatValue(metadata.levels) },
      { label: "Tile width", value: formatPixels(metadata.tileWidth) },
      { label: "Tile height", value: formatPixels(metadata.tileHeight) },
      { label: "Magnification", value: formatMagnification(metadata.magnification) },
      { label: "Data type", value: formatDataType(metadata.dtype) },
      { label: "Band count", value: formatValue(metadata.bandCount) },
    ].filter((row) => row.value !== "-");
  }
  
  export function guessAiMode(slideInfo) {
    return isMultichannelSlide(slideInfo) ? "mif" : "he";
  }
  
  export function guessNuclearChannel(channels = []) {
    if (!channels.length) return "";
  
    const preferredNames = ["dapi", "nucleus", "nuclei", "dna", "hoechst"];
    const match = channels.find((ch) =>
      preferredNames.some((term) => String(ch.name || "").toLowerCase().includes(term))
    );
  
    if (match) return String(match.index);
  
    const fallback = channels.find((ch) => Number(ch.index) === 2);
    if (fallback) return String(fallback.index);
  
    return String(channels[channels.length - 1].index);
  }
  
  export function guessMembraneChannels(channels = [], nuclearChannel) {
    return channels
      .filter((ch) => String(ch.index) !== String(nuclearChannel))
      .slice(0, 2)
      .map((ch) => String(ch.index));
  }
  
  export function getAiBadgeTone(aiError, selectedRoiAnnotation, isRunningAi) {
    if (aiError) return "danger";
    if (isRunningAi) return "primary";
    if (!selectedRoiAnnotation) return "warning";
    return "success";
  }