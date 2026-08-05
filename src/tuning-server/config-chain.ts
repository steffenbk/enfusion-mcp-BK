import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  countUnquotedBraces,
  findRootOpenLine,
  findChildBlock,
  findParentReference,
} from "./et-engine-block.js";

/**
 * Reading tyre (Pacejka) and suspension values needs the same three moves the
 * engine resolver already makes — find a nested block, follow the `.conf` it
 * references, then walk that conf's own inheritance — but against different
 * block paths and different field names. This module is that logic with the
 * paths and field names as parameters.
 */

export type FieldSource = "overridden" | "inherited" | "unresolved";
export interface ResolvedField {
  value: number | null;
  source: FieldSource;
}
export type ResolvedGroup = Record<string, ResolvedField>;

export interface BlockRange {
  openLine: number;
  closeLine: number;
}

function defaultReadFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Strip a leading `{GUID}` from an Enfusion resource reference. */
export function stripGuid(ref: string): string {
  return ref.replace(/^\{[0-9A-Fa-f]+\}/, "");
}

/** Whole-document range, so a config file's root block can be treated uniformly. */
export function rootRange(text: string): BlockRange | null {
  const lines = text.split(/\r?\n/);
  const open = findRootOpenLine(lines);
  if (open === -1) return null;
  let d = countUnquotedBraces(lines[open]);
  let close = open;
  while (d > 0 && close + 1 < lines.length) {
    close++;
    d += countUnquotedBraces(lines[close]);
  }
  return { openLine: open, closeLine: close };
}

/**
 * Walk a chain of first-token names down from the document root.
 * `["components", "VehicleWheeledSimulation", "Simulation", "Pacejka"]`
 */
export function findBlockByPath(text: string, path: string[]): BlockRange | null {
  const lines = text.split(/\r?\n/);
  let range = rootRange(text);
  if (!range) return null;
  for (const token of path) {
    const next: BlockRange | null = findChildBlock(lines, range, token);
    if (!next) return null;
    range = next;
  }
  return range;
}

/** Every direct child block of `parent`, in order — used for the axle list. */
export function findChildBlocks(text: string, parent: BlockRange, firstToken: string): BlockRange[] {
  const lines = text.split(/\r?\n/);
  const out: BlockRange[] = [];
  let depth = 0;
  for (let i = parent.openLine + 1; i < parent.closeLine; i++) {
    const line = lines[i];
    if (depth === 0) {
      const trimmed = line.trim();
      if (trimmed.split(/\s+/)[0] === firstToken && countUnquotedBraces(line) > 0) {
        let d = countUnquotedBraces(line);
        let j = i;
        while (d > 0 && j + 1 < lines.length) {
          j++;
          d += countUnquotedBraces(lines[j]);
        }
        out.push({ openLine: i, closeLine: j });
      }
    }
    depth += countUnquotedBraces(line);
  }
  return out;
}

/** The `.conf` reference on a block's header line, if it has one. */
export function blockReference(text: string, range: BlockRange): string | undefined {
  const header = text.split(/\r?\n/)[range.openLine];
  const m = /:\s*"([^"]+)"/.exec(header);
  return m ? m[1] : undefined;
}

const FIELD_LINE_RE = /^(\s*)([A-Za-z][A-Za-z0-9_]*)\s+(-?\d+(?:\.\d+)?)\s*$/;

/** Read the named numeric fields written directly at this block's top level. */
export function readNumericFields(
  text: string,
  range: BlockRange,
  keys: readonly string[]
): Record<string, number> {
  const lines = text.split(/\r?\n/);
  const found: Record<string, number> = {};
  let depth = 0;
  for (let i = range.openLine + 1; i < range.closeLine; i++) {
    const line = lines[i];
    if (depth === 0) {
      const m = FIELD_LINE_RE.exec(line);
      if (m && keys.includes(m[2])) found[m[2]] = parseFloat(m[3]);
    }
    depth += countUnquotedBraces(line);
  }
  return found;
}

export interface ChainOptions {
  /** Roots searched in order for a referenced file: the mod, then vanilla. */
  roots: string[];
  readFile?: (path: string) => string | null;
  /** Optional sub-block inside each config, e.g. "Longitudinal". */
  subBlock?: string;
  keys: readonly string[];
  maxDepth?: number;
}

/**
 * Follow a `.conf` reference and every parent conf above it, taking each field
 * from the nearest definition. Enfusion configs store only what differs from
 * their parent — PacejkaTire_M151A2 defines 8 of 11 longitudinal coefficients
 * and inherits the rest — so the whole chain has to be read to fill a set.
 */
export function collectFromConfChain(
  startRef: string | undefined,
  opts: ChainOptions
): Record<string, number> {
  const read = opts.readFile ?? defaultReadFile;
  const out: Record<string, number> = {};
  if (!startRef) return out;

  const readRef = (ref: string): string | null => {
    const rel = stripGuid(ref);
    for (const root of opts.roots) {
      const text = read(join(root, ...rel.split("/")));
      if (text) return text;
    }
    return null;
  };

  const seen = new Set<string>();
  let ref: string | undefined = startRef;
  const max = opts.maxDepth ?? 16;

  for (let depth = 0; depth < max && ref; depth++) {
    const rel = stripGuid(ref);
    if (seen.has(rel)) break;
    seen.add(rel);

    const text: string | null = readRef(ref);
    if (!text) break;

    const root = rootRange(text);
    if (!root) break;
    const target = opts.subBlock ? findBlockByPath(text, [opts.subBlock]) : root;
    if (target) {
      const vals = readNumericFields(text, target, opts.keys);
      // Nearest definition wins.
      for (const k of opts.keys) if (out[k] === undefined && vals[k] !== undefined) out[k] = vals[k];
    }

    const parent: string | null = findParentReference(text);
    ref = parent ?? undefined;
  }
  return out;
}

/** Merge an overridden set and an inherited set into badge-carrying fields. */
export function toResolved(
  keys: readonly string[],
  overridden: Record<string, number>,
  inherited: Record<string, number>
): ResolvedGroup {
  const out: ResolvedGroup = {};
  for (const k of keys) {
    if (overridden[k] !== undefined) out[k] = { value: overridden[k], source: "overridden" };
    else if (inherited[k] !== undefined) out[k] = { value: inherited[k], source: "inherited" };
    else out[k] = { value: null, source: "unresolved" };
  }
  return out;
}
