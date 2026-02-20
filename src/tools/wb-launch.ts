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
        "Launch Arma Reforger Workbench (Arma Reforger Tools). Automatically installs handler scripts, " +
        "injects the EnfusionMCP handler addon as a temporary dependency of the target mod (so NET API " +
        "handlers compile), starts the Workbench executable, and waits for the NET API to become available. " +
        "All other wb_* tools call this automatically if Workbench is not running, so you rarely need to " +
        "call this directly. IMPORTANT: When done working with Workbench, call wb_cleanup to remove the " +
        "temporary EnfusionMCP dependency from the mod's .gproj before the user publishes.",
      inputSchema: {
        timeoutSeconds: z
          .number()
          .min(10)
          .max(300)
          .default(60)
          .describe(
            "Maximum seconds to wait for Workbench to start and NET API to respond (default 60)."
          ),
        gprojPath: z
          .string()
          .optional()
          .describe(
            "Path to a .gproj file to open directly. Skips the Workbench launcher screen and goes straight " +
            "into the World Editor. The EnfusionMCP handler addon is automatically injected as a dependency " +
            "so all wb_* tools work. If omitted, Workbench opens to its launcher."
          ),
      },
    },
    async ({ gprojPath }) => {
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

        await client.ensureRunning(gprojPath);

        const note = gprojPath
          ? `\n\nNote: EnfusionMCP handler dependency was temporarily added to the mod's .gproj. ` +
            `Call **wb_cleanup** with this gprojPath when done to remove it before publishing.`
          : "";

        return {
          content: [
            {
              type: "text" as const,
              text: `**Workbench Ready** — Launched, handler scripts installed, NET API responding. All \`wb_*\` tools are available.${note}`,
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

  // Cleanup tool to remove EnfusionMCP dependency after Workbench work is done
  server.registerTool(
    "wb_cleanup",
    {
      description:
        "Remove the temporary EnfusionMCP handler dependency from a mod's .gproj file. " +
        "Call this after finishing Workbench work and before the user publishes their mod. " +
        "This is safe to call even if the dependency was never injected.",
      inputSchema: {
        gprojPath: z
          .string()
          .describe("Path to the mod's .gproj file to clean up."),
      },
    },
    async ({ gprojPath }) => {
      const removed = client.cleanupHandlerDependency(gprojPath);
      if (removed) {
        return {
          content: [
            {
              type: "text" as const,
              text: "**Cleanup Complete** — EnfusionMCP handler dependency removed from the mod's .gproj. The mod is ready to publish.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "**No Cleanup Needed** — EnfusionMCP dependency was not present in the .gproj.",
          },
        ],
      };
    }
  );
}
