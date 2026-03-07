import React, { useMemo, useState } from "react";

function getChannelDisplayName(channel, position) {
  if (channel?.name && String(channel.name).trim()) return channel.name;
  if (channel?.label && String(channel.label).trim()) return channel.label;
  return `Channel ${channel?.index ?? position + 1}`;
}

function formatOpacity(opacity) {
  return `${Math.round((opacity ?? 1) * 100)}%`;
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
      <div className="channel-panel__topbar">
        <div className="channel-panel__summary">
          <span className="channel-panel__summary-main">
            {selectedSet.size} selected
          </span>
          <span className="channel-panel__summary-sep">•</span>
          <span className="channel-panel__summary-sub">
            {channels.length} total channels
          </span>
        </div>

        <div className="channel-panel__actions">
          {onEnableAll ? (
            <button
              type="button"
              className="channel-panel__action-btn"
              onClick={onEnableAll}
            >
              Enable all
            </button>
          ) : null}

          {onDisableAll ? (
            <button
              type="button"
              className="channel-panel__action-btn"
              onClick={onDisableAll}
            >
              Disable all
            </button>
          ) : null}

          {onResetAll ? (
            <button
              type="button"
              className="channel-panel__action-btn"
              onClick={onResetAll}
            >
              Reset styles
            </button>
          ) : null}
        </div>
      </div>

      <div className="channel-panel__filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels by name or index"
          className="channel-panel__search"
        />

        <label className="channel-panel__toggle">
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
              color: "#ffffff",
              opacity: 1,
            };

            return (
              <div
                key={channel.index ?? position}
                className={`channel-card ${selected ? "channel-card--active" : ""}`}
              >
                <label className="channel-card__header">
                  <div className="channel-card__left">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggle(channel.index)}
                      className="channel-card__checkbox"
                    />

                    <div className="channel-card__title-group">
                      <span className="channel-card__title">
                        {getChannelDisplayName(channel, position)}
                      </span>

                      <span className="channel-card__subtitle">
                        Index {channel.index}
                        {channel.id !== undefined && channel.id !== null
                          ? ` • ID ${channel.id}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div
                    className="channel-card__swatch"
                    style={{ backgroundColor: settings.color }}
                    title={settings.color}
                  />
                </label>

                {selected ? (
                  <div className="channel-card__controls">
                    <div className="channel-control-row">
                      <label className="channel-control-label">Tint color</label>

                      <div className="channel-color-wrap">
                        <input
                          type="color"
                          value={settings.color}
                          onChange={(e) =>
                            onUpdate(channel.index, { color: e.target.value })
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
                          {formatOpacity(settings.opacity)}
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.opacity ?? 1}
                        onChange={(e) =>
                          onUpdate(channel.index, {
                            opacity: Number(e.target.value),
                          })
                        }
                        className="channel-slider"
                      />
                    </div>
                  </div>
                ) : null}
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