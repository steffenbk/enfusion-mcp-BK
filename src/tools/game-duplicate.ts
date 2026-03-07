import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Config } from "../config.js";
import type { WorkbenchClient } from "../workbench/client.js";
import { validateProjectPath } from "../utils/safe-path.js";
import { resolveGameDataPath, findLooseFile, resolveAddonDir } from "../utils/game-paths.js";
import { generateGuid } from "../formats/guid.js";

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
            "(e.g., 'Prefabs/Groups/MyCustomGroup.et'). Must end in .et"
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
      // Strip GUID prefix from sourcePath if present: {GUID}path → path
      const bareSourcePath = sourcePath.replace(/^\{[0-9A-Fa-f]{16}\}/, "");

      // Locate the source file — extracted library first, then pak loose files
      let sourceFile: string | null = null;
      let sourceLabel = "";

      if (config.extractedPath && existsSync(config.extractedPath)) {
        sourceFile = findLooseFile(config.extractedPath, bareSourcePath);
        if (sourceFile) sourceLabel = "(extracted library)";
      }

      if (!sourceFile) {
        const gameDataPath = resolveGameDataPath(config.gamePath);
        if (!gameDataPath) {
          return {
            content: [{ type: "text", text: `Base game not found at ${config.gamePath}.` }],
          };
        }
        sourceFile = findLooseFile(gameDataPath, bareSourcePath);
        if (sourceFile) sourceLabel = "(pak loose files)";
      }

      if (!sourceFile) {
        return {
          content: [
            {
              type: "text",
              text: `Source file not found: ${bareSourcePath}\n` +
                (config.extractedPath ? `Searched extracted library: ${config.extractedPath}\n` : "") +
                `Searched pak loose files under: ${config.gamePath}\n` +
                `Use asset_search to verify the path exists.`,
            },
          ],
        };
      }

      // Resolve destination addon directory
      const addonDir = resolveAddonDir(config.projectPath, modName);
      if (!addonDir) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find addon directory. ` +
                (modName
                  ? `'${modName}' not found under ${config.projectPath}`
                  : `No addons found under ${config.projectPath}`) +
                `. Provide modName matching the addon folder name.`,
            },
          ],
        };
      }

      // Validate and resolve the destination path
      let absDestPath: string;
      try {
        absDestPath = validateProjectPath(addonDir, destPath);
      } catch {
        return {
          content: [{ type: "text", text: `Invalid destination path: ${destPath}` }],
        };
      }

      if (existsSync(absDestPath)) {
        return {
          content: [{ type: "text", text: `Destination already exists: ${absDestPath}` }],
        };
      }

      // Copy the source file to the destination, replacing the entity ID with a new GUID
      try {
        let content = readFileSync(sourceFile, "utf-8");
        // Replace the ID field (entity GUID) with a fresh one so the duplicate is independent
        const newEntityId = generateGuid();
        content = content.replace(/^(\s*ID\s+")[0-9A-Fa-f]{16}(")/m, `$1${newEntityId}$2`);
        mkdirSync(dirname(absDestPath), { recursive: true });
        writeFileSync(absDestPath, content, "utf-8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to copy file: ${msg}` }],
        };
      }

      // Register with Workbench to assign a new GUID (if requested)
      if (register) {
        try {
          const regResp = await client.call<{ status: string; message?: string }>(
            "EMCP_WB_Resources",
            { action: "register", path: absDestPath, buildRuntime: false }
          );

          const guidNote = regResp.status === "ok"
            ? `Registered with Workbench — a new GUID has been assigned.`
            : `Warning: registration returned: ${regResp.message ?? JSON.stringify(regResp)}`;

          return {
            content: [
              {
                type: "text",
                text: [
                  `**Prefab duplicated successfully**`,
                  `- Source: ${sourcePath}`,
                  `- Copied from: ${sourceFile} ${sourceLabel}`,
                  `- Saved to: ${absDestPath}`,
                  ``,
                  guidNote,
                  `Use wb_resources getInfo or wb_prefabs getGuid to look up the new GUID.`,
                  ``,
                  `**Next steps:**`,
                  `1. Edit the .et file to customize it.`,
                  `2. Reference it as {GUID}${destPath} in your prefabs.`,
                ].join("\n"),
              },
            ],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [
              {
                type: "text",
                text: [
                  `**File copied but Workbench registration failed**`,
                  `- Saved to: ${absDestPath}`,
                  `- Registration error: ${msg}`,
                  ``,
                  `To assign a GUID manually: in Workbench Resource Browser, right-click the file and register it.`,
                ].join("\n"),
              },
            ],
          };
        }
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `**Prefab copied (not registered)**`,
              `- Source: ${sourcePath}`,
              `- Saved to: ${absDestPath}`,
              ``,
              `To assign a GUID: call again with register=true, or register manually in Workbench.`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}

