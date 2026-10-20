/** A sampled input point: x, y in CSS pixels and pen pressure in [0, 1]. */
export type InputPoint = [x: number, y: number, pressure: number];
export type Point = [x: number, y: number];

export type FreehandTool = "pen" | "brush" | "highlighter";
export type ShapeTool = "line" | "arrow" | "rect" | "ellipse";
export type Tool = FreehandTool | ShapeTool | "eraser";

/** Special color value: the stroke cycles through hues along its length. */
export const RAINBOW = "rainbow";

/** What the toolbar currently has selected. */
export interface ToolState {
  tool: Tool;
  color: string;
  size: number;
}

interface ItemBase {
  id: number;
  color: string;
  size: number;
}

/** A freehand stroke stored as vector data, so it can be erased or selected later. */
export interface Stroke extends ItemBase {
  kind: "stroke";
  tool: FreehandTool;
  points: InputPoint[];
  /** True for mouse/touch input, where pressure is derived from speed instead of the device. */
  simulatePressure: boolean;
}

/** A shape defined by the two corners (or ends) of the drag that created it. */
export interface Shape extends ItemBase {
  kind: "shape";
  tool: ShapeTool;
  start: Point;
  end: Point;
}

export type Item = Stroke | Shape;

export const FREEHAND_TOOLS: readonly FreehandTool[] = ["pen", "brush", "highlighter"];
export const SHAPE_TOOLS: readonly ShapeTool[] = ["line", "arrow", "rect", "ellipse"];

export function isFreehandTool(tool: Tool): tool is FreehandTool {
  return (FREEHAND_TOOLS as readonly Tool[]).includes(tool);
}

export function isShapeTool(tool: Tool): tool is ShapeTool {
  return (SHAPE_TOOLS as readonly Tool[]).includes(tool);
}
