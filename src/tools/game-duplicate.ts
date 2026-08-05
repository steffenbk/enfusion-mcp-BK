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
import {
  walkChain,
  mergeAncestryComponents,
  parseTopLevelComponents,
} from "../utils/prefab-ancestry.js";

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
        "Reads the file from game data or .pak archives, resolves the full ancestor chain, and injects " +
        "inherited components so the duplicate is a complete representation of what the entity provides. " +
        "Writes the file to your mod's directory, then registers it with Workbench so it gets a new resource GUID. " +
        "Mirrors the Workbench right-click → Duplicate workflow. " +
        "Set flatten=true to bake all ancestor components into a standalone prefab with no parent reference. " +
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
        flatten: z
          .boolean()
          .default(false)
          .describe(
            "When false (default), keeps the parent reference and includes ancestor components as overridable " +
            "entries with original GUIDs preserved. " +
            "When true, strips the parent reference and bakes all ancestor components into the copy, producing " +
            "a fully standalone prefab."
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
    async ({ sourcePath, destPath, modName, flatten, register }) => {
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
            isError: true,
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
          isError: true,
        };
      }

      // Resolve destination addon directory
      const addonDir = resolveAddonDir(config.projectPath, modName ?? config.defaultMod);
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
          isError: true,
        };
      }

      // Validate and resolve the destination path
      let absDestPath: string;
      try {
        absDestPath = validateProjectPath(addonDir, destPath.replace(/\\/g, "/"));
      } catch {
        return {
          content: [{ type: "text", text: `Invalid destination path: ${destPath}` }],
          isError: true,
        };
      }

      if (existsSync(absDestPath)) {
        return {
          content: [{ type: "text", text: `Destination already exists: ${absDestPath}` }],
          isError: true,
        };
      }

      // Read source content
      let rawContent: string;
      try {
        rawContent = readFileSync(sourceFile, "utf-8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to read source file: ${msg}` }],
          isError: true,
        };
      }

      // Resolve ancestry and inject inherited components
      let ancestryNote = "";
      let finalContent = rawContent;

      // Only apply ancestry for .et prefab files, not .conf
      if (bareSourcePath.endsWith(".et")) {
        const { levels, warnings } = walkChain(bareSourcePath, config);

        if (levels.length > 1) {
          try {
            // Get merged components from full ancestry
            const merged = mergeAncestryComponents(levels);

            // Top-level component GUIDs per ancestor level (excludes nested sub-components)
            const topLevelByDepth = new Map<number, Set<string>>();
            for (const level of levels) {
              const topMap = parseTopLevelComponents(level.rawContent);
              topLevelByDepth.set(level.depth, new Set(topMap.keys()));
            }

            // Existing top-level GUIDs in the leaf file
            const existingGuids = new Set(parseTopLevelComponents(rawContent).keys());

            // Build list of components to inject (as raw text fragments)
            const injected: string[] = [];
            const fragments: string[] = [];

            for (const [guid, { comp, source }] of merged) {
              if (existingGuids.has(guid)) continue; // already declared in leaf
              if (source.depth === levels.length - 1) continue; // it's in the leaf itself

              // Only inject top-level components — skip nested sub-components
              if (!topLevelByDepth.get(source.depth)?.has(guid)) continue;

              // Build raw text fragment preserving original content exactly
              fragments.push(`  ${comp.typeName} "{${comp.guid}}" {${comp.rawBody}  }`);
              injected.push(`${comp.typeName} (from [${source.depth}] ${source.path})`);
            }

            if (fragments.length > 0) {
              // Insert fragments into the components block using string manipulation
              // (avoids lossy parse/serialize round-trip)
              const componentsMatch = /^([ \t]*components\s*\{)/m.exec(finalContent);
              if (componentsMatch) {
                // Insert after "components {" opening
                const insertPos = componentsMatch.index + componentsMatch[0].length;
                finalContent =
                  finalContent.slice(0, insertPos) +
                  "\n" + fragments.join("\n") +
                  finalContent.slice(insertPos);
              } else {
                // No components block — insert one before the final closing brace
                const lastBrace = finalContent.lastIndexOf("}");
                finalContent =
                  finalContent.slice(0, lastBrace) +
                  " components {\n" + fragments.join("\n") + "\n }\n" +
                  finalContent.slice(lastBrace);
              }
            }

            // If flatten, strip parent reference from the raw text
            if (flatten) {
              finalContent = finalContent.replace(
                /^(\w+)\s*:\s*"[^"]*"\s*\{/m,
                "$1 {"
              );
            }

            const levelCount = levels.length;
            ancestryNote = `\n\nAncestry: resolved ${levelCount} level(s), injected ${injected.length} inherited component(s).`;
            if (injected.length > 0) {
              ancestryNote += `\nInjected: ${injected.join(", ")}`;
            }
            if (flatten) {
              ancestryNote += `\nParent reference stripped (flatten=true).`;
            }
            if (warnings.length > 0) {
              ancestryNote += `\nWarnings: ${warnings.join("; ")}`;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
              content: [{ type: "text", text: `Failed to process ancestry: ${msg}` }],
              isError: true,
            };
          }
        }
      }

      // Replace the ID field (entity GUID) with a fresh one so the duplicate is independent
      const newEntityId = generateGuid();
      finalContent = finalContent.replace(/^(\s*ID\s+")[0-9A-Fa-f]{16}(")/m, `$1${newEntityId}$2`);

      try {
        mkdirSync(dirname(absDestPath), { recursive: true });
        writeFileSync(absDestPath, finalContent, "utf-8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Failed to write file: ${msg}` }],
          isError: true,
        };
      }

      // Register with Workbench to assign a new GUID (if requested)
      if (register) {
        try {
          // The copy has already succeeded by this point — registration is a bonus
          // step, so its failure is reported as a warning rather than failing the
          // whole duplicate. Handled explicitly below, hence tolerateErrorStatus.
          const regResp = await client.call<{ status: string; message?: string }>(
            "EMCP_WB_Resources",
            { action: "register", path: absDestPath, buildRuntime: false },
            { timeout: 30000, tolerateErrorStatus: true }
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
                ].join("\n") + ancestryNote,
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
                ].join("\n") + ancestryNote,
              },
            ],
            isError: true,
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
            ].join("\n") + ancestryNote,
          },
        ],
      };
    }
  );
}
