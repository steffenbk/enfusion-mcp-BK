import type { WorkbenchClient } from "./client.js";

/**
 * Build a status footer line showing current Workbench connection state.
 * Appended to all wb_* tool responses so the LLM always knows the mode.
 */
export function formatConnectionStatus(client: WorkbenchClient): string {
  const { connected, mode } = client.state;
  if (!connected) return "\n\n---\n`Workbench: disconnected`";
  if (mode === "play") return "\n\n---\n`Workbench: play mode`";
  if (mode === "edit") return "\n\n---\n`Workbench: edit mode`";
  return "\n\n---\n`Workbench: connected (mode unknown)`";
}

/**
 * Check if the cached state indicates play mode.
 * Returns a warning message if so, or null if the tool can proceed.
 * Also blocks when mode is unknown — the caller should use wb_state to confirm
 * the mode before running mutating operations.
 */
export function requireEditMode(client: WorkbenchClient, toolAction: string): string | null {
  if (client.state.mode === "play") {
    return `Cannot ${toolAction} while in play mode. Call \`wb_stop\` first to return to edit mode.`;
  }
  if (client.state.mode === "unknown") {
    return `Cannot ${toolAction}: Workbench mode is unknown. Call \`wb_state\` first to confirm edit mode.`;
  }
  return null;
}

/**
 * Check if the cached state indicates edit mode.
 * Returns a warning message if so, or null if the tool can proceed.
 * Also blocks when mode is unknown.
 */
export function requirePlayMode(client: WorkbenchClient, toolAction: string): string | null {
  if (client.state.mode === "edit") {
    return `Cannot ${toolAction} while in edit mode. Call \`wb_play\` first to enter play mode.`;
  }
  if (client.state.mode === "unknown") {
    return `Cannot ${toolAction}: Workbench mode is unknown. Call \`wb_state\` first to confirm play mode.`;
  }
  return null;
}
