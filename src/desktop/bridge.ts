import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SceneOp } from "../core/ops";
import type { ToolState } from "../core/types";

/**
 * Thin wrapper around the Rust side and the events shared by the overlay and toolbar windows.
 * In a plain browser (the tablet web app, or npm run dev without Tauri) there is no Rust side:
 * events go through an in-page bus instead, so a toolbar and a canvas on one page still talk.
 */
export const inDesktopApp = isTauri();

const pageBus = new EventTarget();

async function emitEvent(name: string, payload?: unknown): Promise<void> {
  if (inDesktopApp) await emit(name, payload);
  else pageBus.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

async function listenEvent<T>(name: string, handler: (payload: T) => void): Promise<void> {
  // The in-page listener is added before the first await, so it catches events sent right after.
  if (!inDesktopApp) pageBus.addEventListener(name, (event) => handler((event as CustomEvent<T>).detail));
  else await listen<T>(name, (event) => handler(event.payload));
}

/** Actions the toolbar or a keyboard shortcut asks the overlay to perform. */
export type Command = "undo" | "redo" | "clear";

export async function getDrawMode(): Promise<boolean> {
  return inDesktopApp ? invoke<boolean>("get_draw_mode") : true;
}

export async function setDrawMode(drawing: boolean): Promise<void> {
  if (inDesktopApp) await invoke("set_draw_mode", { drawing });
  else await emitEvent("draw-mode", drawing);
}

export async function onDrawModeChange(handler: (drawing: boolean) => void): Promise<void> {
  await listenEvent("draw-mode", handler);
}

/**
 * Where this overlay sits in desktop coordinates, the space shared by all screens:
 * a point at client position (cx, cy) is at (x + cx * k, y + cy * k) on the desktop.
 */
export interface OverlayGeometry {
  x: number;
  y: number;
  /** Desktop units per CSS pixel; 1 unless screens use different scaling. */
  k: number;
}

export async function getOverlayGeometry(): Promise<OverlayGeometry> {
  const fallback = { x: 0, y: 0, k: 1 };
  if (!inDesktopApp) return fallback;
  return (await invoke<OverlayGeometry | null>("overlay_geometry")) ?? fallback;
}

interface SceneOpsMessage {
  from: string;
  ops: SceneOp[];
}

const windowLabel = inDesktopApp ? getCurrentWindow().label : "overlay";

/** Shares drawing changes made in this overlay with the overlays on the other screens. */
export async function sendSceneOps(ops: SceneOp[]): Promise<void> {
  if (inDesktopApp && ops.length > 0) await emit("scene-ops", { from: windowLabel, ops } satisfies SceneOpsMessage);
}

/** Drawing changes made in the other overlays; this window's own changes are skipped. */
export async function onSceneOps(handler: (ops: SceneOp[]) => void): Promise<void> {
  if (!inDesktopApp) return;
  await listen<SceneOpsMessage>("scene-ops", (event) => {
    if (event.payload.from !== windowLabel) handler(event.payload.ops);
  });
}

export async function sendToolState(state: ToolState): Promise<void> {
  await emitEvent("tool-state", state);
}

export async function onToolState(handler: (state: ToolState) => void): Promise<void> {
  await listenEvent("tool-state", handler);
}

/** The overlay asks for the current tool when it (re)loads; the toolbar answers with sendToolState. */
export async function requestToolState(): Promise<void> {
  await emitEvent("tool-state-request");
}

export async function onToolStateRequest(handler: () => void): Promise<void> {
  await listenEvent("tool-state-request", handler);
}

export async function sendCommand(command: Command): Promise<void> {
  await emitEvent("command", command);
}

export async function onCommand(handler: (command: Command) => void): Promise<void> {
  await listenEvent("command", handler);
}

/** Number keys pressed while drawing; the toolbar maps them to tools. */
export async function onToolShortcut(handler: (index: number) => void): Promise<void> {
  await listenEvent("tool-shortcut", handler);
}

export async function getAutostart(): Promise<boolean> {
  return inDesktopApp ? invoke<boolean>("get_autostart") : false;
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  return inDesktopApp ? invoke<boolean>("set_autostart", { enabled }) : enabled;
}

export async function onAutostartChange(handler: (enabled: boolean) => void): Promise<void> {
  if (inDesktopApp) await listen<boolean>("autostart", (event) => handler(event.payload));
}

export async function minimizeToolbar(): Promise<void> {
  if (inDesktopApp) await invoke("minimize_toolbar");
}

export async function quitApp(): Promise<void> {
  if (inDesktopApp) await invoke("quit_app");
}
