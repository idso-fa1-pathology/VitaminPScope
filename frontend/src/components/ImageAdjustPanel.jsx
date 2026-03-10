import { useMemo } from "react";
import "../styles/viewer/image-adjust-panel.css";

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
    <div className="image-adjust-panel__slider-row">
      <div className="image-adjust-panel__slider-header">
        <label htmlFor={name} className="image-adjust-panel__slider-label">
          {label}
        </label>
        <span className="image-adjust-panel__slider-value">
          {formatSliderValue(name, value)}
        </span>
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
        className="image-adjust-panel__range"
      />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="image-adjust-panel__toggle-row">
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
    <div className="image-adjust-panel" aria-hidden={!isOpen}>
      <div
        className="image-adjust-panel__card"
        role="dialog"
        aria-modal="false"
        aria-label="Image adjustments"
      >
        <div className="image-adjust-panel__header">
          <div>
            <div className="image-adjust-panel__title">Image adjustments</div>
            <div className="image-adjust-panel__subtitle">
              Tune the viewer without blocking the slide
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="image-adjust-panel__close"
          >
            ✕
          </button>
        </div>

        <div className="image-adjust-panel__content">
          <div className="image-adjust-panel__section">
            <div className="image-adjust-panel__section-title">Presets</div>

            <select
              value={selectedPresetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="image-adjust-panel__select"
            >
              <option value="">Custom</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="image-adjust-panel__section">
            <div className="image-adjust-panel__section-title">
              Automatic enhancement
            </div>

            <ToggleRow
              label="Auto contrast"
              checked={adjustments.auto}
              onChange={(checked) => handleFieldChange("auto", checked)}
            />
          </div>

          <div className="image-adjust-panel__section">
            <div className="image-adjust-panel__section-title">
              Manual controls
            </div>

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

          <div className="image-adjust-panel__section">
            <div className="image-adjust-panel__section-title">Display modes</div>

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

        <div className="image-adjust-panel__footer">
          <button
            type="button"
            onClick={onReset}
            className="image-adjust-panel__button image-adjust-panel__button--secondary"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="image-adjust-panel__button image-adjust-panel__button--primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

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