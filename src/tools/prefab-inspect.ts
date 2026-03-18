import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config.js";
import { PakVirtualFS } from "../pak/vfs.js";
import { resolveGameDataPath, findLooseFile } from "../utils/game-paths.js";
import { logger } from "../utils/logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedComponent {
  guid: string;
  typeName: string;
  rawBody: string;
}

interface AncestorLevel {
  path: string;
  depth: number;
  entityClass: string;
  components: Map<string, ParsedComponent>;
  rawContent: string;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function stripGuid(ref: string): string {
  return ref.replace(/^\{[0-9A-Fa-f]{16}\}/, "");
}

function parseParentPath(content: string): { entityClass: string; parentPath: string | null } {
  // Match: EntityClass : "{HEX16}Path/To/Parent.et" {
  const m = /^(\w+)\s*:\s*"\{[0-9A-Fa-f]{16}\}([^"]+)"\s*\{/m.exec(content);
  if (m) return { entityClass: m[1], parentPath: m[2] };
  // Match without GUID prefix
  const m2 = /^(\w+)\s*:\s*"([^"]+\.et)"\s*\{/m.exec(content);
  if (m2) return { entityClass: m2[1], parentPath: m2[2] };
  // No parent
  const m3 = /^(\w+)\s*\{/m.exec(content);
  return { entityClass: m3 ? m3[1] : "Unknown", parentPath: null };
}

function extractComponentsBlock(content: string): string {
  const m = /^[ \t]*components\s*\{/m.exec(content);
  if (!m || m.index === undefined) return "";
  const openPos = content.indexOf("{", m.index + m[0].length - 1);
  let depth = 1;
  let i = openPos + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }
  return content.slice(openPos + 1, i - 1);
}

function parseComponents(content: string): Map<string, ParsedComponent> {
  const result = new Map<string, ParsedComponent>();
  const block = extractComponentsBlock(content);
  if (!block) return result;

  // Match top-level: TypeName "{HEX16}" { or TypeName "{HEX16}" : "..." {
  const re = /^[ \t]*(\w+)\s+"\{([0-9A-Fa-f]{16})\}"[^{]*\{/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(block)) !== null) {
    const typeName = match[1];
    const guid = match[2];
    const openBrace = block.indexOf("{", match.index + match[0].length - 1);
    let depth = 1;
    let i = openBrace + 1;
    while (i < block.length && depth > 0) {
      if (block[i] === "{") depth++;
      else if (block[i] === "}") depth--;
      i++;
    }
    const rawBody = block.slice(openBrace + 1, i - 1);
    result.set(guid, { guid, typeName, rawBody });
  }

  return result;
}

// ── File reading ─────────────────────────────────────────────────────────────

function readEtFile(path: string, config: Config, projectPath?: string): string | null {
  const bare = stripGuid(path);

  // 1. Mod project — check direct path and all addon subdirs
  const base = projectPath || config.projectPath;
  if (base) {
    const direct = join(base, bare);
    if (existsSync(direct)) {
      try { return readFileSync(direct, "utf-8"); } catch (e) { logger.debug(`Failed to read ${direct}: ${e}`); }
    }
    // Check one level of addon subdirectories
    try {
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = join(base, entry.name, bare);
        if (existsSync(candidate)) {
          try { return readFileSync(candidate, "utf-8"); } catch (e) { logger.debug(`Failed to read ${candidate}: ${e}`); }
        }
      }
    } catch (e) { logger.debug(`Cannot read addon dir ${base}: ${e}`); }
  }

  // 2. Extracted files
  if (config.extractedPath) {
    const found = findLooseFile(config.extractedPath, bare);
    if (found) {
      try { return readFileSync(found, "utf-8"); } catch (e) { logger.debug(`Failed to read extracted ${found}: ${e}`); }
    }
  }

  // 3. Loose game data
  const gameDataPath = resolveGameDataPath(config.gamePath);
  if (gameDataPath) {
    const found = findLooseFile(gameDataPath, bare);
    if (found) {
      try { return readFileSync(found, "utf-8"); } catch (e) { logger.debug(`Failed to read loose ${found}: ${e}`); }
    }
  }

  // 4. Pak VFS
  const pakVfs = PakVirtualFS.get(config.gamePath);
  if (pakVfs && pakVfs.exists(bare)) {
    try { return pakVfs.readTextFile(bare); } catch (e) { logger.debug(`Failed to read pak ${bare}: ${e}`); }
  }

  return null;
}

