import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import type { Config } from "../config.js";
import { logger } from "../utils/logger.js";

interface AssetEntry {
  /** Relative path from game data root (e.g., "Prefabs/Weapons/Rifles/AK47/AK47.et") */
  path: string;
  /** File extension without dot */
  ext: string;
}

const ASSET_EXTENSIONS = new Set([".et", ".xob", ".edds", ".c", ".conf", ".emat", ".layout", ".sounds"]);

const TYPE_FILTER: Record<string, string[]> = {
  prefab: [".et"],
  model: [".xob"],
  texture: [".edds"],
  script: [".c"],
  config: [".conf"],
  material: [".emat"],
  layout: [".layout"],
};

/** Cached file index — built once per session */
let cachedIndex: AssetEntry[] | null = null;
let cachedBasePath: string | null = null;

function buildIndex(basePath: string): AssetEntry[] {
  const start = Date.now();
  const entries: AssetEntry[] = [];

  function walk(dir: string): void {
    let dirEntries;
    try {
      dirEntries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of dirEntries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = extname(entry.name).toLowerCase();
        if (ASSET_EXTENSIONS.has(ext)) {
          entries.push({
            path: relative(basePath, fullPath).replace(/\\/g, "/"),
            ext: ext.slice(1),
          });
        }
      }
    }
  }

  walk(basePath);
  const elapsed = Date.now() - start;
  logger.info(`Asset index built: ${entries.length} files in ${elapsed}ms`);
  return entries;
}

function getIndex(basePath: string): AssetEntry[] {
  if (cachedIndex && cachedBasePath === basePath) {
    return cachedIndex;
  }
  cachedIndex = buildIndex(basePath);
  cachedBasePath = basePath;
  return cachedIndex;
}

function resolveGameDataPath(config: Config): string | null {
  const dataPath = join(config.gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;
  const addonsPath = join(config.gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;
  return null;
}

export function registerAssetSearch(server: McpServer, config: Config): void {
  server.registerTool(
    "asset_search",
    {
      description:
        "Search for base game assets (prefabs, models, textures, scripts, configs) by name. " +
        "Returns file paths that can be used in prefab references. " +
        "The first search may take a few seconds to build the file index.",
      inputSchema: {
        query: z
          .string()
          .describe("Search term to match against file names (e.g., 'AK47', 'BarrelGreen', 'soldier')"),
        type: z
          .enum(["prefab", "model", "texture", "script", "config", "material", "layout", "any"])
          .default("any")
          .describe("Filter by asset type"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum results to return"),
      },
    },
    async ({ query, type, limit }) => {
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
        const index = getIndex(basePath);
        const q = query.toLowerCase();
        const allowedExts = type !== "any" ? TYPE_FILTER[type] : null;

        const results: Array<{ entry: AssetEntry; score: number }> = [];

        for (const entry of index) {
          // Filter by type
          if (allowedExts && !allowedExts.includes(`.${entry.ext}`)) continue;

          // Score by filename match (not full path — filename is most relevant)
          const pathLower = entry.path.toLowerCase();
          const filename = entry.path.split("/").pop()!.toLowerCase();

          let score = 0;
          if (filename === q || filename === `${q}.${entry.ext}`) {
            score = 100; // Exact filename match
          } else if (filename.startsWith(q)) {
            score = 80; // Filename prefix
          } else if (filename.includes(q)) {
            score = 60; // Filename substring
          } else if (pathLower.includes(q)) {
            score = 30; // Path substring
          }

          if (score > 0) {
            results.push({ entry, score });
          }
        }

        results.sort((a, b) => b.score - a.score);
        const shown = results.slice(0, limit);

        if (shown.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No ${type !== "any" ? type + " " : ""}assets found matching "${query}". Index contains ${index.length} files.`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`Found ${results.length} match${results.length !== 1 ? "es" : ""} (showing ${shown.length}):\n`);

        for (const { entry } of shown) {
          lines.push(`  ${entry.path}`);
        }

        if (results.length > limit) {
          lines.push(`\n  ... and ${results.length - limit} more results`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error searching assets: ${msg}` }],
        };
      }
    }
  );
}
