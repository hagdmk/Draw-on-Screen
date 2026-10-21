import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SceneOp } from "../core/ops";
import type { ToolState } from "../core/types";

/**
 * Thin wrapper around the Rust side and the events shared by the overlay and toolbar windows.
 * In a plain browser (npm run dev without Tauri) there is nothing to talk to, so calls are no-ops.
 */
export const inDesktopApp = isTauri();

/** Actions the toolbar or a keyboard shortcut asks the overlay to perform. */
export type Command = "undo" | "redo" | "clear";

export async function getDrawMode(): Promise<boolean> {
  return inDesktopApp ? invoke<boolean>("get_draw_mode") : true;
}

export async function setDrawMode(drawing: boolean): Promise<void> {
  if (inDesktopApp) await invoke("set_draw_mode", { drawing });
}

export async function onDrawModeChange(handler: (drawing: boolean) => void): Promise<void> {
  if (inDesktopApp) await listen<boolean>("draw-mode", (event) => handler(event.payload));
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
  if (inDesktopApp) await emit("tool-state", state);
}

export async function onToolState(handler: (state: ToolState) => void): Promise<void> {
  if (inDesktopApp) await listen<ToolState>("tool-state", (event) => handler(event.payload));
}

/** The overlay asks for the current tool when it (re)loads; the toolbar answers with sendToolState. */
export async function requestToolState(): Promise<void> {
  if (inDesktopApp) await emit("tool-state-request");
}

export async function onToolStateRequest(handler: () => void): Promise<void> {
  if (inDesktopApp) await listen("tool-state-request", () => handler());
}

export async function sendCommand(command: Command): Promise<void> {
  if (inDesktopApp) await emit("command", command);
}

export async function onCommand(handler: (command: Command) => void): Promise<void> {
  if (inDesktopApp) await listen<Command>("command", (event) => handler(event.payload));
}

/** Number keys pressed while drawing; the toolbar maps them to tools. */
export async function onToolShortcut(handler: (index: number) => void): Promise<void> {
  if (inDesktopApp) await listen<number>("tool-shortcut", (event) => handler(event.payload));
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
