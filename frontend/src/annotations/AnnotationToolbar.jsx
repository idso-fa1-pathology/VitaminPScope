import {
  DEFAULT_ANNOTATION_COLOR,
  TOOL_AI,
  TOOL_LINE,
  TOOL_MEASURE,
  TOOL_PAN,
  TOOL_POINT,
  TOOL_RECT,
  TOOL_SELECT,
} from "./annotationTypes";

function ToolButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`viewer-stage-btn ${active ? "active" : ""}`}
    >
      {children}
    </button>
  );
}

function AnnotationToolbar({
  activeTool,
  onToolChange,
  onClear,
  color,
  onColorChange,
  selectedAnnotation,
  onDeleteSelected,
}) {
  return (
    <>
      <ToolButton
        active={activeTool === TOOL_PAN}
        onClick={() => onToolChange(TOOL_PAN)}
        title="Pan"
      >
        ✋ Pan
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_SELECT}
        onClick={() => onToolChange(TOOL_SELECT)}
        title="Select and edit"
      >
        ↖ Select
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_POINT}
        onClick={() => onToolChange(TOOL_POINT)}
        title="Point"
      >
        • Dot
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_LINE}
        onClick={() => onToolChange(TOOL_LINE)}
        title="Line"
      >
        ／ Line
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_RECT}
        onClick={() => onToolChange(TOOL_RECT)}
        title="Rectangle"
      >
        ▭ Box
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_MEASURE}
        onClick={() => onToolChange(TOOL_MEASURE)}
        title="Measure"
      >
        📏 Measure
      </ToolButton>

      <ToolButton
        active={activeTool === TOOL_AI}
        onClick={() => onToolChange(TOOL_AI)}
        title="AI"
      >
        🤖 AI
      </ToolButton>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
          fontSize: 13,
        }}
        title="Annotation color"
      >
        <span>Color</span>
        <input
          type="color"
          value={color || DEFAULT_ANNOTATION_COLOR}
          onChange={(e) => onColorChange?.(e.target.value)}
          style={{
            width: 26,
            height: 26,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        />
      </label>

      <button
        type="button"
        className="viewer-stage-btn"
        onClick={onDeleteSelected}
        disabled={!selectedAnnotation}
        title="Delete selected annotation"
      >
        ⌫ Delete
      </button>

      <button
        type="button"
        className="viewer-stage-btn"
        onClick={onClear}
        title="Clear annotations"
      >
        🗑 Clear
      </button>
    </>
  );
}

export default AnnotationToolbar;