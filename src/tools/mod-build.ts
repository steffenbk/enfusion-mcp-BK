import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import type { Config } from "../config.js";

const WORKBENCH_DIAG_EXE = "ArmaReforgerWorkbenchSteamDiag.exe";
const BUILD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function findWorkbenchExe(workbenchPath: string): string | null {
  // The Diag exe is in the root of the tools directory
  const exePath = join(workbenchPath, WORKBENCH_DIAG_EXE);
  if (existsSync(exePath)) return exePath;

  // Also check one level up (in case workbenchPath points to a subdirectory)
  const parentPath = resolve(workbenchPath, "..", WORKBENCH_DIAG_EXE);
  if (existsSync(parentPath)) return parentPath;

  return null;
}

function runBuild(
  exePath: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(exePath, args, {
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\nProcess error: ${err.message}`,
        timedOut: false,
      });
    });
  });
}

export function registerModBuild(server: McpServer, config: Config): void {
  server.registerTool(
    "mod_build",
    {
      description:
        "Build an Arma Reforger addon using the Workbench CLI. Compiles scripts, processes resources, and produces build output. Requires Arma Reforger Tools (Diag version) installed.",
      inputSchema: {
        addonName: z
          .string()
          .min(1)
          .describe("Name of the addon to build (must match the .gproj ID)"),
        platform: z
          .enum(["PC", "PC_WB", "HEADLESS"])
          .default("PC")
          .describe("Target platform for the build"),
        outputPath: z
          .string()
          .optional()
          .describe(
            "Build output directory. Auto-generated if omitted."
          ),
        gprojPath: z
          .string()
          .optional()
          .describe("Path to .gproj file. Auto-detected if omitted."),
        filterPath: z
          .string()
          .optional()
          .describe(
            "Limit build to a single folder or file for faster iteration"
          ),
      },
    },
    async ({ addonName, platform, outputPath, gprojPath, filterPath }) => {
      // Find Workbench executable
      const exePath = findWorkbenchExe(config.workbenchPath);
      if (!exePath) {
        return {
          content: [
            {
              type: "text",
              text: `Workbench not found at: ${config.workbenchPath}\n\n${WORKBENCH_DIAG_EXE} is required for building.\n\nInstall Arma Reforger Tools from Steam, or set ENFUSION_WORKBENCH_PATH to the correct path.\n\nNote: You need the Diag version (opt into "Profiling Build" beta in Steam).`,
            },
          ],
        };
      }

      // Build output path
      const buildOutput =
        outputPath ||
        resolve(config.workbenchPath, "addons", addonName, "output");

      // Construct CLI arguments
      const args: string[] = [
        "-wbModule=ResourceManager",
        `-buildData`,
        platform,
        buildOutput,
        addonName,
      ];

      if (gprojPath) {
        args.push(`-gproj`, gprojPath);
      }

      if (filterPath) {
        args.push(`-filterPath`, filterPath);
      }

      try {
        const startTime = Date.now();
        const result = await runBuild(exePath, args, BUILD_TIMEOUT_MS);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        const lines: string[] = [];
        lines.push(`## Build Result: ${addonName}`);
        lines.push("");

        if (result.timedOut) {
          lines.push(`**Status:** TIMEOUT (exceeded ${BUILD_TIMEOUT_MS / 1000}s limit)`);
          lines.push("The build process was killed. Try building a smaller scope with filterPath.");
        } else if (result.exitCode === 0) {
          lines.push("**Status:** SUCCESS");
          lines.push(`**Build time:** ${elapsed}s`);
          lines.push(`**Output:** ${buildOutput}`);
        } else {
          lines.push(`**Status:** FAILED (exit code ${result.exitCode})`);
          lines.push(`**Build time:** ${elapsed}s`);
        }

        lines.push("");
        lines.push(`**Command:** ${WORKBENCH_DIAG_EXE} ${args.join(" ")}`);

        if (result.stdout.trim()) {
          lines.push("");
          lines.push("### Output");
          lines.push("```");
          // Limit output to last 100 lines
          const stdoutLines = result.stdout.trim().split("\n");
          const shown = stdoutLines.slice(-100);
          if (stdoutLines.length > 100) {
            lines.push(`... (${stdoutLines.length - 100} lines omitted)`);
          }
          lines.push(shown.join("\n"));
          lines.push("```");
        }

        if (result.stderr.trim()) {
          lines.push("");
          lines.push("### Errors");
          lines.push("```");
          const stderrLines = result.stderr.trim().split("\n");
          const shown = stderrLines.slice(-50);
          if (stderrLines.length > 50) {
            lines.push(`... (${stderrLines.length - 50} lines omitted)`);
          }
          lines.push(shown.join("\n"));
          lines.push("```");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error running build: ${msg}` }],
        };
      }
    }
  );
}
