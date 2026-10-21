import type { Scene } from "./scene";
import type { FreehandTool, InputPoint, Point, ShapeTool } from "./types";

interface Style {
  color: string;
  size: number;
}

/**
 * One change to the scene. Every screen has its own overlay window with its own copy of the
 * scene; the window that receives the pointer applies each op locally and sends it to the
 * others, which apply the same ops in the same order and so end up with the same drawing.
 */
export type SceneOp =
  | { op: "stroke"; tool: FreehandTool; point: InputPoint; style: Style; simulatePressure: boolean }
  | { op: "shape"; tool: ShapeTool; point: Point; style: Style }
  | { op: "extend"; points: InputPoint[] }
  | { op: "end" }
  | { op: "cancel" }
  | { op: "erase-begin" }
  | { op: "erase"; point: Point; radius: number }
  | { op: "erase-end" };

/** Applies an op and reports whether anything visible may have changed. */
export function applyOp(scene: Scene, op: SceneOp): boolean {
  switch (op.op) {
    case "stroke":
      scene.beginStroke(op.tool, op.point, op.style, op.simulatePressure);
      return true;
    case "shape":
      scene.beginShape(op.tool, op.point, op.style);
      return true;
    case "extend":
      for (const point of op.points) scene.extend(point);
      return op.points.length > 0;
    case "end":
      scene.endItem();
      return true;
    case "cancel":
      scene.cancelItem();
      return true;
    case "erase-begin":
      scene.beginErase();
      return false;
    case "erase":
      return scene.eraseAt(op.point, op.radius);
    case "erase-end":
      scene.endErase();
      return false;
  }
}
