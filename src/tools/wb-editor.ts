import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbEditorTools(server: McpServer, client: WorkbenchClient): void {
  // wb_play — Switch to game mode (Play in Editor)
  server.registerTool(
    "wb_play",
    {
      description:
        "Switch Workbench to game (play) mode. Compiles scripts and launches the world for testing. Equivalent to pressing Play in the World Editor.",
      inputSchema: {
        debugMode: z
          .boolean()
          .optional()
          .describe("Enable debug mode (script breakpoints, extra logging)"),
        fullScreen: z
          .boolean()
          .optional()
          .describe("Launch in full-screen mode instead of windowed"),
      },
    },
    async ({ debugMode, fullScreen }) => {
      try {
        const params: Record<string, unknown> = { action: "play" };
        if (debugMode !== undefined) params.debugMode = debugMode;
        if (fullScreen !== undefined) params.fullScreen = fullScreen;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", params);

        return {
          content: [
            {
              type: "text" as const,
              text: `**Play Mode Started**\n\nWorkbench is now compiling and entering game mode.${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error starting play mode: ${msg}` }],
        };
      }
    }
  );

  // wb_stop — Switch to edit mode
  server.registerTool(
    "wb_stop",
    {
      description:
        "Stop game mode and return to the World Editor. Equivalent to pressing Stop in the World Editor.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", {
          action: "stop",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `**Edit Mode Restored**\n\nWorkbench has returned to edit mode.${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error stopping play mode: ${msg}` }],
        };
      }
    }
  );

  // wb_save — Save the current world
  server.registerTool(
    "wb_save",
    {
      description:
        "Save the current world in the World Editor. Optionally save to a new path (Save As).",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("File path for Save As. Omit to save to the current file."),
      },
    },
    async ({ path }) => {
      try {
        const params: Record<string, unknown> = {
          action: path ? "saveAs" : "save",
        };
        if (path) params.path = path;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", params);

        const label = path ? `Saved as: ${path}` : "World saved.";
        return {
          content: [
            {
              type: "text" as const,
              text: `**Save Complete**\n\n${label}${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error saving: ${msg}` }],
        };
      }
    }
  );

  // wb_undo_redo — Undo or redo
  server.registerTool(
    "wb_undo_redo",
    {
      description: "Undo or redo the last action in the World Editor.",
      inputSchema: {
        action: z
          .enum(["undo", "redo"])
          .describe("Whether to undo or redo"),
      },
    },
    async ({ action }) => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", {
          action,
        });

        const label = action === "undo" ? "Undo" : "Redo";
        return {
          content: [
            {
              type: "text" as const,
              text: `**${label} Complete**${result.message ? `\n\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error performing ${action}: ${msg}` }],
        };
      }
    }
  );

  // wb_open_resource — Open a resource in Workbench
  server.registerTool(
    "wb_open_resource",
    {
      description:
        "Open a resource file in the appropriate Workbench editor (e.g., a .et prefab in the Prefab Editor, a .c script in the Script Editor).",
      inputSchema: {
        path: z
          .string()
          .describe("Resource path to open (e.g., 'Prefabs/Weapons/AK47.et', 'Scripts/Game/MyScript.c')"),
      },
    },
    async ({ path }) => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", {
          action: "openResource",
          path,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `**Resource Opened**\n\nOpened: ${path}${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error opening resource: ${msg}` }],
        };
      }
    }
  );
}
