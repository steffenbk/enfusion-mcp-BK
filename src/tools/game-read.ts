import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";

/** Extensions that are safe to read as text */
const TEXT_EXTENSIONS = new Set([
  ".c", ".et", ".conf", ".gproj", ".ent", ".layer", ".st",
  ".layout", ".txt", ".json", ".xml", ".csv",
]);

function resolveGameDataPath(config: Config): string | null {
  const dataPath = join(config.gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;
  const addonsPath = join(config.gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;
  return null;
}

export function registerGameRead(server: McpServer, config: Config): void {
  server.registerTool(
    "game_read",
    {
      description:
        "Read an unpacked file from the base game data. " +
        "Use this to read vanilla .c script files to understand what to override, " +
        "or inspect prefab .et files and config .conf files. " +
        "NOTE: Only works on unpacked (loose) files. Most assets are in .pak archives — use asset_search to find them by name.",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Relative path within the game data (e.g., 'Scripts/Game/Character/SCR_CharacterControllerComponent.c')"
          ),
      },
    },
    async ({ path: subPath }) => {
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
        const filePath = validateProjectPath(basePath, subPath);

        if (!existsSync(filePath)) {
          return {
            content: [
              { type: "text", text: `File not found: ${subPath}` },
            ],
          };
        }

        const stats = statSync(filePath);
        if (stats.isDirectory()) {
          return {
            content: [
              {
                type: "text",
                text: `"${subPath}" is a directory. Use game_browse to list its contents.`,
              },
            ],
          };
        }

        const ext = extname(filePath).toLowerCase();
        if (!TEXT_EXTENSIONS.has(ext)) {
          return {
            content: [
              {
                type: "text",
                text: `Binary file: ${subPath} (${ext}, ${stats.size} bytes). Only text files (.c, .et, .conf, etc.) can be read.`,
              },
            ],
          };
        }

        // Cap file size at 500KB to avoid overwhelming context
        if (stats.size > 512_000) {
          return {
            content: [
              {
                type: "text",
                text: `File too large: ${subPath} (${(stats.size / 1024).toFixed(0)} KB). Maximum readable size is 500 KB.`,
              },
            ],
          };
        }

        const content = readFileSync(filePath, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `// ${subPath}\n// ${stats.size} bytes\n\n${content}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error reading game file: ${msg}` }],
        };
      }
    }
  );
}
