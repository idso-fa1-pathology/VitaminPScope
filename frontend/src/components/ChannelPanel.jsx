import React from "react";

function ChannelPanel({ channels, selectedChannels, channelSettings, onToggle, onUpdate }) {
  if (!channels?.length) return null;

  const selectedSet = new Set((selectedChannels || []).map((c) => c.index));

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Channels</h3>

      {channels.map((ch) => {
        const selected = selectedSet.has(ch.index);
        const settings = channelSettings?.[ch.index] || {
          color: "#ffffff",
          opacity: 1,
        };

        return (
          <div
            key={ch.index}
            style={{
              border: "1px solid #ddd",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "8px",
              background: "#fff",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(ch.index)}
              />
              <span>{ch.name}</span>
            </label>

            {selected && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <label style={{ display: "block", fontSize: "12px" }}>Color</label>
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) =>
                      onUpdate(ch.index, { color: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px" }}>
                    Opacity: {(settings.opacity ?? 1).toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={settings.opacity ?? 1}
                    onChange={(e) =>
                      onUpdate(ch.index, { opacity: Number(e.target.value) })
                    }
                    style={{ width: "100%" }}
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