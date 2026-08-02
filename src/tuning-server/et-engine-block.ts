import { ENGINE_FIELD_KEYS, type EngineFields } from "./engine-conf.js";

/** Inclusive 0-based line indices of a `{ ... }` block. */
export interface BlockRange {
  openLine: number;
  closeLine: number;
}

export interface EngineBlockLocation extends BlockRange {
  /** The `"{GUID}path.conf"` after `:` on the header line, if the block references a config. */
  inheritance?: string;
  /** Leading whitespace that field lines inside this block use. */
  fieldIndent: string;
}

/**
 * Net brace depth change for one line, ignoring braces inside quoted strings.
 * Essential: GUIDs are written `"{CEA5458AC6B97274}path"` and would otherwise
 * be counted as nesting.
 */
export function countUnquotedBraces(line: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== "\\") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  return depth;
}

/** Index of the first line that opens the document's root block. */
function findRootOpenLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (countUnquotedBraces(lines[i]) > 0) return i;
  }
  return -1;
}

/**
 * Find a direct child block of the given parent whose first whitespace-separated
 * token equals `firstToken`. Only lines at the parent's immediate nesting level
 * are considered, so a matching name deeper in the tree is ignored.
 */
function findChildBlock(
  lines: string[],
  parent: BlockRange,
  firstToken: string
): BlockRange | null {
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
        return { openLine: i, closeLine: j };
      }
    }
    depth += countUnquotedBraces(line);
  }
  return null;
}

/**
 * Locate `components -> VehicleWheeledSimulation -> Simulation -> Engine`.
 * Returns null if any level is absent — callers must never create the structure.
 */
export function findEngineBlock(text: string): EngineBlockLocation | null {
  const lines = text.split(/\r?\n/);
  const rootOpen = findRootOpenLine(lines);
  if (rootOpen === -1) return null;

  let d = countUnquotedBraces(lines[rootOpen]);
  let rootClose = rootOpen;
  while (d > 0 && rootClose + 1 < lines.length) {
    rootClose++;
    d += countUnquotedBraces(lines[rootClose]);
  }
  const root: BlockRange = { openLine: rootOpen, closeLine: rootClose };

  const components = findChildBlock(lines, root, "components");
  if (!components) return null;
  const sim0 = findChildBlock(lines, components, "VehicleWheeledSimulation");
  if (!sim0) return null;
  // Header line reads `Simulation Wheeled "{GUID}" {`, so the first token is "Simulation".
  const sim = findChildBlock(lines, sim0, "Simulation");
  if (!sim) return null;
  const engine = findChildBlock(lines, sim, "Engine");
  if (!engine) return null;

  const header = lines[engine.openLine];
  const refMatch = /:\s*"([^"]+)"/.exec(header);
  const headerIndent = /^(\s*)/.exec(header)![1];

  // Prefer the indentation an existing field line already uses; otherwise go one
  // level deeper than the header (these files indent one space per level).
  let fieldIndent = headerIndent + " ";
  for (let i = engine.openLine + 1; i < engine.closeLine; i++) {
    if (lines[i].trim() !== "") {
      fieldIndent = /^(\s*)/.exec(lines[i])![1];
      break;
    }
  }

  return {
    openLine: engine.openLine,
    closeLine: engine.closeLine,
    inheritance: refMatch ? refMatch[1] : undefined,
    fieldIndent,
  };
}

/** Matches `  MaxPower 53` — a bare key followed by a single numeric value. */
const FIELD_LINE_RE = /^(\s*)([A-Za-z][A-Za-z0-9_]*)\s+(-?\d+(?:\.\d+)?)\s*$/;

/** Read whichever of the 9 known fields are written directly inside the block. */
export function readEngineFieldsFromBlock(
  text: string,
  loc: BlockRange
): Partial<EngineFields> {
  const lines = text.split(/\r?\n/);
  const found: Partial<EngineFields> = {};
  let depth = 0;
  for (let i = loc.openLine + 1; i < loc.closeLine; i++) {
    const line = lines[i];
    if (depth === 0) {
      const m = FIELD_LINE_RE.exec(line);
      if (m && (ENGINE_FIELD_KEYS as string[]).includes(m[2])) {
        found[m[2] as keyof EngineFields] = parseFloat(m[3]);
      }
    }
    depth += countUnquotedBraces(line);
  }
  return found;
}

/**
 * Return `text` with only the given fields changed inside the located Engine block.
 * A field already present is replaced in place (its original indentation is kept);
 * a field that is absent is inserted just before the block's closing line using
 * `loc.fieldIndent`. Every other byte of the document is left exactly as it was —
 * the file is never re-serialized.
 */
export function writeEngineFields(
  text: string,
  loc: EngineBlockLocation,
  changes: Partial<EngineFields>
): string {
  const changedKeys = ENGINE_FIELD_KEYS.filter((k) => changes[k] !== undefined);
  if (changedKeys.length === 0) return text;

  const usesCrlf = text.includes("\r\n");
  const lines = text.split(/\r?\n/);
  const remaining = new Set<string>(changedKeys);

  // Pass 1: replace fields already present at the block's top level.
  let depth = 0;
  for (let i = loc.openLine + 1; i < loc.closeLine; i++) {
    const line = lines[i];
    if (depth === 0) {
      const m = FIELD_LINE_RE.exec(line);
      if (m && remaining.has(m[2])) {
        const key = m[2] as keyof EngineFields;
        lines[i] = `${m[1]}${m[2]} ${changes[key]}`;
        remaining.delete(m[2]);
      }
    }
    depth += countUnquotedBraces(line);
  }

  // Pass 2: insert whatever is still missing, just before the closing line.
  if (remaining.size > 0) {
    const inserted = ENGINE_FIELD_KEYS.filter((k) => remaining.has(k)).map(
      (k) => `${loc.fieldIndent}${k} ${changes[k]}`
    );
    lines.splice(loc.closeLine, 0, ...inserted);
  }

  return lines.join(usesCrlf ? "\r\n" : "\n");
}
