import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbExecuteAction(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_execute_action",
    {
      description:
        "Execute any Workbench menu action by its menu path. Use comma-separated path segments to identify the action (e.g., 'Tools,Reload Scripts' or 'File,Save').",
      inputSchema: {
        menuPath: z
          .string()
          .describe(
            "Comma-separated menu path (e.g., 'Tools,Reload Scripts', 'File,Save', 'Edit,Undo')"
          ),
      },
    },
    async ({ menuPath }) => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_ExecuteAction", {
          menuPath,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `**Action Executed**\n\nMenu path: ${menuPath}${result.message ? `\n${result.message}` : ""}${result.result ? `\nResult: ${JSON.stringify(result.result)}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing action "${menuPath}": ${msg}`,
            },
          ],
        };
      }
    }
  );
}
