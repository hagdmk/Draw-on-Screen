import { RAINBOW, type Tool, type ToolState } from "./core/types";
import {
  getAutostart,
  getDrawMode,
  minimizeToolbar,
  onAutostartChange,
  onDrawModeChange,
  onToolShortcut,
  onToolStateRequest,
  quitApp,
  sendCommand,
  sendToolState,
  setAutostart,
  setDrawMode,
  type Command,
} from "./desktop/bridge";
import { icons } from "./icons";
import { loadToolState, saveToolState } from "./toolState";

// Order matters: number keys 1-8 pick tools in this order while drawing.
const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "brush", label: "Brush" },
  { id: "highlighter", label: "Highlighter" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "rect", label: "Rectangle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "eraser", label: "Eraser" },
];

const COLORS: { value: string; label: string }[] = [
  { value: "#ff3b30", label: "Red" },
  { value: "#ff9500", label: "Orange" },
  { value: "#ffcc00", label: "Yellow" },
  { value: "#34c759", label: "Green" },
  { value: "#007aff", label: "Blue" },
  { value: "#af52de", label: "Purple" },
  { value: "#1c1c1e", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: RAINBOW, label: "Rainbow" },
];

const SIZES: { value: number; label: string; dot: number }[] = [
  { value: 3, label: "Thin", dot: 4 },
  { value: 6, label: "Medium", dot: 8 },
  { value: 12, label: "Thick", dot: 13 },
];

const RAINBOW_SWATCH = "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)";

let state: ToolState = loadToolState();
let drawing = false;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const modeButton = $<HTMLButtonElement>("#mode");
const autostartBox = $<HTMLInputElement>("#autostart");

function button(className: string, label: string, html = ""): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = className;
  el.title = label;
  el.setAttribute("aria-label", label);
  el.innerHTML = html;
  return el;
}

function update(change: Partial<ToolState>): void {
  state = { ...state, ...change };
  saveToolState(state);
  void sendToolState(state);
  render();
}

function selectTool(id: Tool): void {
  update({ tool: id });
  // Picking a tool means the user wants to draw now.
  if (!drawing) void setDrawMode(true);
}

const toolButtons = TOOLS.map(({ id, label }, index) => {
  const el = button("icon-button", `${label} (${index + 1})`, icons[id]);
  el.addEventListener("click", () => selectTool(id));
  $("#tools").append(el);
  return { id, el };
});

const colorButtons = COLORS.map(({ value, label }) => {
  const el = button("swatch", label);
  el.style.setProperty("--swatch", value === RAINBOW ? RAINBOW_SWATCH : value);
  el.addEventListener("click", () => update({ color: value }));
  $("#colors").append(el);
  return { value, el };
});

// Custom color: a native color picker hidden over a swatch that shows the picked color.
const customSwatch = button("swatch custom", "Custom color");
const customInput = document.createElement("input");
customInput.type = "color";
customInput.addEventListener("input", () => update({ color: customInput.value }));
customSwatch.append(customInput);
$("#colors").append(customSwatch);

const sizeButtons = SIZES.map(({ value, label, dot }) => {
  const el = button("size", label);
  el.style.setProperty("--dot", `${dot}px`);
  el.addEventListener("click", () => update({ size: value }));
  $("#sizes").append(el);
  return { value, el };
});

const ACTIONS: { id: Command | "settings"; label: string }[] = [
  { id: "undo", label: "Undo (Ctrl/Cmd+Z)" },
  { id: "redo", label: "Redo (Ctrl/Cmd+Shift+Z)" },
  { id: "clear", label: "Clear all (Delete)" },
  { id: "settings", label: "Settings" },
];
for (const { id, label } of ACTIONS) {
  const el = button("icon-button", label, icons[id]);
  el.addEventListener("click", () => (id === "settings" ? showSettings(true) : void sendCommand(id)));
  $("#actions").append(el);
}

function render(): void {
  for (const { id, el } of toolButtons) el.setAttribute("aria-pressed", String(id === state.tool));
  const preset = COLORS.some((c) => c.value === state.color);
  for (const { value, el } of colorButtons) el.setAttribute("aria-pressed", String(value === state.color));
  customSwatch.setAttribute("aria-pressed", String(!preset));
  customSwatch.style.setProperty("--swatch", preset ? "#888" : state.color);
  if (!preset) customInput.value = state.color;
  for (const { value, el } of sizeButtons) el.setAttribute("aria-pressed", String(value === state.size));
  modeButton.setAttribute("aria-pressed", String(drawing));
  modeButton.innerHTML = drawing ? `${icons.pen}<span>Drawing</span>` : `${icons.pointer}<span>Draw</span>`;
}

function showSettings(show: boolean): void {
  $("#main-view").hidden = show;
  $("#settings-view").hidden = !show;
}

modeButton.addEventListener("click", () => void setDrawMode(!drawing));
$("#minimize").innerHTML = icons.minimize;
$("#minimize").addEventListener("click", () => void minimizeToolbar());
$("#back").addEventListener("click", () => showSettings(false));
$("#quit").addEventListener("click", () => void quitApp());
autostartBox.addEventListener("change", async () => {
  autostartBox.checked = await setAutostart(autostartBox.checked);
});

void onDrawModeChange((on) => {
  drawing = on;
  render();
});
void onToolStateRequest(() => void sendToolState(state));
void onToolShortcut((index) => {
  const entry = TOOLS[index];
  if (entry) update({ tool: entry.id });
});
void onAutostartChange((enabled) => (autostartBox.checked = enabled));
void getAutostart().then((enabled) => (autostartBox.checked = enabled));
void getDrawMode().then((on) => {
  drawing = on;
  render();
});

render();
void sendToolState(state);
