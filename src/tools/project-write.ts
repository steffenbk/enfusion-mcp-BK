import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";

export function registerProjectWrite(server: McpServer, config: Config): void {
  server.registerTool(
    "project_write",
    {
      description:
        "Write or update a file in the Arma Reforger project directory. Use with project_read to implement read-modify-write workflows for .c scripts, .et prefabs, .gproj files, etc.",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Relative path within the project (e.g., 'Scripts/Game/MyScript.c')"
          ),
        content: z.string().describe("File content to write"),
        createDirectories: z
          .boolean()
          .default(true)
          .describe(
            "Create parent directories if they don't exist. Default: true."
          ),
        projectPath: z
          .string()
          .optional()
          .describe(
            "Absolute path to the project directory. Uses configured default if omitted."
          ),
      },
    },
    async ({ path: filePath, content, createDirectories, projectPath }) => {
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

        if (createDirectories) {
          mkdirSync(dirname(fullPath), { recursive: true });
        }

        writeFileSync(fullPath, content, "utf-8");
        const sizeBytes = Buffer.byteLength(content, "utf-8");

        return {
          content: [
            {
              type: "text",
              text: `File written: ${filePath} (${sizeBytes} bytes)`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error writing file: ${msg}` }],
        };
      }
    }
  );
}
