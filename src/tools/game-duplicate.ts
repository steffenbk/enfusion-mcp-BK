import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import type { Config } from "../config.js";
import type { WorkbenchClient } from "../workbench/client.js";
import { PakVirtualFS } from "../pak/vfs.js";

/** Text-based prefab/config extensions that can be duplicated. */
const TEXT_EXTENSIONS = new Set([".et", ".conf", ".c", ".layout"]);

function resolveGameDataPath(config: Config): string | null {
  const dataPath = join(config.gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;
  const addonsPath = join(config.gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;
  return null;
}

/**
 * Attempt to read a file from loose game data or pak archives.
 * sourcePath may be a full GUID-reference like "{GUID}Prefabs/Foo.et" or a bare relative path.
 */
function readGameFile(
  sourcePath: string,
  basePath: string,
  config: Config
): { content: string; resolvedPath: string } {
  // Strip leading {GUID} if present
  const bare = sourcePath.replace(/^\{[0-9A-Fa-f]{16}\}/, "");

  // Try loose file first
  const looseFullPath = join(basePath, bare);
  if (existsSync(looseFullPath)) {
    const content = readFileSync(looseFullPath, "utf-8");
    return { content, resolvedPath: bare };
  }

  // Try pak VFS — path may start with DataXXX/ or not
  const pakVfs = PakVirtualFS.get(config.gamePath);
  if (pakVfs) {
    if (pakVfs.exists(bare)) {
      return { content: pakVfs.readTextFile(bare), resolvedPath: bare };
    }
    // Some paths in search results include a DataXXX/ prefix that the pak VFS doesn't need
    // Try without it (already bare) — but also try finding via allFilePaths by suffix
    const bareLower = bare.toLowerCase().replace(/\\/g, "/");
    for (const vfsPath of pakVfs.allFilePaths()) {
      if (vfsPath.toLowerCase().endsWith(bareLower)) {
        return { content: pakVfs.readTextFile(vfsPath), resolvedPath: vfsPath };
      }
    }
  }

  throw new Error(`Source file not found in game data or pak archives: ${bare}`);
}

export function registerGameDuplicate(
  server: McpServer,
  config: Config,
  client: WorkbenchClient
): void {
  server.registerTool(
    "game_duplicate",
    {
      description:
        "Duplicate a base game prefab (.et) or config (.conf) into your mod folder for editing. " +
        "Reads the file from game data or .pak archives, writes it to your mod's directory, " +
        "then registers it with Workbench so it gets a new resource GUID. " +
        "Mirrors the Workbench right-click → Duplicate workflow. " +
        "Use asset_search to find the source path (with GUID) first.",
      inputSchema: {
        sourcePath: z
          .string()
          .describe(
            "Source prefab path — either a GUID reference like '{657590C1EC9E27D3}Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et' " +
            "or a bare relative path like 'Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et'"
          ),
        destPath: z
          .string()
          .describe(
            "Destination path within your mod folder, relative to the addon root " +
            "(e.g., 'Prefabs/Groups/MyCustomGroup.et'). Must end in the same extension as the source."
          ),
        modName: z
          .string()
          .optional()
          .describe(
            "Addon folder name under ENFUSION_PROJECT_PATH (e.g., 'MyMod'). " +
            "If omitted, the first addon found in the project path is used."
          ),
        register: z
          .boolean()
          .default(true)
          .describe(
            "Register the duplicated file with Workbench after writing (assigns a new GUID). " +
            "Requires Workbench to be running. Set false to write the file without registering."
          ),
      },
    },
    async ({ sourcePath, destPath, modName, register }) => {
      const basePath = resolveGameDataPath(config);
      if (!basePath) {
        return {
          content: [
            {
              type: "text",
              text: `Base game not found at ${config.gamePath}. Set ENFUSION_GAME_PATH or ensure Arma Reforger is installed.`,
            },
          ],
        };
      }

      // Validate destination extension matches source
      const srcExt = extname(sourcePath.replace(/^\{[0-9A-Fa-f]{16}\}/, "")).toLowerCase();
      const dstExt = extname(destPath).toLowerCase();
      if (srcExt !== dstExt) {
        return {
          content: [
            {
              type: "text",
              text: `Extension mismatch: source is "${srcExt}", destination is "${dstExt}". They must match.`,
            },
          ],
        };
      }

      if (!TEXT_EXTENSIONS.has(srcExt)) {
        return {
          content: [
            {
              type: "text",
              text: `Unsupported file type "${srcExt}". Only ${[...TEXT_EXTENSIONS].join(", ")} files can be duplicated.`,
            },
          ],
        };
      }

      // Resolve mod root
      let modRoot: string;
      if (modName) {
        modRoot = join(config.projectPath, modName);
      } else {
        // Pick first directory in project path
        const { readdirSync, statSync } = await import("node:fs");
        const entries = readdirSync(config.projectPath, { withFileTypes: true });
        const first = entries.find((e) => e.isDirectory());
        if (!first) {
          return {
            content: [
              {
                type: "text",
                text: `No addon directories found in ${config.projectPath}. Specify modName explicitly.`,
              },
            ],
          };
        }
        modRoot = join(config.projectPath, first.name);
        modName = first.name;
      }

      if (!existsSync(modRoot)) {
        return {
          content: [
            {
              type: "text",
              text: `Mod directory not found: ${modRoot}`,
            },
          ],
        };
      }

      // Block path traversal in destPath
      if (destPath.includes("..")) {
        return {
          content: [
            { type: "text", text: "Path traversal not allowed in destPath." },
          ],
        };
      }

      const absDestPath = join(modRoot, destPath.replace(/\\/g, "/"));
      // Safety: must stay within modRoot
      if (!absDestPath.startsWith(modRoot)) {
        return {
          content: [
            { type: "text", text: "destPath resolves outside the mod root directory." },
          ],
        };
      }

      // Read source
      let fileContent: string;
      let resolvedSource: string;
      try {
        const result = readGameFile(sourcePath, basePath, config);
        fileContent = result.content;
        resolvedSource = result.resolvedPath;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to read source: ${msg}` }],
        };
      }

      // Write to destination
      try {
        mkdirSync(dirname(absDestPath), { recursive: true });
        writeFileSync(absDestPath, fileContent, "utf-8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to write destination file: ${msg}` }],
        };
      }

      const destRelative = destPath.replace(/\\/g, "/");
      const lines: string[] = [];
      lines.push(`**Duplicated prefab to mod folder**`);
      lines.push(`- Source: ${resolvedSource}`);
      lines.push(`- Destination: ${modName}/${destRelative}`);
      lines.push(`- Absolute path: ${absDestPath}`);

      // Register with Workbench if requested
      if (register) {
        try {
          // wb_resources uses a path relative to Workbench's virtual FS, which maps addon names.
          // Pass the relative path within the mod (without DataXXX prefix).
          await client.call<Record<string, unknown>>("EMCP_WB_Resources", {
            action: "register",
            path: destRelative,
            buildRuntime: false,
          });
          lines.push(`- Registered with Workbench: yes`);
          lines.push(`\nThe file has been registered. Use wb_resources getInfo with the path to retrieve its new GUID,`);
          lines.push(`or use asset_search on your mod to find it.`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          lines.push(`- Registered with Workbench: FAILED (${msg})`);
          lines.push(`\nWorkbench registration failed — file was written but has no GUID yet.`);
          lines.push(`Open Workbench manually and use Resource Browser → right-click → Register to assign a GUID,`);
          lines.push(`or ensure Workbench is running and try again.`);
        }
      } else {
        lines.push(`- Registered with Workbench: skipped (register=false)`);
        lines.push(`\nFile written. Open Workbench and register it manually to assign a GUID.`);
      }

      lines.push(`\n**Next steps:**`);
      lines.push(`1. Edit ${basename(absDestPath)} to customize it.`);
      lines.push(`2. Use wb_resources getInfo path="${destRelative}" to get the assigned GUID.`);
      lines.push(`3. Reference it as {GUID}${destRelative} in your prefabs.`);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
