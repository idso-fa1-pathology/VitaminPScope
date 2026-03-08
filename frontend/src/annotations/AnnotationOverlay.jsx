import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_MEASURE_COLOR,
  TOOL_LINE,
  TOOL_MEASURE,
  TOOL_POINT,
  TOOL_RECT,
  TOOL_SELECT,
} from "./annotationTypes";

function createAnnotationId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function distance(a, b) {
  const dx = clampNumber(b.x) - clampNumber(a.x);
  const dy = clampNumber(b.y) - clampNumber(a.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function rectFromPoints(a, b) {
  const x1 = clampNumber(a.x);
  const y1 = clampNumber(a.y);
  const x2 = clampNumber(b.x);
  const y2 = clampNumber(b.y);

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function formatLengthFromPixels(pixelLength, metersPerPixel) {
  if (!metersPerPixel || !Number.isFinite(pixelLength)) {
    return `${pixelLength.toFixed(1)} px`;
  }

  const meters = pixelLength * metersPerPixel;

  if (meters >= 0.001) {
    const mm = meters * 1000;
    return `${mm >= 10 ? mm.toFixed(0) : mm.toFixed(1)} mm`;
  }

  if (meters >= 0.000001) {
    const um = meters * 1_000_000;
    return `${um >= 10 ? um.toFixed(0) : um.toFixed(1)} µm`;
  }

  const nm = meters * 1_000_000_000;
  return `${nm.toFixed(0)} nm`;
}

function getRectLabel(annotation, metersPerPixel) {
  const widthLabel = formatLengthFromPixels(annotation.width, metersPerPixel);
  const heightLabel = formatLengthFromPixels(annotation.height, metersPerPixel);
  return `${widthLabel} × ${heightLabel}`;
}

function getRelativePoint(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function annotationToSvg(annotation, imageToScreen) {
  if (!annotation) return null;

  if (annotation.tool === TOOL_POINT) {
    const p = imageToScreen({ x: annotation.x, y: annotation.y });
    return { kind: "point", cx: p.x, cy: p.y, r: 5 };
  }

  if (annotation.tool === TOOL_LINE || annotation.tool === TOOL_MEASURE) {
    const a = imageToScreen(annotation.start);
    const b = imageToScreen(annotation.end);
    return { kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  if (annotation.tool === TOOL_RECT) {
    const tl = imageToScreen({ x: annotation.x, y: annotation.y });
    const br = imageToScreen({
      x: annotation.x + annotation.width,
      y: annotation.y + annotation.height,
    });

    return {
      kind: "rect",
      x: Math.min(tl.x, br.x),
      y: Math.min(tl.y, br.y),
      width: Math.abs(br.x - tl.x),
      height: Math.abs(br.y - tl.y),
    };
  }

  return null;
}

function getRectHandles(annotation) {
  const x1 = annotation.x;
  const y1 = annotation.y;
  const x2 = annotation.x + annotation.width;
  const y2 = annotation.y + annotation.height;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  return {
    nw: { x: x1, y: y1 },
    n: { x: cx, y: y1 },
    ne: { x: x2, y: y1 },
    e: { x: x2, y: cy },
    se: { x: x2, y: y2 },
    s: { x: cx, y: y2 },
    sw: { x: x1, y: y2 },
    w: { x: x1, y: cy },
  };
}

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) return distance(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const proj = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };

  return distance(p, proj);
}

function pointToSegmentDistanceScreen(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
  
    if (dx === 0 && dy === 0) return distance(p, a);
  
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    const proj = {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };
  
    return distance(p, proj);
  }
  
  function hitTestAnnotation(annotation, screenPoint, imageToScreen) {
    const bodyTolerance = 10;
    const handleTolerance = 18;
  
    if (annotation.tool === TOOL_POINT) {
      const p = imageToScreen({ x: annotation.x, y: annotation.y });
      const d = distance(screenPoint, p);
  
      if (d <= handleTolerance) {
        return {
          hit: true,
          type: "body",
        };
      }
    }
  
    if (annotation.tool === TOOL_LINE || annotation.tool === TOOL_MEASURE) {
      const start = imageToScreen(annotation.start);
      const end = imageToScreen(annotation.end);
  
      if (distance(screenPoint, start) <= handleTolerance) {
        return { hit: true, type: "handle-start" };
      }
  
      if (distance(screenPoint, end) <= handleTolerance) {
        return { hit: true, type: "handle-end" };
      }
  
      if (pointToSegmentDistanceScreen(screenPoint, start, end) <= bodyTolerance) {
        return { hit: true, type: "body" };
      }
    }
  
    if (annotation.tool === TOOL_RECT) {
      const handles = getRectHandles(annotation);
  
      for (const [key, value] of Object.entries(handles)) {
        const handleScreen = imageToScreen(value);
        if (distance(screenPoint, handleScreen) <= handleTolerance) {
          return { hit: true, type: "handle-rect", handle: key };
        }
      }
  
      const topLeft = imageToScreen({ x: annotation.x, y: annotation.y });
      const bottomRight = imageToScreen({
        x: annotation.x + annotation.width,
        y: annotation.y + annotation.height,
      });
  
      const minX = Math.min(topLeft.x, bottomRight.x);
      const maxX = Math.max(topLeft.x, bottomRight.x);
      const minY = Math.min(topLeft.y, bottomRight.y);
      const maxY = Math.max(topLeft.y, bottomRight.y);
  
      const inside =
        screenPoint.x >= minX &&
        screenPoint.x <= maxX &&
        screenPoint.y >= minY &&
        screenPoint.y <= maxY;
  
      if (inside) {
        return { hit: true, type: "body" };
      }
    }
  
    return { hit: false };
  }

function normalizeRect(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function updateRectFromHandle(annotation, handle, toPoint) {
  const left = annotation.x;
  const top = annotation.y;
  const right = annotation.x + annotation.width;
  const bottom = annotation.y + annotation.height;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (handle.includes("w")) nextLeft = toPoint.x;
  if (handle.includes("e")) nextRight = toPoint.x;
  if (handle.includes("n")) nextTop = toPoint.y;
  if (handle.includes("s")) nextBottom = toPoint.y;

  if (handle === "n") nextTop = toPoint.y;
  if (handle === "s") nextBottom = toPoint.y;
  if (handle === "e") nextRight = toPoint.x;
  if (handle === "w") nextLeft = toPoint.x;

  return normalizeRect(nextLeft, nextTop, nextRight, nextBottom);
}

function Handle({ x, y, active = false }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={active ? 5 : 4}
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="1.5"
    />
  );
}

function AnnotationShape({
  annotation,
  imageToScreen,
  metersPerPixel,
  selected = false,
}) {
  const svgShape = annotationToSvg(annotation, imageToScreen);
  if (!svgShape) return null;

  const stroke = annotation.color || DEFAULT_ANNOTATION_COLOR;
  const strokeWidth = selected ? (annotation.strokeWidth || 2) + 1 : annotation.strokeWidth || 2;

  if (svgShape.kind === "point") {
    return (
      <>
        <circle
          cx={svgShape.cx}
          cy={svgShape.cy}
          r={selected ? 6 : svgShape.r}
          fill={stroke}
          stroke="#fff"
          strokeWidth="1.5"
        />
        {selected && <Handle x={svgShape.cx} y={svgShape.cy} active />}
      </>
    );
  }

  if (svgShape.kind === "line") {
    const midX = (svgShape.x1 + svgShape.x2) / 2;
    const midY = (svgShape.y1 + svgShape.y2) / 2;
    const pixelLength = distance(annotation.start, annotation.end);

    return (
      <>
        <line
          x1={svgShape.x1}
          y1={svgShape.y1}
          x2={svgShape.x2}
          y2={svgShape.y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        {(annotation.tool === TOOL_MEASURE || selected) && (
          <text
          x={midX + 8}
          y={midY - 8}
          fill="#fff"
          fontSize="12"
          fontWeight="600"
          paintOrder="stroke"
          stroke="#000"
          strokeWidth="3"
          pointerEvents="none"
          style={{ userSelect: "none" }}
          >
            {formatLengthFromPixels(pixelLength, metersPerPixel)}
          </text>
        )}

        {selected && (
          <>
            <Handle x={svgShape.x1} y={svgShape.y1} active />
            <Handle x={svgShape.x2} y={svgShape.y2} active />
          </>
        )}
      </>
    );
  }

  if (svgShape.kind === "rect") {
    const label = getRectLabel(annotation, metersPerPixel);
    const handles = getRectHandles(annotation);

    return (
      <>
        <rect
          x={svgShape.x}
          y={svgShape.y}
          width={svgShape.width}
          height={svgShape.height}
          fill={selected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <text
          x={svgShape.x + 8}
          y={svgShape.y + 18}
          fill="#fff"
          fontSize="12"
          fontWeight="600"
          paintOrder="stroke"
          stroke="#000"
          strokeWidth="3"
        >
          {label}
        </text>

        {selected &&
          Object.values(handles).map((handlePoint, index) => {
            const p = imageToScreen(handlePoint);
            return <Handle key={index} x={p.x} y={p.y} active />;
          })}
      </>
    );
  }

  return null;
}

function DraftPreview({ draft, imageToScreen, metersPerPixel }) {
  if (!draft) return null;

  const svgShape = annotationToSvg(draft, imageToScreen);
  if (!svgShape) return null;

  if (svgShape.kind === "point") {
    return (
      <circle
        cx={svgShape.cx}
        cy={svgShape.cy}
        r={svgShape.r}
        fill={draft.color}
        stroke="#fff"
        strokeWidth="1"
      />
    );
  }

  if (svgShape.kind === "line") {
    const midX = (svgShape.x1 + svgShape.x2) / 2;
    const midY = (svgShape.y1 + svgShape.y2) / 2;
    const pixelLength = distance(draft.start, draft.end);

    return (
      <>
        <line
          x1={svgShape.x1}
          y1={svgShape.y1}
          x2={svgShape.x2}
          y2={svgShape.y2}
          stroke={draft.color}
          strokeWidth={draft.strokeWidth || 2}
          strokeDasharray="6 4"
        />
        {draft.tool === TOOL_MEASURE && (
          <text
            x={midX + 8}
            y={midY - 8}
            fill="#fff"
            fontSize="12"
            fontWeight="600"
            paintOrder="stroke"
            stroke="#000"
            strokeWidth="3"
          >
            {formatLengthFromPixels(pixelLength, metersPerPixel)}
          </text>
        )}
      </>
    );
  }

  if (svgShape.kind === "rect") {
    const label = getRectLabel(draft, metersPerPixel);

    return (
      <>
        <rect
          x={svgShape.x}
          y={svgShape.y}
          width={svgShape.width}
          height={svgShape.height}
          fill="rgba(255,255,255,0.04)"
          stroke={draft.color}
          strokeWidth={draft.strokeWidth || 2}
          strokeDasharray="6 4"
        />
        <text
          x={svgShape.x + 8}
          y={svgShape.y + 18}
          fill="#fff"
          fontSize="12"
          fontWeight="600"
          paintOrder="stroke"
          stroke="#000"
          strokeWidth="3"
        >
          {label}
        </text>
      </>
    );
  }

  return null;
}

function AnnotationOverlay({
  activeTool,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
  color,
  imageToScreen,
  screenToImage,
  metersPerPixel,
}) {
  const svgRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [interaction, setInteraction] = useState(null);

  const drawingEnabled = useMemo(() => {
    return [TOOL_POINT, TOOL_LINE, TOOL_RECT, TOOL_MEASURE].includes(activeTool);
  }, [activeTool]);
  
  const selectionEnabled = useMemo(() => {
    return activeTool === TOOL_SELECT;
  }, [activeTool]);
  
  const interactiveOverlayEnabled = useMemo(() => {
    return drawingEnabled || selectionEnabled;
  }, [drawingEnabled, selectionEnabled]);


  const findHit = (screenPoint) => {
    for (let i = annotations.length - 1; i >= 0; i -= 1) {
      const annotation = annotations[i];
      const result = hitTestAnnotation(annotation, screenPoint, imageToScreen);
      if (result.hit) {
        return {
          annotation,
          ...result,
        };
      }
    }
    return null;
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    if (!svgRef.current) return;
    if (!interactiveOverlayEnabled) return;
    event.preventDefault();
    const screenPoint = getRelativePoint(event, svgRef.current);
    const imagePoint = screenToImage(screenPoint);
    if (!imagePoint) return;

    const hit = findHit(screenPoint);

    if (selectionEnabled && hit) {
        const isAlreadySelected = selectedAnnotationId === hit.annotation.id;
      
        if (!isAlreadySelected) {
          onSelectAnnotation?.(hit.annotation.id);
          setInteraction(null);
          return;
        }
      
        if (hit.annotation.tool === TOOL_POINT) {
          setInteraction({
            mode: "move-point",
            annotationId: hit.annotation.id,
          });
          return;
        }
      
        if (hit.annotation.tool === TOOL_LINE || hit.annotation.tool === TOOL_MEASURE) {
          if (hit.type === "handle-start") {
            setInteraction({
              mode: "line-start",
              annotationId: hit.annotation.id,
            });
            return;
          }
      
          if (hit.type === "handle-end") {
            setInteraction({
              mode: "line-end",
              annotationId: hit.annotation.id,
            });
            return;
          }
      
          setInteraction({
            mode: "move-line",
            annotationId: hit.annotation.id,
            startPointer: imagePoint,
            original: {
              start: hit.annotation.start,
              end: hit.annotation.end,
            },
          });
          return;
        }
      
        if (hit.annotation.tool === TOOL_RECT) {
          if (hit.type === "handle-rect") {
            setInteraction({
              mode: "rect-handle",
              annotationId: hit.annotation.id,
              handle: hit.handle,
            });
            return;
          }
      
          setInteraction({
            mode: "move-rect",
            annotationId: hit.annotation.id,
            startPointer: imagePoint,
            original: {
              x: hit.annotation.x,
              y: hit.annotation.y,
              width: hit.annotation.width,
              height: hit.annotation.height,
            },
          });
          return;
        }
      
        return;
      }
    
    if (selectionEnabled) {
      onSelectAnnotation?.(null);
      return;
    }
    
    if (!drawingEnabled) return;

    if (activeTool === TOOL_POINT) {
      onAddAnnotation({
        id: createAnnotationId(),
        tool: TOOL_POINT,
        x: imagePoint.x,
        y: imagePoint.y,
        color: color || DEFAULT_ANNOTATION_COLOR,
        strokeWidth: 2,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (activeTool === TOOL_LINE || activeTool === TOOL_MEASURE) {
      setDraft({
        id: "draft",
        tool: activeTool,
        start: imagePoint,
        end: imagePoint,
        color:
          color ||
          (activeTool === TOOL_MEASURE
            ? DEFAULT_MEASURE_COLOR
            : DEFAULT_ANNOTATION_COLOR),
        strokeWidth: 2,
      });
      return;
    }

    if (activeTool === TOOL_RECT) {
      setDraft({
        id: "draft",
        tool: TOOL_RECT,
        x: imagePoint.x,
        y: imagePoint.y,
        width: 0,
        height: 0,
        anchor: imagePoint,
        color: color || DEFAULT_ANNOTATION_COLOR,
        strokeWidth: 2,
      });
    }
  };

  const handlePointerMove = (event) => {
    if (!svgRef.current) return;

    const screenPoint = getRelativePoint(event, svgRef.current);
    const imagePoint = screenToImage(screenPoint);
    if (!imagePoint) return;

    if (interaction) {
      const annotation = annotations.find((item) => item.id === interaction.annotationId);
      if (!annotation) return;

      if (interaction.mode === "move-point") {
        onUpdateAnnotation?.(annotation.id, {
          x: imagePoint.x,
          y: imagePoint.y,
        });
        return;
      }

      if (interaction.mode === "line-start") {
        onUpdateAnnotation?.(annotation.id, {
          start: imagePoint,
        });
        return;
      }

      if (interaction.mode === "line-end") {
        onUpdateAnnotation?.(annotation.id, {
          end: imagePoint,
        });
        return;
      }

      if (interaction.mode === "move-line") {
        const dx = imagePoint.x - interaction.startPointer.x;
        const dy = imagePoint.y - interaction.startPointer.y;

        onUpdateAnnotation?.(annotation.id, {
          start: {
            x: interaction.original.start.x + dx,
            y: interaction.original.start.y + dy,
          },
          end: {
            x: interaction.original.end.x + dx,
            y: interaction.original.end.y + dy,
          },
        });
        return;
      }

      if (interaction.mode === "rect-handle") {
        const nextRect = updateRectFromHandle(annotation, interaction.handle, imagePoint);
        onUpdateAnnotation?.(annotation.id, nextRect);
        return;
      }

      if (interaction.mode === "move-rect") {
        const dx = imagePoint.x - interaction.startPointer.x;
        const dy = imagePoint.y - interaction.startPointer.y;

        onUpdateAnnotation?.(annotation.id, {
          x: interaction.original.x + dx,
          y: interaction.original.y + dy,
        });
      }

      return;
    }

    if (!draft) return;

    if (draft.tool === TOOL_LINE || draft.tool === TOOL_MEASURE) {
      setDraft((prev) => ({ ...prev, end: imagePoint }));
      return;
    }

    if (draft.tool === TOOL_RECT) {
      const rect = rectFromPoints(draft.anchor, imagePoint);
      setDraft((prev) => ({
        ...prev,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }));
    }
  };

  const handlePointerUp = () => {
    if (interaction) {
      setInteraction(null);
      return;
    }

    if (!draft) return;

    if (draft.tool === TOOL_LINE || draft.tool === TOOL_MEASURE) {
      const pixelLength = distance(draft.start, draft.end);
      if (pixelLength >= 2) {
        onAddAnnotation({
          id: createAnnotationId(),
          tool: draft.tool,
          start: draft.start,
          end: draft.end,
          color: draft.color,
          strokeWidth: draft.strokeWidth,
          createdAt: new Date().toISOString(),
        });
      }
      setDraft(null);
      return;
    }

    if (draft.tool === TOOL_RECT) {
      if (draft.width >= 2 && draft.height >= 2) {
        onAddAnnotation({
          id: createAnnotationId(),
          tool: TOOL_RECT,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height,
          color: draft.color,
          strokeWidth: draft.strokeWidth,
          createdAt: new Date().toISOString(),
        });
      }
      setDraft(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId) {
        onDeleteAnnotation?.(selectedAnnotationId);
      }

      if (event.key === "Escape") {
        setDraft(null);
        setInteraction(null);
        onSelectAnnotation?.(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotationId, onDeleteAnnotation, onSelectAnnotation]);

  return (
    <svg
      ref={svgRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        width: "100%",
        height: "100%",
        pointerEvents: interactiveOverlayEnabled ? "auto" : "none",
        touchAction: interactiveOverlayEnabled ? "none" : "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
        outline: "none",
      }}
    >
      {annotations.map((annotation) => (
        <AnnotationShape
          key={annotation.id}
          annotation={annotation}
          imageToScreen={imageToScreen}
          metersPerPixel={metersPerPixel}
          selected={annotation.id === selectedAnnotationId}
        />
      ))}

      <DraftPreview
        draft={draft}
        imageToScreen={imageToScreen}
        metersPerPixel={metersPerPixel}
      />
    </svg>
  );
}

export default AnnotationOverlay;