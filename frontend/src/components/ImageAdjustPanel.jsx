import { useMemo } from "react";

const DEFAULT_PRESETS = [
  {
    id: "balanced",
    label: "Balanced",
    values: {
      auto: true,
      brightness: 0,
      contrast: 1,
      gamma: 1,
      saturation: 1,
      invert: false,
      grayscale: false,
    },
  },
  {
    id: "brightfield",
    label: "Brightfield",
    values: {
      auto: true,
      brightness: 8,
      contrast: 1.08,
      gamma: 0.95,
      saturation: 1.02,
      invert: false,
      grayscale: false,
    },
  },
  {
    id: "dark-slide",
    label: "Dark slide boost",
    values: {
      auto: false,
      brightness: 22,
      contrast: 1.18,
      gamma: 0.9,
      saturation: 1.04,
      invert: false,
      grayscale: false,
    },
  },
  {
    id: "soft",
    label: "Soft contrast",
    values: {
      auto: false,
      brightness: 4,
      contrast: 0.92,
      gamma: 1.06,
      saturation: 0.98,
      invert: false,
      grayscale: false,
    },
  },
  {
    id: "grayscale",
    label: "Grayscale review",
    values: {
      auto: true,
      brightness: 0,
      contrast: 1,
      gamma: 1,
      saturation: 0,
      invert: false,
      grayscale: true,
    },
  },
];

function formatSliderValue(key, value) {
  if (key === "brightness") return `${Math.round(value)}`;
  return Number(value).toFixed(2);
}

function SliderRow({
  label,
  name,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
}) {
  return (
    <div style={styles.sliderRow}>
      <div style={styles.sliderHeader}>
        <label htmlFor={name} style={styles.sliderLabel}>
          {label}
        </label>
        <span style={styles.sliderValue}>{formatSliderValue(name, value)}</span>
      </div>

      <input
        id={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, Number(e.target.value))}
        style={styles.range}
      />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label style={styles.toggleRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function ImageAdjustPanel({
  isOpen,
  adjustments,
  onChange,
  onClose,
  onReset,
  presets = DEFAULT_PRESETS,
}) {
  const selectedPresetId = useMemo(() => {
    const match = presets.find((preset) => {
      const values = preset.values;
      return (
        values.auto === adjustments.auto &&
        values.brightness === adjustments.brightness &&
        values.contrast === adjustments.contrast &&
        values.gamma === adjustments.gamma &&
        values.saturation === adjustments.saturation &&
        values.invert === adjustments.invert &&
        values.grayscale === adjustments.grayscale
      );
    });

    return match?.id || "";
  }, [adjustments, presets]);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    onChange({
      ...adjustments,
      [field]: value,
    });
  };

  const applyPreset = (presetId) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    onChange({
      ...adjustments,
      ...preset.values,
    });
  };

  return (
    <div style={styles.root} aria-hidden={!isOpen}>
      <div
        style={styles.panel}
        role="dialog"
        aria-modal="false"
        aria-label="Image adjustments"
      >
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Image adjustments</div>
            <div style={styles.subtitle}>
              Tune the viewer without blocking the slide
            </div>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Presets</div>

            <select
              value={selectedPresetId}
              onChange={(e) => applyPreset(e.target.value)}
              style={styles.select}
            >
              <option value="">Custom</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Automatic enhancement</div>

            <ToggleRow
              label="Auto contrast"
              checked={adjustments.auto}
              onChange={(checked) => handleFieldChange("auto", checked)}
            />
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Manual controls</div>

            <SliderRow
              label="Brightness"
              name="brightness"
              min={-80}
              max={80}
              step={1}
              value={adjustments.brightness}
              onChange={handleFieldChange}
            />

            <SliderRow
              label="Contrast"
              name="contrast"
              min={0.4}
              max={2.5}
              step={0.01}
              value={adjustments.contrast}
              onChange={handleFieldChange}
            />

            <SliderRow
              label="Gamma"
              name="gamma"
              min={0.4}
              max={2.5}
              step={0.01}
              value={adjustments.gamma}
              onChange={handleFieldChange}
            />

            <SliderRow
              label="Saturation"
              name="saturation"
              min={0}
              max={2.5}
              step={0.01}
              value={adjustments.saturation}
              onChange={handleFieldChange}
            />
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Display modes</div>

            <ToggleRow
              label="Invert colors"
              checked={adjustments.invert}
              onChange={(checked) => handleFieldChange("invert", checked)}
            />

            <ToggleRow
              label="Grayscale"
              checked={adjustments.grayscale}
              onChange={(checked) => handleFieldChange("grayscale", checked)}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button type="button" onClick={onReset} style={styles.secondaryButton}>
            Reset
          </button>
          <button type="button" onClick={onClose} style={styles.primaryButton}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    position: "fixed",
    top: 88,
    right: 18,
    zIndex: 1200,
    pointerEvents: "none",
  },
  panel: {
    width: "min(380px, 92vw)",
    maxHeight: "calc(100vh - 120px)",
    overflow: "auto",
    background: "rgba(255,255,255,0.96)",
    color: "#1f2937",
    borderRadius: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
    border: "1px solid rgba(148,163,184,0.28)",
    backdropFilter: "blur(10px)",
    pointerEvents: "auto",
  },
  header: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    position: "sticky",
    top: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  closeButton: {
    border: "none",
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 10,
    width: 34,
    height: 34,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  content: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  section: {
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 14,
    padding: 14,
    background: "#f8fafc",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 12,
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  sliderRow: {
    display: "grid",
    gap: 8,
    marginBottom: 12,
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
  },
  sliderValue: {
    fontSize: 13,
    color: "#475569",
    fontVariantNumeric: "tabular-nums",
    minWidth: 40,
    textAlign: "right",
  },
  range: {
    width: "100%",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: 500,
    color: "#1e293b",
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(148,163,184,0.18)",
    position: "sticky",
    bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
};

export const DEFAULT_IMAGE_ADJUSTMENTS = {
  auto: true,
  brightness: 0,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  invert: false,
  grayscale: false,
};

export default ImageAdjustPanel;