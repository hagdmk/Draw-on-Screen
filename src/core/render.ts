import { getStroke, type StrokeOptions } from "perfect-freehand";
import { RAINBOW, type FreehandTool, type Item, type Shape, type Stroke } from "./types";

/** How each freehand tool shapes its line. Sizes are multiples of the chosen thickness. */
const FREEHAND: Record<FreehandTool, { scale: number; alpha: number; options: StrokeOptions }> = {
  pen: { scale: 1, alpha: 1, options: { thinning: 0.5, smoothing: 0.5, streamline: 0.45 } },
  brush: {
    scale: 1.8,
    alpha: 1,
    options: { thinning: 0.8, smoothing: 0.6, streamline: 0.5, start: { taper: true }, end: { taper: true } },
  },
  highlighter: { scale: 3, alpha: 0.35, options: { thinning: 0, smoothing: 0.5, streamline: 0.5 } },
};

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

/** Hue in degrees for a position along a rainbow line. */
function rainbowHue(distance: number): number {
  return (distance * 0.6) % 360;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const spec = FREEHAND[stroke.tool];
  const size = stroke.size * spec.scale;
  const path = outlineToPath(
    getStroke(stroke.points, { ...spec.options, size, simulatePressure: stroke.simulatePressure }),
  );
  ctx.globalAlpha = spec.alpha;
  if (stroke.color !== RAINBOW) {
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
    return;
  }
  // Paint hue-shifting segments, clipped to the stroke outline so the shape stays intact.
  ctx.save();
  ctx.clip(path);
  ctx.lineWidth = size * 2;
  ctx.lineCap = "round";
  let travelled = 0;
  const pts = stroke.points;
  for (let i = 1; i < pts.length; i++) {
    travelled += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    ctx.strokeStyle = `hsl(${rainbowHue(travelled)} 95% 55%)`;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  if (pts.length === 1) {
    ctx.fillStyle = `hsl(0 95% 55%)`;
    ctx.fill(path);
  }
  ctx.restore();
}

function shapeStrokeStyle(ctx: CanvasRenderingContext2D, shape: Shape): string | CanvasGradient {
  if (shape.color !== RAINBOW) return shape.color;
  const [x0, y0] = shape.start;
  const [x1, y1] = shape.end;
  const gradient = ctx.createLinearGradient(x0, y0, x1 === x0 && y1 === y0 ? x0 + 1 : x1, y1);
  for (let i = 0; i <= 6; i++) gradient.addColorStop(i / 6, `hsl(${i * 60} 95% 55%)`);
  return gradient;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const [x0, y0] = shape.start;
  const [x1, y1] = shape.end;
  ctx.globalAlpha = 1;
  ctx.lineWidth = shape.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = shapeStrokeStyle(ctx, shape);
  ctx.beginPath();
  switch (shape.tool) {
    case "line":
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      break;
    case "arrow": {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(shape.size * 4, 14);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      for (const side of [-1, 1]) {
        const a = angle + Math.PI - side * (Math.PI / 7);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(a) * head, y1 + Math.sin(a) * head);
      }
      break;
    }
    case "rect":
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      break;
    case "ellipse":
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
      break;
  }
  ctx.stroke();
}

export function drawItem(ctx: CanvasRenderingContext2D, item: Item): void {
  if (item.kind === "stroke") drawStroke(ctx, item);
  else drawShape(ctx, item);
  ctx.globalAlpha = 1;
}

/** Clears the canvas and paints all committed items, then the one being drawn. */
export function renderScene(ctx: CanvasRenderingContext2D, items: readonly Item[], active: Item | null): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  for (const item of items) drawItem(ctx, item);
  if (active) drawItem(ctx, active);
}
