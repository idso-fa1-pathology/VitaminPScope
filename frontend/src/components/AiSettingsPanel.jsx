import { useMemo } from "react";

function guessDefaultNuclearChannel(channels = []) {
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

function guessDefaultMembraneChannels(channels = [], nuclearChannel) {
  return channels
    .filter((ch) => String(ch.index) !== String(nuclearChannel))
    .slice(0, 2)
    .map((ch) => String(ch.index));
}

function formatChannelLabel(channel) {
  return `${channel.name || `Channel ${channel.index + 1}`} (#${channel.index})`;
}

function MultiChannelCheckboxList({
  channels,
  selectedValues,
  onChange,
  disabled = false,
}) {
  const selectedSet = new Set((selectedValues || []).map(String));

  const toggleValue = (value) => {
    const key = String(value);
    let next;

    if (selectedSet.has(key)) {
      next = [...selectedSet].filter((item) => item !== key);
    } else {
      next = [...selectedSet, key];
    }

    onChange(next);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        marginTop: 6,
      }}
    >
      {channels.map((channel) => {
        const key = String(channel.index);
        const checked = selectedSet.has(key);

        return (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggleValue(key)}
            />
            <span>{formatChannelLabel(channel)}</span>
          </label>
        );
      })}
    </div>
  );
}

function AiSettingsPanel({
  isOme,
  channels = [],
  aiMode,
  onAiModeChange,
  nuclearChannel,
  onNuclearChannelChange,
  membraneChannels,
  onMembraneChannelsChange,
  membraneCombination,
  onMembraneCombinationChange,
  onResetDefaults,
}) {
  const defaultNuclear = useMemo(
    () => guessDefaultNuclearChannel(channels),
    [channels]
  );

  const defaultMembrane = useMemo(
    () => guessDefaultMembraneChannels(channels, nuclearChannel || defaultNuclear),
    [channels, nuclearChannel, defaultNuclear]
  );

  const showMifSettings = isOme && aiMode === "mif";

  return (
    <section className="viewer-sidebar__section">
      <div className="viewer-sidebar__section-header">
        <h3 className="viewer-sidebar__section-title">AI settings</h3>
        <p className="viewer-sidebar__section-subtitle">
          Configure modality and channel mapping before ROI inference
        </p>
      </div>

      <div className="viewer-sidebar__section-body">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Modality
            </label>
            <select
              value={aiMode}
              onChange={(e) => onAiModeChange(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="he">H&amp;E</option>
              {isOme ? <option value="mif">MIF</option> : null}
            </select>
          </div>

          {showMifSettings ? (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Nuclear / DAPI channel
                </label>
                <select
                  value={nuclearChannel ?? defaultNuclear}
                  onChange={(e) => onNuclearChannelChange(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {channels.map((channel) => (
                    <option key={channel.index} value={String(channel.index)}>
                      {formatChannelLabel(channel)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Membrane / cell channels
                </label>

                <MultiChannelCheckboxList
                  channels={channels}
                  selectedValues={
                    membraneChannels?.length ? membraneChannels : defaultMembrane
                  }
                  onChange={onMembraneChannelsChange}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Membrane combination
                </label>
                <select
                  value={membraneCombination || "max"}
                  onChange={(e) => onMembraneCombinationChange(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="max">max</option>
                </select>
              </div>
            </>
          ) : null}

          <button
            type="button"
            className="viewer-tool-btn"
            onClick={onResetDefaults}
          >
            Reset AI defaults
          </button>
        </div>
      </div>
    </section>
  );
}

export default AiSettingsPanel;