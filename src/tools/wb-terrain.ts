import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbTerrain(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_terrain",
    {
      description:
        "Query terrain information. Get the terrain height at a world coordinate or get the world bounds (min/max extents).",
      inputSchema: {
        action: z
          .enum(["getHeight", "getBounds"])
          .describe("Action: getHeight (sample terrain Y at x,z) or getBounds (world extents)"),
        x: z
          .number()
          .optional()
          .describe("World X coordinate (required for getHeight)"),
        z: z
          .number()
          .optional()
          .describe("World Z coordinate (required for getHeight)"),
      },
    },
    async ({ action, x, z: zCoord }) => {
      try {
        if (action === "getHeight" && (x === undefined || zCoord === undefined)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: `x` and `z` coordinates are required for getHeight.",
              },
            ],
          };
        }

        // Send x/z as strings — Enfusion RegV for float ignores JSON integers
        // (no decimal point), so "6400" as a number → 0.0, but "6400" as a string → parsed via ToFloat()
        const params: Record<string, unknown> = { action };
        if (x !== undefined) params.x = String(x);
        if (zCoord !== undefined) params.z = String(zCoord);

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Terrain", params);

        if (action === "getHeight") {
          const height = result.height ?? result.y ?? "unknown";
          return {
            content: [
              {
                type: "text" as const,
                text: `**Terrain Height**\n\n- **Position:** (${x}, ${zCoord})\n- **Height (Y):** ${height}`,
              },
            ],
          };
        }

        // getBounds
        const lines = ["**World Bounds**\n"];
        if (result.minX !== undefined) lines.push(`- **Min X:** ${result.minX}`);
        if (result.minZ !== undefined) lines.push(`- **Min Z:** ${result.minZ}`);
        if (result.maxX !== undefined) lines.push(`- **Max X:** ${result.maxX}`);
        if (result.maxZ !== undefined) lines.push(`- **Max Z:** ${result.maxZ}`);
        if (result.sizeX !== undefined) lines.push(`- **Size X:** ${result.sizeX}`);
        if (result.sizeZ !== undefined) lines.push(`- **Size Z:** ${result.sizeZ}`);
        if (result.gridSize !== undefined) lines.push(`- **Grid Size:** ${result.gridSize}`);

        // Fallback if the response has different keys
        if (lines.length === 1) {
          lines.push(JSON.stringify(result, null, 2));
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error querying terrain: ${msg}` }],
        };
      }
    }
  );
}
