import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import type { Config } from "../config.js";
import type { WorkbenchClient } from "../workbench/client.js";

/**
 * wb_entity_duplicate — duplicate a scene entity into the mod folder.
 *
 * Workflow:
 *   1. Ask Workbench for the entity's ancestor prefab path (e.g. "{GUID}Prefabs/Vehicles/...")
 *   2. Find that file in the game's loose files and copy it to destPath in the mod
 *   3. RegisterResourceFile → Workbench assigns a new GUID via .meta
 *   4. Optionally delete the original and place the new copy
 */
export function registerWbEntityDuplicate(
  server: McpServer,
  config: Config,
  client: WorkbenchClient
): void {
  server.registerTool(
    "wb_entity_duplicate",
    {
      description:
        "Duplicate a scene entity (including locked base-game prefab instances) into your mod folder, " +
        "assigning it a new resource GUID. Mirrors the TC_BatchCreatePrefabsPlugin workflow: " +
        "saves the entity as a standalone .et prefab, registers it with Workbench, then replaces " +
        "the original scene entity with the new duplicate. " +
        "Use this after placing a base-game prefab in the scene to make it editable.",
      inputSchema: {
        entityName: z
          .string()
          .describe("Name of the entity already placed in the scene (e.g. 'MyM998_01')"),
        destPath: z
          .string()
          .describe(
            "Destination path within your mod folder, relative to the addon root " +
            "(e.g. 'Prefabs/Vehicles/MyCustomM998.et'). Must end in .et"
          ),
        modName: z
          .string()
          .optional()
          .describe(
            "Addon folder name under ENFUSION_PROJECT_PATH (e.g. 'MyMod'). " +
            "If omitted, the first addon found in the project path is used."
          ),
        replaceInScene: z
          .boolean()
          .default(true)
          .describe(
            "If true (default), delete the original entity and place the new duplicate. " +
            "If false, only save the prefab file without touching the scene."
          ),
      },
    },
    async ({ entityName, destPath, modName, replaceInScene }) => {
      // Resolve addon directory
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

      // Check destination doesn't already exist
      const absDestPath = join(addonDir, destPath.replace(/\\/g, "/").replace(/^\//, ""));
      if (existsSync(absDestPath)) {
        return {
          content: [{ type: "text", text: `Destination already exists: ${absDestPath}` }],
        };
      }

      // Step 1: Get the ancestor prefab path from Workbench
      const ancestorResp = await client.call<{ status: string; message?: string; ancestorPath?: string }>(
        "EMCP_WB_Prefabs",
        { action: "getAncestor", entityName }
      );

      if (ancestorResp.status !== "ok" || !ancestorResp.ancestorPath) {
        return {
          content: [
            {
              type: "text",
              text: `Could not get ancestor prefab for '${entityName}': ${ancestorResp.message ?? JSON.stringify(ancestorResp)}`,
            },
          ],
        };
      }

      // ancestorPath is like "{GUID}Prefabs/Vehicles/Wheeled/BTR70/BTR70.et"
      const bareAncestorPath = ancestorResp.ancestorPath.replace(/^\{[0-9A-Fa-f]{16}\}/, "");

      // Step 2: Find and copy the source file from game's loose files
      const gameDataPath = resolveGameDataPath(config.gamePath);
      if (!gameDataPath) {
        return {
          content: [{ type: "text", text: `Base game not found at ${config.gamePath}.` }],
        };
      }

      const sourceFile = findLooseFile(gameDataPath, bareAncestorPath);
      if (!sourceFile) {
        return {
          content: [
            {
              type: "text",
              text: `Source file not found in game data: ${bareAncestorPath}\nSearched under: ${gameDataPath}`,
            },
          ],
        };
      }

      try {
        const content = readFileSync(sourceFile, "utf-8");
        mkdirSync(dirname(absDestPath), { recursive: true });
        writeFileSync(absDestPath, content, "utf-8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to copy file: ${msg}` }],
        };
      }

      // Step 3: Register the file with Workbench → assigns new GUID via .meta
      if (!existsSync(absDestPath + ".meta")) {
        const regResp = await client.call<{ status: string; message?: string }>(
          "EMCP_WB_Resources",
          { action: "register", path: absDestPath, buildRuntime: false },
          { timeout: 30000 }
        );

        if (regResp.status !== "ok") {
          return {
            content: [
              {
                type: "text",
                text: `Prefab saved but registration failed: ${regResp.message ?? JSON.stringify(regResp)}\n` +
                  `File at: ${absDestPath}\nRegister manually in Workbench Resource Browser.`,
              },
            ],
          };
        }
      }

      // Step 4: Read the new GUID from the .meta file
      const newGuid = readMetaGuid(absDestPath + ".meta");
      const prefabRef = newGuid ? `{${newGuid}}${destPath}` : destPath;

      if (!replaceInScene) {
        return {
          content: [
            {
              type: "text",
              text: [
                `**Prefab saved successfully**`,
                `- Entity: ${entityName}`,
                `- Source: ${ancestorResp.ancestorPath}`,
                `- Saved to: ${absDestPath}`,
                `- GUID: ${newGuid ?? "(read .meta manually)"}`,
                `- Reference: ${prefabRef}`,
              ].join("\n"),
            },
          ],
        };
      }

      // Step 5: Get the entity's current position before deleting
      let position = "0 0 0";
      try {
        const posResp = await client.call<{ status: string; value?: string }>(
          "EMCP_WB_ModifyEntity",
          { action: "getProperty", name: entityName, propertyKey: "coords" }
        );
        if (posResp.status === "ok" && posResp.value) {
          position = posResp.value;
        }
      } catch {
        // Non-fatal — place at origin if position can't be read
      }

      // Step 6: Delete the original entity
      try {
        await client.call("EMCP_WB_DeleteEntity", { name: entityName });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text",
              text: [
                `**Prefab saved but original entity could not be deleted**`,
                `- Saved to: ${absDestPath}`,
                `- GUID: ${newGuid ?? "(read .meta manually)"}`,
                `- Delete error: ${msg}`,
                `- Place manually using: ${prefabRef}`,
              ].join("\n"),
            },
          ],
        };
      }

      // Step 7: Place the new duplicate
      const newName = entityName + "_copy";
      try {
        await client.call("EMCP_WB_CreateEntity", {
          prefab: prefabRef,
          name: newName,
          position,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text",
              text: [
                `**Prefab saved, original deleted, but placement failed**`,
                `- Saved to: ${absDestPath}`,
                `- GUID: ${newGuid ?? "(read .meta manually)"}`,
                `- Place error: ${msg}`,
                `- Place manually using: ${prefabRef}`,
              ].join("\n"),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `**Entity duplicated successfully**`,
              `- Original: ${entityName} (${ancestorResp.ancestorPath}) → deleted`,
              `- Copied from: ${sourceFile}`,
              `- New prefab: ${absDestPath}`,
              `- GUID: ${newGuid ?? "(read .meta manually)"}`,
              `- Placed as: ${newName} at ${position}`,
              `- Reference: ${prefabRef}`,
              ``,
              `The entity is now editable — it references your mod's prefab, not the base game original.`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}

/** Find the game data directory (loose files location). */
function resolveGameDataPath(gamePath: string): string | null {
  const dataPath = join(gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;
  const addonsPath = join(gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;
  return null;
}

/** Find a loose file in the game data directory. Handles DataXXX prefix and bare paths. */
function findLooseFile(gameDataPath: string, relativePath: string): string | null {
  const direct = join(gameDataPath, relativePath);
  if (existsSync(direct)) return direct;

  if (!relativePath.startsWith("Data")) {
    try {
      const entries = readdirSync(gameDataPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("Data")) continue;
        const candidate = join(gameDataPath, entry.name, relativePath);
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/** Read the GUID from a Workbench .meta file. Returns null if not found. */
function readMetaGuid(metaPath: string): string | null {
  try {
    const content = readFileSync(metaPath, "utf-8");
    const match = content.match(/Name\s+"(?:\{([0-9A-Fa-f]{16})\})[^"]+"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Find the addon directory: by modName (folder name) or first addon with a .gproj. */
function resolveAddonDir(projectPath: string, modName?: string): string | null {
  if (modName) {
    const dir = resolve(projectPath, modName);
    return existsSync(dir) ? dir : null;
  }
  try {
    const entries = readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(projectPath, entry.name);
      if (findGproj(dir)) return dir;
    }
  } catch {
    // ignore
  }
  return null;
}

function findGproj(dir: string): string | null {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() && e.name.endsWith(".gproj")) return join(dir, e.name);
    }
  } catch {
    // ignore
  }
  return null;
}
