export const TOOL_PAN = "pan";
export const TOOL_SELECT = "select";
export const TOOL_POINT = "point";
export const TOOL_LINE = "line";
export const TOOL_RECT = "rect";
export const TOOL_MEASURE = "measure";
export const TOOL_AI = "ai";

export const DRAW_TOOLS = [TOOL_POINT, TOOL_LINE, TOOL_RECT, TOOL_MEASURE];

export const DEFAULT_ANNOTATION_COLOR = "#ff4d4f";
export const DEFAULT_MEASURE_COLOR = "#22c55e";

export function createAnnotationBase(tool, color) {
  return {
    id: crypto.randomUUID(),
    tool,
    color:
      color ||
      (tool === TOOL_MEASURE ? DEFAULT_MEASURE_COLOR : DEFAULT_ANNOTATION_COLOR),
    strokeWidth: 2,
    createdAt: new Date().toISOString(),
  };
}