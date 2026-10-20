import type { ToolState } from "./core/types";

const STORAGE_KEY = "draw-on-screen:tool";

export const DEFAULT_TOOL_STATE: ToolState = { tool: "pen", color: "#ff3b30", size: 6 };

/** Last tool, color and thickness, remembered between launches. Storage may be unavailable. */
export function loadToolState(): ToolState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_TOOL_STATE, ...(JSON.parse(raw) as Partial<ToolState>) };
  } catch {
    // Fall back to defaults.
  }
  return { ...DEFAULT_TOOL_STATE };
}

export function saveToolState(state: ToolState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not fatal: the choice just won't survive a restart.
  }
}
