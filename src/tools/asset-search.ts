import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname, relative } from "node:path";
import type { Config } from "../config.js";
import { logger } from "../utils/logger.js";
import { PakVirtualFS } from "../pak/vfs.js";
import { resolveGameDataPath } from "../utils/game-paths.js";

interface AssetEntry {
  /** Relative path from game data root (e.g., "Prefabs/Weapons/Rifles/AK47/AK47.et") */
  path: string;
  /** File extension without dot */
  ext: string;
  /** Resource GUID from entity catalog, if available (e.g., "657590C1EC9E27D3") */
  guid?: string;
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
let cachedGuidDiag = "";

/**
 * Parse entity catalog .conf files to build a map of normalized prefab path → GUID.
 * Scans loose files under basePath (e.g. addons/data/DataXXX/Configs/EntityCatalog/).
 * Entity catalogs contain lines like:
 *   m_sEntityPrefab "{657590C1EC9E27D3}Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et"
 */
function buildGuidIndex(basePath: string): { guidMap: Map<string, string>; diag: string } {
  const guidMap = new Map<string, string>();
  const GUID_PATTERN = /\{([0-9A-Fa-f]{16})\}([^\s"]+\.et)/g;

  let catalogCount = 0;

  function walkCatalogs(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkCatalogs(fullPath);
      } else if (entry.name.toLowerCase().endsWith(".conf") &&
                 dir.toLowerCase().includes("entitycatalog")) {
        catalogCount++;
        try {
          const content = readFileSync(fullPath, "utf-8");
          let match: RegExpExecArray | null;
          GUID_PATTERN.lastIndex = 0;
          while ((match = GUID_PATTERN.exec(content)) !== null) {
            const guid = match[1].toUpperCase();
            const prefabPath = match[2].replace(/\\/g, "/");
            guidMap.set(prefabPath.toLowerCase(), guid);
          }
        } catch (e) {
          logger.warn(`GUID index: failed to read catalog ${fullPath}: ${e}`);
        }
      }
    }
  }

  walkCatalogs(basePath);

  const diag = `${guidMap.size} GUIDs from ${catalogCount} catalogs (loose files)`;
  logger.info(`GUID index built: ${diag}`);
  return { guidMap, diag };
}

function buildIndex(basePath: string, gamePath: string): AssetEntry[] {
  const start = Date.now();
  const entries: AssetEntry[] = [];
  const seen = new Set<string>();

  // 1. Walk loose (unpacked) files first — they take priority
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
          const relPath = relative(basePath, fullPath).replace(/\\/g, "/");
          entries.push({ path: relPath, ext: ext.slice(1) });
          seen.add(relPath.toLowerCase());
        }
      }
    }
  }

  walk(basePath);

  // 2. Build GUID index from loose entity catalog files
  let guidMap: Map<string, string> | null = null;
  try {
    const { guidMap: gm, diag } = buildGuidIndex(basePath);
    guidMap = gm;
    cachedGuidDiag = diag;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cachedGuidDiag = `GUID INDEX ERROR: ${msg}`;
    logger.warn(`Failed to build GUID index: ${e}`);
  }

  // 3. Add entries from .pak files (skip duplicates already found as loose files)
  try {
    const pakVfs = PakVirtualFS.get(gamePath);
    if (pakVfs) {
      for (const filePath of pakVfs.allFilePaths()) {
        if (seen.has(filePath.toLowerCase())) continue;
        const ext = extname(filePath).toLowerCase();
        if (ASSET_EXTENSIONS.has(ext)) {
          entries.push({ path: filePath, ext: ext.slice(1) });
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to index pak files: ${e}`);
  }

  // 4. Attach GUIDs to prefab entries
  if (guidMap && guidMap.size > 0) {
    for (const entry of entries) {
      if (entry.ext !== "et") continue;
      // VFS paths include the DataXXX prefix, catalog paths don't — try stripping it
      const pathLower = entry.path.toLowerCase();
      if (guidMap.has(pathLower)) {
        entry.guid = guidMap.get(pathLower);
        continue;
      }
      // Strip leading DataXXX/ segment (e.g., "data005/prefabs/..." → "prefabs/...")
      const slashIdx = pathLower.indexOf("/");
      if (slashIdx !== -1) {
        const stripped = pathLower.slice(slashIdx + 1);
        if (guidMap.has(stripped)) {
          entry.guid = guidMap.get(stripped);
        }
      }
    }
  }

  const guidCount = entries.filter((e) => e.guid).length;
  const elapsed = Date.now() - start;
  logger.info(`Asset index built: ${entries.length} files, ${guidCount} with GUIDs, in ${elapsed}ms`);
  return entries;
}

export function invalidateAssetCache(): void {
  cachedIndex = null;
  cachedBasePath = null;
  cachedGuidDiag = "";
}

function getIndex(basePath: string, gamePath: string): AssetEntry[] {
  if (cachedIndex && cachedBasePath === basePath) {
    return cachedIndex;
  }
  cachedIndex = buildIndex(basePath, gamePath);
  cachedBasePath = basePath;
  return cachedIndex;
}

export function registerAssetSearch(server: McpServer, config: Config): void {
  server.registerTool(
    "asset_search",
    {
      description:
        "Search for base game assets (prefabs, models, textures, scripts, configs) by name. " +
        "Searches both unpacked files and .pak archives transparently. " +
        "Returns file paths and GUIDs (for prefabs) that can be used in prefab references. " +
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
        refresh: z
          .boolean()
          .default(false)
          .describe("Force rebuild of the file index (clears cache). Use if results seem stale."),
      },
    },
    async ({ query, type, limit, refresh }) => {
      if (refresh) {
        invalidateAssetCache();
      }
      const basePath = resolveGameDataPath(config.gamePath);
      if (!basePath) {
        return {
          content: [
            {
              type: "text",
              text: `Base game not found at ${config.gamePath}. Set ENFUSION_GAME_PATH or ensure Arma Reforger is installed.`,
            },
          ],
          isError: true,
        };
      }

      try {
        const index = getIndex(basePath, config.gamePath);
        const q = query.toLowerCase();
        const allowedExts = type !== "any" ? TYPE_FILTER[type] : null;

        const results: Array<{ entry: AssetEntry; score: number }> = [];

        for (const entry of index) {
          // Filter by type
          if (allowedExts && !allowedExts.includes(`.${entry.ext}`)) continue;

          // Score by filename match (not full path — filename is most relevant)
          const pathLower = entry.path.toLowerCase();
          const segments = entry.path.split("/");
          const filename = (segments[segments.length - 1] ?? "").toLowerCase();

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

        const guidTotal = index.filter((e) => e.guid).length;
        const lines: string[] = [];
        const diagInfo = `GUIDs:${cachedGuidDiag || `0(empty)`}|basePath:${basePath}|gamePath:${config.gamePath}|indexSize:${index.length}`;
        lines.push(`Found ${results.length} match${results.length !== 1 ? "es" : ""} (showing ${shown.length}) [${diagInfo}]:\n`);

        for (const { entry } of shown) {
          if (entry.guid) {
            // Strip DataXXX/ prefix from display path to match the catalog's relative path
            const slashIdx = entry.path.indexOf("/");
            const displayPath = slashIdx !== -1 ? entry.path.slice(slashIdx + 1) : entry.path;
            lines.push(`  {${entry.guid}}${displayPath}`);
          } else {
            lines.push(`  ${entry.path}`);
          }
        }

        if (results.length > limit) {
          lines.push(`\n  ... and ${results.length - limit} more results`);
        }

        if (cachedGuidDiag && cachedGuidDiag.startsWith("GUID INDEX ERROR")) {
          lines.push("");
          lines.push(`**Warning:** ${cachedGuidDiag}`);
          lines.push("Some results may be missing GUID prefixes. Check file permissions or game installation.");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error searching assets: ${msg}` }],
        isError: true,
        };
      }
    }
  );
}
