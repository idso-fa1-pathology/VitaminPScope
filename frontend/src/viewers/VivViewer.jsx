import { useMemo } from "react";

function VivViewer({ slide, slideInfo, selectedChannels }) {
  if (!slide || !slideInfo) {
    return (
      <div
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          background: "#111",
        }}
      />
    );
  }

  const metadata = slideInfo.metadata;
  const imageWidth = metadata.sizeX;
  const imageHeight = metadata.sizeY;

  const channelsToShow =
    selectedChannels && selectedChannels.length
      ? selectedChannels
      : [{ index: 0, color: "#ffffff", opacity: 1 }];

  const channelImages = useMemo(() => {
    return channelsToShow.map((channel) => {
      const params = new URLSearchParams({
        frame: String(channel.index),
        max_size: "1400",
      });

      if (channel.color) {
        params.set("color", channel.color.replace("#", ""));
      }

      return {
        ...channel,
        url: `http://localhost:8000/slide/${encodeURIComponent(
          slide.name
        )}/thumbnail?${params.toString()}`,
      };
    });
  }, [channelsToShow, slide.name]);

  const aspectRatio =
    imageWidth && imageHeight ? imageWidth / imageHeight : 1;

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        background: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, calc(100vh * " + aspectRatio + "))",
          height: "min(100%, calc(100vw / " + aspectRatio + "))",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          background: "#000",
        }}
      >
        {channelImages.map((channel) => (
          <img
            key={`${channel.index}-${channel.color}-${channel.opacity}`}
            src={channel.url}
            alt={`Channel ${channel.index}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: channel.opacity ?? 0.7,
              mixBlendMode: "screen",
              imageRendering: "auto",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default VivViewer;