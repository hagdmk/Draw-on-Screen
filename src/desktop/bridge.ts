import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Thin wrapper around the Rust side. In a plain browser (npm run dev without Tauri)
 * there is no overlay to toggle, so drawing mode is simply always on.
 */
export const inDesktopApp = isTauri();

export async function getDrawMode(): Promise<boolean> {
  return inDesktopApp ? invoke<boolean>("get_draw_mode") : true;
}

export async function setDrawMode(drawing: boolean): Promise<void> {
  if (inDesktopApp) await invoke("set_draw_mode", { drawing });
}

export async function onDrawModeChange(handler: (drawing: boolean) => void): Promise<void> {
  if (inDesktopApp) await listen<boolean>("draw-mode", (event) => handler(event.payload));
}
