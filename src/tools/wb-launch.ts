import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dirname } from "node:path";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbLaunch(
  server: McpServer,
  client: WorkbenchClient
): void {
  server.registerTool(
    "wb_launch",
    {
      description:
        "Launch Arma Reforger Workbench (Arma Reforger Tools). Automatically copies handler scripts " +
        "into the target mod's Scripts/WorkbenchGame/ directory (so NET API handlers compile as part " +
        "of the mod), starts the Workbench executable, and waits for the NET API to become available. " +
        "All other wb_* tools call this automatically if Workbench is not running, so you rarely need to " +
        "call this directly. IMPORTANT: When done working with Workbench, call wb_cleanup to remove the " +
        "handler scripts from the mod before the user publishes.",
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
            "into the World Editor. Handler scripts are copied into the mod so all wb_* tools work. " +
            "If omitted, Workbench opens to its launcher."
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

        const modDir = gprojPath ? dirname(gprojPath) : null;
        const note = modDir
          ? `\n\nNote: Handler scripts were copied to ${modDir}/Scripts/WorkbenchGame/EnfusionMCP/. ` +
            `Call **wb_cleanup** with the mod directory path when done to remove them before publishing.`
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

  // Cleanup tool to remove handler scripts after Workbench work is done
  server.registerTool(
    "wb_cleanup",
    {
      description:
        "Remove the temporary EnfusionMCP handler scripts from a mod's directory. " +
        "Deletes Scripts/WorkbenchGame/EnfusionMCP/ from the mod. " +
        "Call this after finishing Workbench work and before the user publishes their mod. " +
        "Safe to call even if scripts were never installed.",
      inputSchema: {
        modDir: z
          .string()
          .describe("Path to the mod's root directory (the folder containing the .gproj file)."),
      },
    },
    async ({ modDir }) => {
      const removed = client.cleanupHandlerScripts(modDir);
      if (removed) {
        return {
          content: [
            {
              type: "text" as const,
              text: "**Cleanup Complete** — EnfusionMCP handler scripts removed from the mod. The mod is ready to publish.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: "**No Cleanup Needed** — Handler scripts were not present in the mod directory.",
          },
        ],
      };
    }
  );
}
