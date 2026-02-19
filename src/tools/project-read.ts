import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";

export function registerProjectRead(server: McpServer, config: Config): void {
  server.registerTool(
    "project_read",
    {
      description:
        "Read a file's contents from the Arma Reforger project directory. Use with project_browse to navigate and read mod files (.c scripts, .et prefabs, .gproj projects, etc.).",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Relative path within the project (e.g., 'Scripts/Game/MyScript.c', 'MyMod.gproj')"
          ),
        projectPath: z
          .string()
          .optional()
          .describe("Absolute path to the project directory. Uses configured default if omitted."),
      },
    },
    async ({ path: filePath, projectPath }) => {
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
        const fullPath = validateProjectPath(basePath, filePath);

        if (!existsSync(fullPath)) {
          return {
            content: [{ type: "text", text: `File not found: ${filePath}` }],
          };
        }

        const content = readFileSync(fullPath, "utf-8");
        return {
          content: [{ type: "text", text: content }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error reading file: ${msg}` }],
        };
      }
    }
  );
}
