import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../workbench/client.js";
import { formatConnectionStatus } from "../workbench/status.js";

export function registerWbCompile(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_compile",
    {
      description:
        "Compile all scripts in the current Workbench project (equivalent to Ctrl+F7). Returns compilation status. Note: compilation result details (errors/warnings) are not captured — check the Script Editor output window for details.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_Compile", {});
        const isError = result.status !== "ok";
        return {
          content: [{
            type: "text" as const,
            text: `**${isError ? "Compilation Failed" : "Compilation Triggered"}**\n\n${result.message || ""}${formatConnectionStatus(client)}`,
          }],
          isError,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error triggering compile: ${msg}${formatConnectionStatus(client)}` }],
          isError: true,
        };
      }
    }
  );
}
