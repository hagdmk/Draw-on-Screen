import { constrainEnd } from "./core/geometry";
import { renderScene } from "./core/render";
import { Scene } from "./core/scene";
import { isFreehandTool, isShapeTool, type InputPoint, type Point, type ToolState } from "./core/types";
import {
  getDrawMode,
  inDesktopApp,
  onCommand,
  onDrawModeChange,
  onToolState,
  requestToolState,
  type Command,
} from "./desktop/bridge";
import { loadToolState } from "./toolState";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const ctx = canvas.getContext("2d")!;

const scene = new Scene();
let tool: ToolState = loadToolState();
let drawing = false;
let erasing = false;
let frameRequested = false;

function requestRender(): void {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    renderScene(ctx, scene.items, scene.activeItem);
  });
}

/** Matches the canvas backing store to the display's pixel density so lines stay sharp. */
function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  requestRender();
}

function applyDrawMode(on: boolean): void {
  drawing = on;
  document.body.classList.toggle("drawing", on);
  hud.hidden = !on;
  scene.cancelItem();
  requestRender();
}

function applyToolState(state: ToolState): void {
  tool = state;
  document.body.dataset.tool = state.tool;
}

function runCommand(command: Command): void {
  if (command === "undo") scene.undo();
  else if (command === "redo") scene.redo();
  else scene.clear();
  requestRender();
}

function toPoint(event: PointerEvent): InputPoint {
  // Mouse reports a constant 0.5, so only pens get real pressure.
  const pressure = event.pointerType === "pen" ? event.pressure : 0.5;
  return [event.clientX, event.clientY, pressure];
}

function eraserRadius(): number {
  return Math.max(tool.size * 1.5, 8);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!drawing || event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  const point = toPoint(event);
  const style = { color: tool.color, size: tool.size };
  if (tool.tool === "eraser") {
    erasing = true;
    scene.beginErase();
    scene.eraseAt([point[0], point[1]], eraserRadius());
  } else if (isFreehandTool(tool.tool)) {
    scene.beginStroke(tool.tool, point, style, event.pointerType !== "pen");
  } else if (isShapeTool(tool.tool)) {
    scene.beginShape(tool.tool, [point[0], point[1]], style);
  }
  requestRender();
});

canvas.addEventListener("pointermove", (event) => {
  if (erasing) {
    if (scene.eraseAt([event.clientX, event.clientY], eraserRadius())) requestRender();
    return;
  }
  const active = scene.activeItem;
  if (!active) return;
  if (active.kind === "shape") {
    let end: Point = [event.clientX, event.clientY];
    if (event.shiftKey) end = constrainEnd(active.tool, active.start, end);
    scene.extend([end[0], end[1], 0.5]);
  } else {
    // Coalesced events keep fast strokes smooth on high-rate pens and mice.
    const samples = event.getCoalescedEvents?.() ?? [event];
    for (const sample of samples) scene.extend(toPoint(sample));
  }
  requestRender();
});

const finishGesture = () => {
  if (erasing) {
    erasing = false;
    scene.endErase();
  } else {
    scene.endItem();
  }
  requestRender();
};
canvas.addEventListener("pointerup", finishGesture);
canvas.addEventListener("pointercancel", finishGesture);

// In the desktop app these keys arrive as global shortcuts (the overlay never takes focus).
// The listener below covers the browser-only dev mode.
if (!inDesktopApp) {
  window.addEventListener("keydown", (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") runCommand(event.shiftKey ? "redo" : "undo");
    else if (mod && event.key.toLowerCase() === "y") runCommand("redo");
    else if (event.key === "Delete") runCommand("clear");
  });
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
applyToolState(tool);

void onToolState(applyToolState);
void onCommand(runCommand);
void onDrawModeChange(applyDrawMode);
void getDrawMode().then(applyDrawMode);
void requestToolState();
