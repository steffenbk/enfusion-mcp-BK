import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbLayers(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_layers",
    {
      description:
        "Manage layers in the World Editor. List layers, create/delete layers, rename, set active layer, toggle visibility, or lock/unlock layers.",
      inputSchema: {
        action: z
          .enum([
            "list",
            "create",
            "delete",
            "rename",
            "setActive",
            "setVisibility",
            "lock",
            "unlock",
          ])
          .describe("Layer management action to perform"),
        subScene: z
          .number()
          .default(0)
          .describe("SubScene index (default 0, the main scene)"),
        layerPath: z
          .string()
          .optional()
          .describe("Layer path (e.g., 'default/MyLayer'). Required for most actions except list and create."),
        name: z
          .string()
          .optional()
          .describe("Layer name for create or new name for rename"),
        parentPath: z
          .string()
          .optional()
          .describe("Parent layer path for create (e.g., 'default')"),
        visible: z
          .boolean()
          .optional()
          .describe("Visibility state for setVisibility (true = visible, false = hidden)"),
      },
    },
    async ({ action, subScene, layerPath, name, parentPath, visible }) => {
      try {
        const params: Record<string, unknown> = { action, subScene };
        if (layerPath) params.layerPath = layerPath;
        if (name) params.name = name;
        if (parentPath) params.parentPath = parentPath;
        if (visible !== undefined) params.visible = visible;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Layers", params);

        if (action === "list") {
          const layers = Array.isArray(result.layers) ? result.layers : [];
          if (layers.length === 0) {
            return {
              content: [{ type: "text" as const, text: "**No layers found.**" }],
            };
          }

          const lines = [`**Layers** (SubScene ${subScene})\n`];
          for (const layer of layers) {
            const l = layer as Record<string, unknown>;
            const path = l.path || l.name || "(unnamed)";
            const flags: string[] = [];
            if (l.active) flags.push("ACTIVE");
            if (l.locked) flags.push("LOCKED");
            if (l.visible === false) flags.push("HIDDEN");
            const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
            const entityCount = l.entityCount !== undefined ? ` (${l.entityCount} entities)` : "";
            lines.push(`- ${path}${flagStr}${entityCount}`);
          }

          if (result.activeLayer) {
            lines.push(`\nActive layer: **${result.activeLayer}**`);
          }

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        const actionLabels: Record<string, string> = {
          create: `Created layer "${name || "(unnamed)"}"${parentPath ? ` under ${parentPath}` : ""}`,
          delete: `Deleted layer "${layerPath}"`,
          rename: `Renamed layer "${layerPath}" to "${name}"`,
          setActive: `Set active layer to "${layerPath}"`,
          setVisibility: `Set "${layerPath}" visibility to ${visible ? "visible" : "hidden"}`,
          lock: `Locked layer "${layerPath}"`,
          unlock: `Unlocked layer "${layerPath}"`,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `**Layer Updated**\n\n${actionLabels[action] || action}${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            { type: "text" as const, text: `Error managing layers (${action}): ${msg}` },
          ],
        };
      }
    }
  );
}
