import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbLaunch(
  server: McpServer,
  client: WorkbenchClient
): void {
  server.registerTool(
    "wb_launch",
    {
      description:
        "Launch Arma Reforger Workbench (Arma Reforger Tools). Automatically installs handler scripts, starts the Workbench executable, and waits for the NET API to become available. All other wb_* tools call this automatically if Workbench is not running, so you rarely need to call this directly.",
      inputSchema: {
        timeoutSeconds: z
          .number()
          .min(10)
          .max(300)
          .default(60)
          .describe(
            "Maximum seconds to wait for Workbench to start and NET API to respond (default 60)."
          ),
      },
    },
    async () => {
      try {
        const alreadyRunning = await client.ping();
        if (alreadyRunning) {
          return {
            content: [
              {
                type: "text" as const,
                text: "**Workbench Already Running** — NET API is responding. All `wb_*` tools are available.",
              },
            ],
          };
        }

        await client.ensureRunning();

        return {
          content: [
            {
              type: "text" as const,
              text: "**Workbench Ready** — Launched, handler scripts installed, NET API responding. All `wb_*` tools are available.",
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `**Launch Failed**\n\n${msg}`,
            },
          ],
        };
      }
    }
  );
}
