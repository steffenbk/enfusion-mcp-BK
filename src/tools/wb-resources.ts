import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbResources(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_resources",
    {
      description:
        "Manage Workbench resources. Register new resources, rebuild resource databases, get resource info, or open a resource in its editor.",
      inputSchema: {
        action: z
          .enum(["register", "rebuild", "getInfo", "open"])
          .describe(
            "Action: register (add resource to DB), rebuild (regenerate resource DB), getInfo (resource metadata), open (open in editor)"
          ),
        path: z
          .string()
          .describe("Resource path (e.g., 'Prefabs/Weapons/AK47.et', 'Models/Vehicle.xob')"),
        buildRuntime: z
          .boolean()
          .optional()
          .describe("Build runtime data during register/rebuild (slower but ensures assets are ready)"),
      },
    },
    async ({ action, path, buildRuntime }) => {
      try {
        if (action === "getInfo") {
          // Use built-in GetResourceInfo handler
          const result = await client.call<Record<string, unknown>>("GetResourceInfo", {
            path,
          });

          const lines = [`**Resource Info**\n`];
          lines.push(`- **Path:** ${path}`);
          if (result.guid) lines.push(`- **GUID:** ${result.guid}`);
          if (result.type) lines.push(`- **Type:** ${result.type}`);
          if (result.size !== undefined) lines.push(`- **Size:** ${result.size}`);
          if (result.lastModified) lines.push(`- **Modified:** ${result.lastModified}`);
          if (result.dependencies && Array.isArray(result.dependencies)) {
            lines.push(`\n### Dependencies (${result.dependencies.length})`);
            for (const dep of result.dependencies) {
              lines.push(`- ${dep}`);
            }
          }

          // Fallback for unknown response shapes
          const knownKeys = new Set(["guid", "type", "size", "lastModified", "dependencies", "path"]);
          for (const [key, val] of Object.entries(result)) {
            if (!knownKeys.has(key) && val !== undefined) {
              lines.push(`- **${key}:** ${typeof val === "object" ? JSON.stringify(val) : val}`);
            }
          }

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        // register, rebuild, open all use EMCP_WB_Resources
        const params: Record<string, unknown> = { action, path };
        if (buildRuntime !== undefined) params.buildRuntime = buildRuntime;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Resources", params);

        const actionLabels: Record<string, string> = {
          register: `Registered resource: ${path}`,
          rebuild: `Rebuilt resource database for: ${path}`,
          open: `Opened resource: ${path}`,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `**${actionLabels[action]}**${result.message ? `\n\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error managing resource "${path}" (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
