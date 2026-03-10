import React, { useMemo, useState } from "react";
import "../styles/viewer/channel-panel.css";

function getChannelDisplayName(channel, position) {
  if (channel?.name && String(channel.name).trim()) return channel.name;
  if (channel?.label && String(channel.label).trim()) return channel.label;
  return `Channel ${channel?.index ?? position + 1}`;
}

function ChannelPanel({
  channels = [],
  selectedChannels = [],
  channelSettings = {},
  onToggle,
  onUpdate,
  onEnableAll,
  onDisableAll,
  onResetAll,
}) {
  const [search, setSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const selectedSet = useMemo(
    () => new Set((selectedChannels || []).map((channel) => channel.index)),
    [selectedChannels]
  );

  const filteredChannels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return channels.filter((channel, position) => {
      const displayName = getChannelDisplayName(channel, position).toLowerCase();
      const indexText = String(channel?.index ?? "");

      const matchesSearch =
        !normalizedSearch ||
        displayName.includes(normalizedSearch) ||
        indexText.includes(normalizedSearch);

      const matchesSelectedFilter =
        !showSelectedOnly || selectedSet.has(channel.index);

      return matchesSearch && matchesSelectedFilter;
    });
  }, [channels, search, showSelectedOnly, selectedSet]);

  if (!channels?.length) return null;

  return (
    <div className="channel-panel">
      <div className="channel-panel__toolbar">
        <div className="channel-panel__meta">
          <span className="channel-panel__count">{selectedSet.size} selected</span>
          <span className="channel-panel__dot">•</span>
          <span className="channel-panel__total">{channels.length} total</span>
        </div>

        <div className="channel-panel__toolbar-actions">
          {onEnableAll ? (
            <button
              type="button"
              className="channel-panel__toolbar-btn"
              onClick={onEnableAll}
            >
              All
            </button>
          ) : null}

          {onDisableAll ? (
            <button
              type="button"
              className="channel-panel__toolbar-btn"
              onClick={onDisableAll}
            >
              None
            </button>
          ) : null}

          {onResetAll ? (
            <button
              type="button"
              className="channel-panel__toolbar-btn"
              onClick={onResetAll}
            >
              Reset tint
            </button>
          ) : null}
        </div>
      </div>

      <div className="channel-panel__filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels"
          className="channel-panel__search"
        />

        <label className="channel-panel__selected-toggle">
          <input
            type="checkbox"
            checked={showSelectedOnly}
            onChange={(e) => setShowSelectedOnly(e.target.checked)}
          />
          <span>Selected only</span>
        </label>
      </div>

      <div className="channel-panel__list">
        {filteredChannels.length ? (
          filteredChannels.map((channel, position) => {
            const selected = selectedSet.has(channel.index);
            const settings = channelSettings?.[channel.index] || {
              color: null,
              opacity: 1,
            };

            const displayName = getChannelDisplayName(channel, position);

            return (
              <div
                key={channel.index ?? position}
                className={`channel-row ${selected ? "channel-row--active" : ""}`}
              >
                <label className="channel-row__main">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(channel.index)}
                    className="channel-row__checkbox"
                  />

                  <div
                    className="channel-row__swatch"
                    style={{ backgroundColor: settings.color || "#64748b" }}
                    title={settings.color || "No tint"}
                  />

                  <div className="channel-row__text">
                    <div className="channel-row__name">{displayName}</div>
                    <div className="channel-row__meta">
                      Ch {channel.index}
                      {channel.id !== undefined && channel.id !== null
                        ? ` • ID ${channel.id}`
                        : ""}
                    </div>
                  </div>
                </label>

                <div className="channel-row__actions">
                  {selected ? (
                    <>
                      <input
                        type="color"
                        value={settings.color || "#ffffff"}
                        onChange={(e) =>
                          onUpdate(channel.index, { color: e.target.value })
                        }
                        className="channel-row__color"
                        title="Tint color"
                      />

                      <button
                        type="button"
                        className="channel-row__clear"
                        onClick={() => onUpdate(channel.index, { color: null })}
                        title="Clear tint"
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <span className="channel-row__status">Off</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="channel-panel__empty">
            No channels match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelPanel;