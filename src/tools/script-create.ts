import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generateScript,
  getScriptModuleFolder,
  getScriptFilename,
  type ScriptType,
} from "../templates/script.js";
import { validateFilename, validateEnforceIdentifier } from "../utils/safe-path.js";

export function registerScriptCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "script_create",
    {
      description:
        "Create a new Enforce Script (.c) file for an Arma Reforger mod. Generates a properly structured script from a template with correct class hierarchy and method stubs.",
      inputSchema: {
        className: z
          .string()
          .min(1)
          .describe(
            "Full class name including prefix (e.g., 'TAG_MyComponent', 'MCM_GameMode')"
          ),
        scriptType: z
          .enum(["modded", "component", "gamemode", "action", "entity", "manager", "basic"])
          .describe(
            "Script template type. 'modded' overrides an existing class. 'component' creates a ScriptComponent. 'gamemode' creates a game mode. 'action' creates an interactive UserAction. 'entity' creates a standalone entity. 'manager' creates a singleton class. 'basic' creates a plain class."
          ),
        parentClass: z
          .string()
          .optional()
          .describe(
            "Parent class to extend. Required for 'modded'. Uses sensible defaults for other types (e.g., ScriptComponent for 'component')."
          ),
        methods: z
          .array(z.string())
          .optional()
          .describe(
            "Method signatures to stub out (e.g., ['void OnGameStart()', 'bool CanPerform(IEntity user)']). Uses default methods per type if omitted."
          ),
        description: z
          .string()
          .optional()
          .describe("Description comment at the top of the file"),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ className, scriptType, parentClass, methods, description, projectPath }) => {
      const basePath = projectPath || config.projectPath;

      try {
        validateFilename(className);
        validateEnforceIdentifier(className);

        const code = generateScript({
          className,
          scriptType: scriptType as ScriptType,
          parentClass,
          methods,
          description,
        });

        // If a project path is available, write the file
        if (basePath) {
          const moduleFolder = getScriptModuleFolder(scriptType as ScriptType);
          const filename = getScriptFilename(className);
          const targetDir = resolve(basePath, moduleFolder);
          const targetPath = join(targetDir, filename);

          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File already exists: ${moduleFolder}/${filename}\n\nGenerated code (not written):\n\n\`\`\`c\n${code}\`\`\``,
                },
              ],
            };
          }

          writeFileSync(targetPath, code, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: `Script created: ${moduleFolder}/${filename}\n\n\`\`\`c\n${code}\`\`\``,
              },
            ],
          };
        }

        // No project path — just return the generated code
        return {
          content: [
            {
              type: "text",
              text: `Generated script (no project path configured — not written to disk):\n\n\`\`\`c\n${code}\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error creating script: ${msg}` }],
        };
      }
    }
  );
}