// ── Chain walker ─────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;

function walkChain(
  startPath: string,
  config: Config,
  projectPath?: string
): { levels: AncestorLevel[]; warnings: string[] } {
  const levels: AncestorLevel[] = [];
  const warnings: string[] = [];
  const visited = new Set<string>();

  function visit(path: string): void {
    const bare = stripGuid(path);
    const key = bare.toLowerCase();
    if (visited.has(key)) {
      warnings.push(`Cycle detected: ${bare}`);
      return;
    }
    if (levels.length >= MAX_DEPTH) {
      warnings.push(`Chain truncated at depth ${MAX_DEPTH}`);
      return;
    }
    visited.add(key);

    const content = readEtFile(bare, config, projectPath);
    if (!content) {
      warnings.push(`Could not read: ${bare}`);
      return;
    }

    const { entityClass, parentPath } = parseParentPath(content);

    // Recurse to parent first so oldest ancestor ends up at index 0
    if (parentPath) visit(parentPath);

    levels.push({
      path: bare,
      depth: -1,
      entityClass,
      components: parseComponents(content),
      rawContent: content,
    });
  }

  visit(startPath);
  levels.forEach((l, i) => { l.depth = i; });

  return { levels, warnings };
}

// ── Output ───────────────────────────────────────────────────────────────────

function formatReport(
  levels: AncestorLevel[],
  warnings: string[],
  includeRaw: boolean
): string {
  const lines: string[] = [];

  lines.push("=== Prefab Inheritance Chain ===");
  for (const level of levels) {
    const tag = level.depth === levels.length - 1 ? "  ← this file" : "";
    lines.push(`  [${level.depth}] ${level.path}  [${level.entityClass}]${tag}`);
  }

  if (warnings.length > 0) {
    lines.push("");
    for (const w of warnings) lines.push(`  WARNING: ${w}`);
  }

  // Merge: deepest child wins per component GUID
  const merged = new Map<string, { comp: ParsedComponent; source: AncestorLevel }>();
  for (const level of levels) {
    for (const [guid, comp] of level.components) {
      merged.set(guid, { comp, source: level });
    }
  }

  lines.push("");
  lines.push("=== Merged Components ===");

  if (merged.size === 0) {
    lines.push("  (no components found in chain)");
  }

  for (const [, { comp, source }] of merged) {
    const isLeaf = source.depth === levels.length - 1;
    const srcTag = isLeaf ? "← this file" : `inherited from [${source.depth}]: ${source.path}`;
    lines.push("");
    lines.push(`[${comp.typeName} {${comp.guid}}]  ${srcTag}`);
    for (const bl of comp.rawBody.split("\n")) {
      if (bl.trim()) lines.push(`  ${bl}`);
    }
  }

  if (includeRaw) {
    lines.push("");
    lines.push("=== Raw File Contents ===");
    for (const level of levels) {
      lines.push(`\n--- [${level.depth}] ${level.path} ---\n${level.rawContent}`);
    }
  }

  return lines.join("\n");
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerPrefabInspect(server: McpServer, config: Config): void {
  server.registerTool(
    "prefab_inspect",
    {
      description:
        "Inspect an Arma Reforger prefab (.et file) and its full inheritance chain. " +
        "Reads each ancestor prefab, parses all components, and returns a fully merged view " +
        "showing which ancestor each component comes from. " +
        "Child values override parent values (matched by component GUID). " +
        "Use this to understand the complete component set of a prefab, including all " +
        "inherited values not visible in the prefab file itself.",
      inputSchema: {
        path: z.string().describe(
          "Relative prefab path, e.g. 'Prefabs/Weapons/Handguns/M9/Handgun_M9.et'. " +
          "A leading {GUID} prefix is accepted and stripped automatically."
        ),
        include_raw: z.boolean().default(false).describe(
          "Include the full raw .et text for each ancestor at the bottom of the report."
        ),
        projectPath: z.string().optional().describe(
          "Mod project root to search first. Uses ENFUSION_PROJECT_PATH if omitted."
        ),
      },
    },
    async ({ path: inputPath, include_raw, projectPath }) => {
      try {
        const { levels, warnings } = walkChain(inputPath, config, projectPath);

        if (levels.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Could not read prefab: ${inputPath}\n` +
                (warnings.length > 0 ? warnings.join("\n") : "File not found."),
            }],
          isError: true,
          };
        }

        return {
          content: [{
            type: "text",
            text: formatReport(levels, warnings, include_raw ?? false),
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
