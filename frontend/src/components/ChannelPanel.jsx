const DEFAULT_COLORS = ["#00ff00", "#ff9900", "#ff0000", "#ff00ff", "#00ffff", "#ffffff"];

function ChannelPanel({ channels, selectedChannels, onChange }) {
  if (!channels?.length) return null;

  const toggleChannel = (index) => {
    const exists = selectedChannels.find((c) => c.index === index);

    if (exists) {
      onChange(selectedChannels.filter((c) => c.index !== index));
      return;
    }

    const defaultColor = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    onChange([
      ...selectedChannels,
      { index, color: defaultColor, opacity: 0.7 },
    ]);
  };

  const updateChannel = (index, patch) => {
    onChange(
      selectedChannels.map((c) =>
        c.index === index ? { ...c, ...patch } : c
      )
    );
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Channels</h3>

      {channels.map((ch) => {
        const selected = selectedChannels.find((c) => c.index === ch.index);

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
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={!!selected}
                onChange={() => toggleChannel(ch.index)}
              />
              <span>{ch.name}</span>
            </label>

            {selected && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <label style={{ display: "block", fontSize: "12px" }}>Color</label>
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) =>
                      updateChannel(ch.index, { color: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px" }}>
                    Opacity: {selected.opacity.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selected.opacity}
                    onChange={(e) =>
                      updateChannel(ch.index, { opacity: Number(e.target.value) })
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