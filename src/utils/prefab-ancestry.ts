// src/utils/prefab-ancestry.ts
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config.js";
import { PakVirtualFS } from "../pak/vfs.js";
import { resolveGameDataPath, findLooseFile } from "./game-paths.js";
import { logger } from "./logger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedComponent {
  guid: string;
  typeName: string;
  rawBody: string;
}

export interface AncestorLevel {
  path: string;
  depth: number;
  entityClass: string;
  components: Map<string, ParsedComponent>;
  rawContent: string;
}

export interface MergedComponent {
  comp: ParsedComponent;
  source: AncestorLevel;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function stripGuid(ref: string): string {
  return ref.replace(/^\{[0-9A-Fa-f]{16}\}/, "");
}

export function parseParentPath(content: string): { entityClass: string; parentPath: string | null } {
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

export function parseComponents(content: string): Map<string, ParsedComponent> {
  const result = new Map<string, ParsedComponent>();
  const block = extractComponentsBlock(content);
  if (!block) return result;

  const re = /^[ \t]*(\w+)\s+"\{([0-9A-Fa-f]{16})\}"(?:[^{"\\]|"[^"]*")*\{/gm;
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

export function readEtFile(path: string, config: Config, projectPath?: string): string | null {
  const bare = stripGuid(path);

  // 1. Mod project — check direct path and all addon subdirs
  const base = projectPath || config.projectPath;
  if (base) {
    const direct = join(base, bare);
    if (existsSync(direct)) {
      try { return readFileSync(direct, "utf-8"); } catch (e) { logger.debug(`Failed to read ${direct}: ${e}`); }
    }
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

// ── Chain walker ──────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;

export function walkChain(
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

/**
 * Like parseComponents but only returns DIRECT children of the components block
 * (depth-0 entries). Skips nested sub-components such as SightsComponent inside
 * WeaponComponent or UserActionContext inside ActionsManagerComponent.
 */
export function parseTopLevelComponents(content: string): Map<string, ParsedComponent> {
  const result = new Map<string, ParsedComponent>();
  const block = extractComponentsBlock(content);
  if (!block) return result;

  let i = 0;
  const len = block.length;

  while (i < len) {
    // Skip whitespace / newlines between top-level entries
    while (i < len && (block[i] === " " || block[i] === "\t" || block[i] === "\n" || block[i] === "\r")) i++;
    if (i >= len) break;

    // Try to match a component declaration at this position:  TypeName "{16HEX}"... {
    const m = /^(\w+)\s+"\{([0-9A-Fa-f]{16})\}"[^\n{]*\{/.exec(block.slice(i));
    if (m) {
      const typeName = m[1];
      const guid = m[2];
      const openBrace = i + m[0].length - 1; // m[0] ends with "{"
      let depth = 1;
      let j = openBrace + 1;
      while (j < len && depth > 0) {
        if (block[j] === "{") depth++;
        else if (block[j] === "}") depth--;
        j++;
      }
      const rawBody = block.slice(openBrace + 1, j - 1);
      result.set(guid, { guid, typeName, rawBody });
      i = j; // jump past this component's closing brace entirely
    } else {
      // Non-component line (property, comment, etc.) — skip to end of line
      while (i < len && block[i] !== "\n") i++;
    }
  }

  return result;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge components across an ancestry chain.
 * Deepest level (highest depth index) wins per component GUID.
 * Returns a map of GUID -> { comp, source }.
 */
export function mergeAncestryComponents(levels: AncestorLevel[]): Map<string, MergedComponent> {
  const merged = new Map<string, MergedComponent>();
  // Iterate oldest-to-newest so child overwrites parent for same GUID
  for (const level of levels) {
    for (const [guid, comp] of level.components) {
      merged.set(guid, { comp, source: level });
    }
  }
  return merged;
}
