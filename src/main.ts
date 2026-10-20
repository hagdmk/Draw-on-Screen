import { renderScene } from "./core/render";
import { Scene } from "./core/scene";
import type { InputPoint, PenStyle } from "./core/types";
import { getDrawMode, onDrawModeChange, setDrawMode } from "./desktop/bridge";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const ctx = canvas.getContext("2d")!;

const scene = new Scene();
// Step 1 uses a fixed pen; the toolbar arrives in a later step.
const pen: PenStyle = { color: "#ff3b30", size: 8 };

let drawing = false;
let frameRequested = false;

function requestRender(): void {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    renderScene(ctx, scene.items, scene.activeStroke);
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
  if (!on) scene.cancelStroke();
  requestRender();
}

function toPoint(event: PointerEvent): InputPoint {
  // Mouse reports a constant 0.5, so only pens get real pressure.
  const pressure = event.pointerType === "pen" ? event.pressure : 0.5;
  return [event.clientX, event.clientY, pressure];
}

canvas.addEventListener("pointerdown", (event) => {
  if (!drawing || event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  scene.beginStroke(toPoint(event), pen, event.pointerType !== "pen");
  requestRender();
});

canvas.addEventListener("pointermove", (event) => {
  if (!scene.activeStroke) return;
  // Coalesced events keep fast strokes smooth on high-rate pens and mice.
  const samples = event.getCoalescedEvents?.() ?? [event];
  for (const sample of samples) scene.extendStroke(toPoint(sample));
  requestRender();
});

const finishStroke = () => {
  scene.endStroke();
  requestRender();
};
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);

window.addEventListener("keydown", (event) => {
  if (!drawing) return;
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === "Escape") {
    void setDrawMode(false);
    applyDrawMode(false);
  } else if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) scene.redo();
    else scene.undo();
    requestRender();
  } else if (mod && event.key.toLowerCase() === "y") {
    event.preventDefault();
    scene.redo();
    requestRender();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    scene.clear();
    requestRender();
  }
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

void onDrawModeChange(applyDrawMode);
void getDrawMode().then(applyDrawMode);
