import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
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
