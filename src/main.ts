import { constrainEnd } from "./core/geometry";
import { applyOp, type SceneOp } from "./core/ops";
import { renderScene } from "./core/render";
import { Scene } from "./core/scene";
import { isFreehandTool, isShapeTool, type InputPoint, type Point, type ToolState } from "./core/types";
import {
  getDrawMode,
  getOverlayGeometry,
  inDesktopApp,
  onCommand,
  onDrawModeChange,
  onSceneOps,
  onToolState,
  requestToolState,
  sendSceneOps,
  type Command,
  type OverlayGeometry,
} from "./desktop/bridge";
import { loadToolState } from "./toolState";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const ctx = canvas.getContext("2d")!;

const scene = new Scene();
let tool: ToolState = loadToolState();
let drawing = false;
let erasing = false;
/** The pointer drawing in this window. The other overlays share the scene but not the gesture. */
let gesturePointer: number | null = null;
let frameRequested = false;
// There is one overlay per screen. Items are stored in desktop coordinates, so a stroke that
// crosses from one screen to the next lines up on both.
let geometry: OverlayGeometry = { x: 0, y: 0, k: 1 };

function requestRender(): void {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    renderScene(ctx, scene.items, scene.activeItem);
  });
}

/**
 * Matches the canvas backing store to the display's pixel density so lines stay sharp, and maps
 * desktop coordinates onto this screen.
 */
function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const scale = dpr / geometry.k;
  ctx.setTransform(scale, 0, 0, scale, -geometry.x * scale, -geometry.y * scale);
  requestRender();
}

/** Applies changes made here and shares them with the other screens. */
function apply(...ops: SceneOp[]): void {
  for (const op of ops) applyOp(scene, op);
  void sendSceneOps(ops);
  requestRender();
}

function applyDrawMode(on: boolean): void {
  drawing = on;
  document.body.classList.toggle("drawing", on);
  hud.hidden = !on;
  // Every overlay gets this event, so each one drops the unfinished item on its own.
  scene.cancelItem();
  if (erasing) apply({ op: "erase-end" });
  erasing = false;
  gesturePointer = null;
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

/**
 * Converts a pointer position to desktop coordinates. In "single" screen mode the point is
 * kept on this screen, so a stroke stops at the screen edge instead of crossing over.
 */
function toDesktop(event: PointerEvent): Point {
  let { clientX: x, clientY: y } = event;
  if (tool.screens === "single") {
    x = Math.min(Math.max(x, 0), window.innerWidth);
    y = Math.min(Math.max(y, 0), window.innerHeight);
  }
  return [geometry.x + x * geometry.k, geometry.y + y * geometry.k];
}

function toPoint(event: PointerEvent): InputPoint {
  // Mouse reports a constant 0.5, so only pens get real pressure.
  const pressure = event.pointerType === "pen" ? event.pressure : 0.5;
  return [...toDesktop(event), pressure];
}

// Thickness is chosen in CSS pixels; scaling it to desktop units keeps it looking as chosen on
// this screen even when screens use different scaling.
function strokeSize(): number {
  return tool.size * geometry.k;
}

function eraserRadius(): number {
  return Math.max(tool.size * 1.5, 8) * geometry.k;
}

canvas.addEventListener("pointerdown", (event) => {
  if (!drawing || event.button !== 0 || gesturePointer !== null) return;
  // Capture keeps the stroke coming to this window when the pointer moves onto another screen.
  canvas.setPointerCapture(event.pointerId);
  gesturePointer = event.pointerId;
  const point = toPoint(event);
  const style = { color: tool.color, size: strokeSize() };
  if (tool.tool === "eraser") {
    erasing = true;
    apply({ op: "erase-begin" }, { op: "erase", point: [point[0], point[1]], radius: eraserRadius() });
  } else if (isFreehandTool(tool.tool)) {
    apply({ op: "stroke", tool: tool.tool, point, style, simulatePressure: event.pointerType !== "pen" });
  } else if (isShapeTool(tool.tool)) {
    apply({ op: "shape", tool: tool.tool, point: [point[0], point[1]], style });
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== gesturePointer) return;
  if (erasing) {
    apply({ op: "erase", point: toDesktop(event), radius: eraserRadius() });
    return;
  }
  const active = scene.activeItem;
  if (!active) return;
  if (active.kind === "shape") {
    let end = toDesktop(event);
    if (event.shiftKey) end = constrainEnd(active.tool, active.start, end);
    apply({ op: "extend", points: [[end[0], end[1], 0.5]] });
  } else {
    // Coalesced events keep fast strokes smooth on high-rate pens and mice.
    const samples = event.getCoalescedEvents?.() ?? [event];
    apply({ op: "extend", points: samples.map(toPoint) });
  }
});

const finishGesture = (event: PointerEvent) => {
  if (event.pointerId !== gesturePointer) return;
  gesturePointer = null;
  if (erasing) {
    erasing = false;
    apply({ op: "erase-end" });
  } else if (scene.activeItem) {
    apply({ op: "end" });
  }
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
void getOverlayGeometry().then((g) => {
  geometry = g;
  resizeCanvas();
});

void onSceneOps((ops) => {
  let changed = false;
  for (const op of ops) changed = applyOp(scene, op) || changed;
  if (changed) requestRender();
});

void onToolState(applyToolState);
void onCommand(runCommand);
void onDrawModeChange(applyDrawMode);
void getDrawMode().then(applyDrawMode);
void requestToolState();
