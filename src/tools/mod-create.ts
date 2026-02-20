import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import { generateGproj } from "../templates/gproj.js";
import { generateScript } from "../templates/script.js";
import type { PatternLibrary } from "../patterns/loader.js";
import { validateFilename } from "../utils/safe-path.js";

/**
 * Derive a 2-4 character prefix from the mod name.
 * "MyCustomMod" → "MCM", "ZombieDefense" → "ZD"
 */
function derivePrefix(name: string): string {
  // Extract uppercase letters
  const uppers = name.replace(/[^A-Z]/g, "");
  if (uppers.length >= 2 && uppers.length <= 4) return uppers;
  if (uppers.length > 4) return uppers.slice(0, 3);

  // Fallback: first 3 chars uppercased
  return name.slice(0, 3).toUpperCase();
}

export function registerModCreate(
  server: McpServer,
  config: Config,
  patterns: PatternLibrary
): void {
  server.registerTool(
    "mod_create",
    {
      description:
        "Scaffold a new Arma Reforger addon (mod). Creates the project directory, .gproj file, and standard folder structure. Optionally applies a mod pattern for pre-built templates.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(64)
          .describe("Addon name (e.g., 'MyCustomMod'). Used as the project folder name."),
        description: z
          .string()
          .describe("Brief description of what the mod does"),
        prefix: z
          .string()
          .min(1)
          .max(4)
          .optional()
          .describe(
            "Class name prefix (e.g., 'MCM'). Auto-derived from name if omitted."
          ),
        pattern: z
          .string()
          .optional()
          .describe(
            "Mod pattern to apply (e.g., 'custom-faction', 'game-mode'). Use without this to get a bare scaffold."
          ),
        projectPath: z
          .string()
          .optional()
          .describe("Parent directory where the addon folder will be created. Uses configured default if omitted."),
      },
    },
    async ({ name, description, prefix, pattern: patternName, projectPath }) => {
      const basePath = projectPath || config.projectPath;

      if (!basePath) {
        return {
          content: [
            {
              type: "text",
              text: "No project path configured. Set ENFUSION_PROJECT_PATH environment variable or provide projectPath parameter.",
            },
          ],
        };
      }

      try {
        validateFilename(name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Invalid addon name: ${msg}` }],
        };
      }

      // Validate pattern before creating any directories
      if (patternName) {
        const patternDef = patterns.get(patternName);
        if (!patternDef) {
          const available = patterns.list().join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Unknown pattern: "${patternName}"\nAvailable patterns: ${available}`,
              },
            ],
          };
        }
      }

      const addonDir = resolve(basePath, name);
      const classPrefix = prefix ?? derivePrefix(name);

      if (existsSync(addonDir)) {
        return {
          content: [
            {
              type: "text",
              text: `Directory already exists: ${addonDir}\nUse a different name or delete the existing directory.`,
            },
          ],
        };
      }

      try {
        const createdFiles: string[] = [];

        // Create directory structure
        const dirs = [
          addonDir,
          join(addonDir, "Scripts", "Game"),
          join(addonDir, "Prefabs"),
          join(addonDir, "PrefabsEditable"),
          join(addonDir, "Configs"),
          join(addonDir, "Language"),
          join(addonDir, "Missions"),
          join(addonDir, "UI"),
          join(addonDir, "Worlds"),
        ];
        for (const dir of dirs) {
          mkdirSync(dir, { recursive: true });
        }

        // Generate and write .gproj
        const gprojContent = generateGproj({
          name,
          title: name,
        });
        const gprojPath = join(addonDir, `${name}.gproj`);
        writeFileSync(gprojPath, gprojContent, "utf-8");
        createdFiles.push(`${name}.gproj`);

        // Apply pattern if specified (already validated above)
        if (patternName) {
          const patternDef = patterns.get(patternName)!;

          // Generate scripts from pattern
          for (const scriptDef of patternDef.scripts) {
            const className = scriptDef.className.replace(/\{PREFIX\}/g, classPrefix);
            const code = generateScript({
              className,
              scriptType: scriptDef.scriptType as any,
              parentClass: scriptDef.parentClass || undefined,
              methods: scriptDef.methods.length > 0 ? scriptDef.methods : undefined,
              description: scriptDef.description,
            });
            const scriptPath = join(addonDir, "Scripts", "Game", `${className}.c`);
            writeFileSync(scriptPath, code, "utf-8");
            createdFiles.push(`Scripts/Game/${className}.c`);
          }

          // Create prefab subdirectories from pattern
          for (const prefabDef of patternDef.prefabs) {
            const prefabName = prefabDef.name.replace(/\{PREFIX\}/g, classPrefix);
            // Ensure directory exists (prefabs go in type-specific subdirs)
            const prefabDir = join(addonDir, "Prefabs");
            mkdirSync(prefabDir, { recursive: true });
            // Note: prefab file generation is done via prefab_create tool for full control
            createdFiles.push(`(Use prefab_create for: ${prefabName})`);
          }

          // Apply pattern configs
          for (const configDef of patternDef.configs) {
            const configName = configDef.name.replace(/\{PREFIX\}/g, classPrefix);
            const configContent = configDef.content.replace(/\{PREFIX\}/g, classPrefix);
            const targetPath = join(addonDir, "Configs", `${configName}.conf`);
            mkdirSync(resolve(targetPath, ".."), { recursive: true });
            writeFileSync(targetPath, configContent, "utf-8");
            createdFiles.push(`Configs/${configName}.conf`);
          }
        }

        // Build response
        const lines: string[] = [];
        lines.push(`## Addon Created: ${name}`);
        lines.push(`Path: ${addonDir}`);
        lines.push(`Class prefix: ${classPrefix}`);
        lines.push("");
        lines.push("### Created Files");
        for (const f of createdFiles) {
          lines.push(`- ${f}`);
        }
        lines.push("");
        lines.push("### Directory Structure");
        lines.push(`${name}/`);
        lines.push(`  ${name}.gproj`);
        lines.push("  Scripts/");
        lines.push("    Game/");
        if (createdFiles.some((f) => f.startsWith("Scripts/"))) {
          for (const f of createdFiles) {
            if (f.startsWith("Scripts/Game/")) {
              lines.push(`      ${f.replace("Scripts/Game/", "")}`);
            }
          }
        }
        lines.push("  Prefabs/");
        lines.push("  PrefabsEditable/");
        lines.push("  Configs/");
        if (createdFiles.some((f) => f.startsWith("Configs/"))) {
          for (const f of createdFiles) {
            if (f.startsWith("Configs/")) {
              lines.push(`    ${f.replace("Configs/", "")}`);
            }
          }
        }
        lines.push("  Language/");
        lines.push("  Missions/");
        lines.push("  UI/");
        lines.push("  Worlds/");
        lines.push("");
        lines.push("Addon scaffold is ready. Proceeding with file generation and Workbench integration automatically.");

        if (patternName) {
          const patternDef = patterns.get(patternName);
          if (patternDef?.instructions) {
            lines.push("");
            lines.push("### Pattern Instructions");
            lines.push(patternDef.instructions);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error creating addon: ${msg}` }],
        };
      }
    }
  );
}
