import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { basename, dirname, join, resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import type { Config } from "../config.js";
import type { WorkbenchClient } from "../workbench/client.js";
import { formatConnectionStatus } from "../workbench/status.js";

export function registerWbLaunch(
  server: McpServer,
  config: Config,
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
        // Remember which addon was requested so other tools default to it
        if (gprojPath) {
          config.defaultMod = basename(dirname(resolve(gprojPath)));
        }

        const alreadyRunning = await client.ping();
        if (alreadyRunning) {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Workbench Already Running** — NET API is responding. All \`wb_*\` tools are available.${formatConnectionStatus(client)}`,
              },
            ],
          };
        }

        await client.ensureRunning(gprojPath);

        const modDir = gprojPath ? dirname(resolve(gprojPath)) : null;
        const note = modDir
          ? `\n\nNote: Handler scripts were copied to ${modDir}/Scripts/WorkbenchGame/EnfusionMCP/. ` +
            `Call **wb_cleanup** with the mod directory path when done to remove them before publishing.`
          : "";

        return {
          content: [
            {
              type: "text" as const,
              text: `**Workbench Ready** — Launched, handler scripts installed, NET API responding. All \`wb_*\` tools are available.${note}${formatConnectionStatus(client)}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `**Launch Failed**\n\n${msg}${formatConnectionStatus(client)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Cleanup tool to remove handler scripts after Workbench work is done
  server.registerTool(
    "wb_cleanup",
    {
      description:
        "Remove the temporary EnfusionMCP handler scripts from mod directories. " +
        "Deletes Scripts/WorkbenchGame/EnfusionMCP/ from the mod. " +
        "Call this after finishing Workbench work and before the user publishes their mod. " +
        "Handlers are injected into whichever mod is open at the time, so they accumulate across " +
        "unrelated addons over many sessions — call with NO arguments to list every addon that " +
        "currently has them (safe, read-only), then pass all=true to clear them all, or modDir to " +
        "clear just one. Safe to call even if scripts were never installed.",
      inputSchema: {
        modDir: z
          .string()
          .optional()
          .describe("Path to a single mod's root directory (the folder containing the .gproj file). Omit to list, or use with all=true to clear everything."),
        all: z
          .boolean()
          .optional()
          .describe("Remove handler scripts from EVERY addon that has them. Run with no arguments first to see the list."),
      },
    },
    async ({ modDir, all }) => {
      // No target named: report what is installed rather than guessing. Clearing 20+
      // directories is not something to do implicitly off an empty call.
      if (!modDir && !all) {
        const installed = client.listInstalledHandlerMods();
        if (installed.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `**No handler scripts installed** in any addon under the configured project path. Nothing to clean.${formatConnectionStatus(client)}`,
            }],
          };
        }
        const lines = [
          `**Handler scripts are installed in ${installed.length} addon${installed.length === 1 ? "" : "s"}**`,
          ``,
          `These are injected automatically so Workbench compiles the NET API handlers. They are`,
          `harmless locally, but they ship with the mod if it is published.`,
          ``,
          ...installed.map((m) => `- \`${m.modDir}\` *(${m.fileCount} files)*`),
          ``,
          `Pass \`all: true\` to remove them from all ${installed.length}, or \`modDir\` for a single one.`,
        ];
        return { content: [{ type: "text" as const, text: lines.join("\n") + formatConnectionStatus(client) }] };
      }

      if (all) {
        const installed = client.listInstalledHandlerMods();
        if (installed.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `**Nothing to clean** — no addon under the project path has handler scripts.${formatConnectionStatus(client)}`,
            }],
          };
        }
        const cleaned: string[] = [];
        const failed: string[] = [];
        for (const mod of installed) {
          try {
            if (client.cleanupHandlerScripts(mod.modDir)) cleaned.push(mod.modDir);
          } catch (e) {
            failed.push(`${mod.modDir} — ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        const lines = [`**Cleanup Complete** — handler scripts removed from ${cleaned.length} addon${cleaned.length === 1 ? "" : "s"}.`, ``];
        lines.push(...cleaned.map((c) => `- \`${c}\``));
        if (failed.length > 0) {
          lines.push(``, `**Failed (${failed.length}):**`, ...failed.map((f) => `- ${f}`));
        }
        return {
          content: [{ type: "text" as const, text: lines.join("\n") + formatConnectionStatus(client) }],
          ...(failed.length > 0 ? { isError: true as const } : {}),
        };
      }

      modDir = modDir as string;
      // Resolve to absolute path and validate
      const resolvedModDir = resolve(modDir);
      if (!existsSync(resolvedModDir)) {
        return {
          content: [{
            type: "text" as const,
            text: `**Error:** Directory not found: ${modDir}${formatConnectionStatus(client)}`,
          }],
        isError: true,
        };
      }
      const hasGproj = readdirSync(resolvedModDir).some(f => f.endsWith(".gproj"));
      if (!hasGproj) {
        return {
          content: [{
            type: "text" as const,
            text: `**Error:** "${resolvedModDir}" does not appear to be a mod directory (no .gproj file found). Provide the mod root directory containing the .gproj file.${formatConnectionStatus(client)}`,
          }],
        isError: true,
        };
      }

      const removed = client.cleanupHandlerScripts(resolvedModDir);
      if (removed) {
        return {
          content: [
            {
              type: "text" as const,
              text: `**Cleanup Complete** — EnfusionMCP handler scripts removed from the mod. The mod is ready to publish.${formatConnectionStatus(client)}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `**No Cleanup Needed** — Handler scripts were not present in the mod directory.${formatConnectionStatus(client)}`,
          },
        ],
      };
    }
  );
}
