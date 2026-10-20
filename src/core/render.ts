import { getStroke } from "perfect-freehand";
import type { Stroke } from "./types";

/** Turns a perfect-freehand outline polygon into a smooth closed path. */
function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length < 2) return path;
  const [first, ...rest] = outline;
  path.moveTo(first[0], first[1]);
  for (let i = 0; i < rest.length; i++) {
    const [x0, y0] = rest[i];
    const [x1, y1] = rest[(i + 1) % rest.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: stroke.simulatePressure,
  });
  ctx.fillStyle = stroke.color;
  ctx.fill(outlineToPath(outline));
}

/** Clears the canvas and paints all committed strokes, then the one being drawn. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  active: Stroke | null,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const stroke of strokes) drawStroke(ctx, stroke);
  if (active) drawStroke(ctx, active);
}
