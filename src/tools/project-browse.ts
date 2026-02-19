import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, statSync } from "node:fs";
import { relative, join, extname } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";

const FILE_TYPE_MAP: Record<string, string> = {
  ".c": "script",
  ".et": "prefab",
  ".ct": "component",
  ".gproj": "project",
  ".conf": "config",
  ".meta": "meta",
  ".ent": "world",
  ".layer": "layer",
  ".st": "strings",
  ".edds": "texture",
  ".xob": "model",
  ".layout": "ui-layout",
};

function getFileType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return FILE_TYPE_MAP[ext] || "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DirEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  type: string;
}

function listDirectory(
  dirPath: string,
  pattern?: string
): DirEntry[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const results: DirEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files and common noise
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        isDirectory: true,
        size: 0,
        type: "",
      });
    } else {
      // Apply glob pattern filter if provided
      if (pattern) {
        const ext = extname(entry.name).toLowerCase();
        const patternExt = pattern.startsWith("*") ? pattern.slice(1) : pattern;
        if (ext !== patternExt.toLowerCase()) continue;
      }

      const fullPath = join(dirPath, entry.name);
      let size = 0;
      try {
        size = statSync(fullPath).size;
      } catch {
        // Skip files we can't stat
      }

      results.push({
        name: entry.name,
        isDirectory: false,
        size,
        type: getFileType(entry.name),
      });
    }
  }

  // Directories first, then files, alphabetical within each group
  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

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
