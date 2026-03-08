import { useEffect, useRef, useState } from "react";
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

function ToolButton({ active, onClick, title, icon, label, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`annotation-toolbar__tool ${active ? "active" : ""}`}
    >
      <span className="annotation-toolbar__icon">{icon}</span>
      <span className="annotation-toolbar__label">{label}</span>
    </button>
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  const toolbarRef = useRef(null);
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState({ x: 14, y: 78 });

  useEffect(() => {
    const handlePointerMove = (event) => {
      const state = dragStateRef.current;
      const toolbarEl = toolbarRef.current;
      if (!state || !toolbarEl) return;

      const frame = toolbarEl.closest(".viewer-canvas-frame");
      if (!frame) return;

      const frameRect = frame.getBoundingClientRect();
      const toolbarRect = toolbarEl.getBoundingClientRect();

      const nextX = clamp(
        event.clientX - frameRect.left - state.offsetX,
        8,
        Math.max(8, frameRect.width - toolbarRect.width - 8)
      );

      const nextY = clamp(
        event.clientY - frameRect.top - state.offsetY,
        8,
        Math.max(8, frameRect.height - toolbarRect.height - 8)
      );

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
    };
  }, []);

  const handleDragStart = (event) => {
    const toolbarEl = toolbarRef.current;
    if (!toolbarEl) return;

    const rect = toolbarEl.getBoundingClientRect();

    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={toolbarRef}
      className="annotation-toolbar"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className="annotation-toolbar__drag"
        onPointerDown={handleDragStart}
        title="Drag toolbar"
      >
        ···
      </div>

      <div className="annotation-toolbar__section">
        <ToolButton
          active={activeTool === TOOL_PAN}
          onClick={() => onToolChange(TOOL_PAN)}
          title="Pan"
          icon="✋"
          label="Pan"
        />

        <ToolButton
          active={activeTool === TOOL_SELECT}
          onClick={() => onToolChange(TOOL_SELECT)}
          title="Select and edit"
          icon="↖"
          label="Sel"
        />

        <ToolButton
          active={activeTool === TOOL_POINT}
          onClick={() => onToolChange(TOOL_POINT)}
          title="Point"
          icon="•"
          label="Dot"
        />

        <ToolButton
          active={activeTool === TOOL_LINE}
          onClick={() => onToolChange(TOOL_LINE)}
          title="Line"
          icon="／"
          label="Line"
        />

        <ToolButton
          active={activeTool === TOOL_RECT}
          onClick={() => onToolChange(TOOL_RECT)}
          title="Rectangle"
          icon="▭"
          label="Box"
        />

        <ToolButton
          active={activeTool === TOOL_MEASURE}
          onClick={() => onToolChange(TOOL_MEASURE)}
          title="Measure"
          icon="📏"
          label="Mea"
        />
      </div>

      <div className="annotation-toolbar__divider" />

      <label className="annotation-toolbar__color" title="Annotation color">
        <span className="annotation-toolbar__color-label">Color</span>
        <input
          className="annotation-toolbar__color-input"
          type="color"
          value={color || DEFAULT_ANNOTATION_COLOR}
          onChange={(e) => onColorChange?.(e.target.value)}
        />
      </label>

      <ToolButton
        active={false}
        onClick={onDeleteSelected}
        title="Delete selected annotation"
        icon="⌫"
        label="Del"
        disabled={!selectedAnnotation}
      />

      <ToolButton
        active={false}
        onClick={onClear}
        title="Clear annotations"
        icon="🗑"
        label="Clr"
      />
    </div>
  );
}

export default AnnotationToolbar;