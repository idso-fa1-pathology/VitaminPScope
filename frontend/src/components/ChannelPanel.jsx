import React from "react";

function ChannelPanel({
  channels,
  selectedChannels,
  channelSettings,
  onToggle,
  onUpdate,
}) {
  if (!channels?.length) return null;

  const selectedSet = new Set((selectedChannels || []).map((c) => c.index));

  return (
    <div className="channel-panel">
      {channels.map((ch) => {
        const selected = selectedSet.has(ch.index);
        const settings = channelSettings?.[ch.index] || {
          color: "#ffffff",
          opacity: 1,
        };

        return (
          <div
            key={ch.index}
            className={`channel-card ${selected ? "channel-card--active" : ""}`}
          >
            <label className="channel-card__header">
              <div className="channel-card__left">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(ch.index)}
                  className="channel-card__checkbox"
                />
                <div className="channel-card__title-group">
                  <span className="channel-card__title">{ch.name}</span>
                  <span className="channel-card__subtitle">
                    Channel {ch.index}
                  </span>
                </div>
              </div>

              <div
                className="channel-card__swatch"
                style={{ backgroundColor: settings.color }}
              />
            </label>

            {selected && (
              <div className="channel-card__controls">
                <div className="channel-control-row">
                  <label className="channel-control-label">Tint color</label>
                  <div className="channel-color-wrap">
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) =>
                        onUpdate(ch.index, { color: e.target.value })
                      }
                      className="channel-color-input"
                    />
                    <span className="channel-color-value">
                      {settings.color.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="channel-control-row">
                  <div className="channel-opacity-header">
                    <label className="channel-control-label">Opacity</label>
                    <span className="channel-opacity-value">
                      {Math.round((settings.opacity ?? 1) * 100)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={settings.opacity ?? 1}
                    onChange={(e) =>
                      onUpdate(ch.index, { opacity: Number(e.target.value) })
                    }
                    className="channel-slider"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ChannelPanel;