import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, statSync, existsSync } from "node:fs";
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
  ".emat": "material",
  ".sounds": "sound",
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

function listDirectory(dirPath: string, pattern?: string): DirEntry[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const results: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      results.push({ name: entry.name, isDirectory: true, size: 0, type: "" });
    } else {
      if (pattern) {
        const ext = extname(entry.name).toLowerCase();
        const patternExt = pattern.startsWith("*") ? pattern.slice(1) : pattern;
        if (ext !== patternExt.toLowerCase()) continue;
      }

      const fullPath = join(dirPath, entry.name);
      let size = 0;
      try {
        size = statSync(fullPath).size;
      } catch { /* skip */ }

      results.push({
        name: entry.name,
        isDirectory: false,
        size,
        type: getFileType(entry.name),
      });
    }
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

function resolveGameDataPath(config: Config): string | null {
  // Try gamePath/addons/data first (standard Steam install)
  const dataPath = join(config.gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;

  // Try gamePath/addons directly
  const addonsPath = join(config.gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;

  return null;
}

export function registerGameBrowse(server: McpServer, config: Config): void {
  server.registerTool(
    "game_browse",
    {
      description:
        "Browse unpacked base game data files (scripts, prefabs, configs). " +
        "NOTE: Most game assets are packed in .pak files and will NOT appear here — use asset_search to find assets by name instead. " +
        "This tool only shows loose (unpacked) files. Do NOT try to use filesystem tools on the game install directory.",
      inputSchema: {
        path: z
          .string()
          .default("")
          .describe(
            "Subdirectory to list (e.g., 'Prefabs/Weapons', 'Scripts/Game/Character'). Omit for root."
          ),
        pattern: z
          .string()
          .optional()
          .describe("File extension filter (e.g., '*.et', '*.xob', '*.c')"),
      },
    },
    async ({ path: subPath, pattern }) => {
      const basePath = resolveGameDataPath(config);
      if (!basePath) {
        return {
          content: [
            {
              type: "text",
              text: `Base game not found at ${config.gamePath}. Set ENFUSION_GAME_PATH or ensure Arma Reforger is installed.`,
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
        lines.push(`Game: ${config.gamePath}`);
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
          content: [{ type: "text", text: `Error browsing game files: ${msg}` }],
        };
      }
    }
  );
}
