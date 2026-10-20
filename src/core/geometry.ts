import type { Item, Point, ShapeTool } from "./types";

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function distanceToPolyline(p: Point, points: readonly Point[]): number {
  if (points.length === 1) return Math.hypot(p[0] - points[0][0], p[1] - points[0][1]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
  }
  return best;
}

/** The outline of a shape as a polyline, used for hit testing. */
export function shapeOutline(tool: ShapeTool, start: Point, end: Point): Point[] {
  const [x0, y0] = start;
  const [x1, y1] = end;
  switch (tool) {
    case "line":
    case "arrow":
      return [start, end];
    case "rect":
      return [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ];
    case "ellipse": {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      const steps = 48;
      return Array.from({ length: steps + 1 }, (_, i): Point => {
        const angle = (i / steps) * Math.PI * 2;
        return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
      });
    }
  }
}

/** True when a circle of the given radius around p touches the item's visible line. */
export function hitTest(item: Item, p: Point, radius: number): boolean {
  const reach = radius + item.size / 2;
  const outline =
    item.kind === "stroke"
      ? item.points.map(([x, y]): Point => [x, y])
      : shapeOutline(item.tool, item.start, item.end);
  return distanceToPolyline(p, outline) <= reach;
}

/**
 * Adjusts a shape's end point while Shift is held: lines snap to 45-degree steps,
 * rectangles and ellipses become squares and circles.
 */
export function constrainEnd(tool: ShapeTool, start: Point, end: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (tool === "line" || tool === "arrow") {
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    const length = Math.hypot(dx, dy);
    return [start[0] + Math.cos(angle) * length, start[1] + Math.sin(angle) * length];
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return [start[0] + Math.sign(dx || 1) * side, start[1] + Math.sign(dy || 1) * side];
}
