import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generatePrefab,
  getPrefabSubdirectory,
  getPrefabFilename,
  type PrefabType,
  type ComponentDef,
} from "../templates/prefab.js";
import { walkChain, mergeAncestryComponents } from "../utils/prefab-ancestry.js";
import { validateFilename } from "../utils/safe-path.js";

export function registerPrefabCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "prefab_create",
    {
      description:
        "Create a new Entity Template (.et) prefab file for an Arma Reforger mod. Generates a properly structured prefab with components in valid Enfusion text serialization format. " +
        "When parentPrefab is provided, automatically resolves the full ancestor chain and pre-populates inherited components (set includeAncestry=false to skip). " +
        "IMPORTANT: For 'interactive' and other visible prefabs, the MeshObject component MUST have its 'Object' property set to a base game .xob model path (e.g., '{5F4C4181F065B447}Assets/Props/Military/Barrels/BarrelGreen_01.xob') or the entity will be invisible in-game. Use api_search to find model paths.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe("Prefab name (e.g., 'MySpawnPoint', 'CustomVehicle')"),
        prefabType: z
          .enum([
            "character",
            "vehicle",
            "weapon",
            "spawnpoint",
            "gamemode",
            "interactive",
            "generic",
          ])
          .describe(
            "Prefab template type. Determines the root entity type, default components, and file location."
          ),
        parentPrefab: z
          .string()
          .optional()
          .describe(
            "Parent prefab to inherit from (e.g., '{GUID}Prefabs/Weapons/AK47.et'). Omit to create a standalone prefab."
          ),
        components: z
          .array(
            z.object({
              type: z.string().describe("Component class name (e.g., 'RigidBody', 'MeshObject')"),
              properties: z
                .record(z.string())
                .optional()
                .describe("Component property key-value pairs"),
            })
          )
          .optional()
          .describe("Additional components to add beyond the defaults for this prefab type"),
        description: z
          .string()
          .optional()
          .describe(
            "Description for the prefab. Used as the display name in Game Master."
          ),
        includeAncestry: z
          .boolean()
          .default(true)
          .describe(
            "When parentPrefab is provided, resolve the full ancestor chain and pre-populate inherited components. " +
            "Defaults to true. Set false to skip ancestry resolution (uses hardcoded template defaults instead)."
          ),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ name, prefabType, parentPrefab, components, description, includeAncestry, projectPath }) => {
      const basePath = projectPath || config.projectPath;

      try {
        validateFilename(name);

        // Resolve ancestry if parentPrefab is given and includeAncestry is not disabled
        let ancestorComponents: ComponentDef[] | undefined;
        let ancestryNote = "";

        if (parentPrefab && includeAncestry !== false) {
          const { levels, warnings } = walkChain(parentPrefab, config, projectPath);
          if (levels.length > 0) {
            const merged = mergeAncestryComponents(levels);
            ancestorComponents = Array.from(merged.values()).map(({ comp }) => ({
              type: comp.typeName,
              guid: comp.guid,
              properties: {},
            }));
            ancestryNote = `\n\nAncestry resolved: ${levels.length} ancestor level(s), ${ancestorComponents.length} inherited component(s) pre-populated.`;
            if (warnings.length > 0) {
              ancestryNote += `\nWarnings: ${warnings.join("; ")}`;
            }
          } else {
            ancestryNote = `\n\nAncestry resolution unavailable (game files not found). Using template defaults.`;
            if (warnings.length > 0) {
              ancestryNote += ` Warnings: ${warnings.join("; ")}`;
            }
          }
        }

        const content = generatePrefab({
          name,
          prefabType: prefabType as PrefabType,
          parentPrefab,
          components: components as ComponentDef[] | undefined,
          description,
          ancestorComponents,
        });

        if (basePath) {
          const subdir = getPrefabSubdirectory(prefabType as PrefabType);
          const filename = getPrefabFilename(name);
          const targetDir = resolve(basePath, subdir);
          const targetPath = join(targetDir, filename);

          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File already exists: ${subdir}/${filename}\n\nGenerated content (not written):\n\n\`\`\`\n${content}\n\`\`\``,
                },
              ],
            };
          }

          writeFileSync(targetPath, content, "utf-8");

          const meshWarning = (prefabType === "interactive" || prefabType === "generic")
            ? "\n\nIMPORTANT: The MeshObject 'Object' property is empty. You MUST set it to a base game .xob model path (e.g., '{5F4C4181F065B447}Assets/Props/Military/Barrels/BarrelGreen_01.xob') or the entity will be INVISIBLE in-game. Use project_write to update the prefab."
            : "";

          return {
            content: [
              {
                type: "text",
                text: `Prefab created: ${subdir}/${filename}\n\n\`\`\`\n${content}\n\`\`\`${meshWarning}${ancestryNote}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Generated prefab (no project path configured — not written to disk):\n\n\`\`\`\n${content}\n\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.${ancestryNote}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error creating prefab: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
