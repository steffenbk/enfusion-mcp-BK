import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { relative } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";
import { listDirectory, formatSize } from "../utils/dir-listing.js";

export function registerProjectBrowse(server: McpServer, config: Config): void {
  server.registerTool(
    "project_browse",
    {
      description:
        "List files in an Arma Reforger Workbench project directory. Shows file types (.c=script, .et=prefab, .gproj=project, etc.) and sizes.",
      inputSchema: {
        path: z
          .string()
          .default("")
          .describe(
            "Subdirectory to list within the project (e.g., 'Scripts/Game', 'Prefabs'). Omit for project root."
          ),
        pattern: z
          .string()
          .optional()
          .describe("File extension filter (e.g., '*.c', '*.et')"),
        projectPath: z
          .string()
          .optional()
          .describe(
            "Absolute path to the project directory. Uses configured default if omitted."
          ),
      },
    },
    async ({ path: subPath, pattern, projectPath }) => {
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
        const targetPath = subPath
          ? validateProjectPath(basePath, subPath)
          : basePath;

        const entries = listDirectory(targetPath, pattern);
        const relPath = relative(basePath, targetPath) || ".";

        const lines: string[] = [];
        lines.push(`Project: ${basePath}`);
        lines.push(`Path: ${relPath === "." ? "(root)" : relPath}`);
        lines.push("");

        let fileCount = 0;
        let dirCount = 0;

        for (const entry of entries) {
          if (entry.isDirectory) {
            lines.push(`  ${entry.name}/`);
            dirCount++;
          } else {
            const typeTag = entry.type ? `[${entry.type}]` : "";
            const sizeStr = formatSize(entry.size);
            lines.push(
              `  ${entry.name.padEnd(40)} ${typeTag.padEnd(12)} ${sizeStr}`
            );
            fileCount++;
          }
        }

        lines.push("");
        lines.push(`Total: ${fileCount} files, ${dirCount} directories`);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error browsing project: ${msg}` }],
        };
      }
    }
  );
}
