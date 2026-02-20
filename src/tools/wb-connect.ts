import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbConnect(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_connect",
    {
      description:
        "Test connection to Arma Reforger Workbench. Returns connection status and current editor mode. Use this to verify Workbench is running with the NET API enabled.",
      inputSchema: {},
    },
    async () => {
      try {
        const alive = await client.ping();
        if (!alive) {
          return {
            content: [
              {
                type: "text" as const,
                text: "**Connection Failed**\n\nCould not reach Workbench. Ensure:\n1. Arma Reforger Tools (Workbench) is running\n2. NET API is enabled: File > Options > General > Net API\n3. The EnfusionMCP handler addon is loaded in Workbench",
              },
            ],
          };
        }

        // Get detailed state — Ping returns: status, mode, message
        const details = await client.call<Record<string, unknown>>("EMCP_WB_Ping");

        const lines: string[] = [];
        lines.push("**Workbench Connected**\n");
        lines.push(`- **Status:** Connected`);
        if (details.mode) lines.push(`- **Mode:** ${details.mode}`);
        if (details.message) lines.push(`- **Info:** ${details.message}`);

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `**Connection Failed**\n\n${msg}\n\nEnsure Workbench is running with NET API enabled (File > Options > General > Net API).`,
            },
          ],
        };
      }
    }
  );
}
