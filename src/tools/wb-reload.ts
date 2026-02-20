import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbReload(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_reload",
    {
      description:
        "Reload scripts or plugins in the Workbench. Use after editing .c script files or Workbench plugins to pick up changes without restarting.",
      inputSchema: {
        target: z
          .enum(["scripts", "plugins", "both"])
          .default("scripts")
          .describe("What to reload: scripts, plugins, or both"),
      },
    },
    async ({ target }) => {
      try {
        const results: string[] = [];

        if (target === "scripts" || target === "both") {
          await client.call("ReloadScripts");
          results.push("Scripts reloaded successfully.");
        }

        if (target === "plugins" || target === "both") {
          await client.call("ReloadPlugins");
          results.push("Plugins reloaded successfully.");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `**Reload Complete**\n\n${results.join("\n")}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error reloading: ${msg}` }],
        };
      }
    }
  );
}
