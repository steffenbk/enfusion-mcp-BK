# Vehicle `.et` Engine Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the existing engine tuner so it writes to the *vehicle's own* `.et` prefab in the mod project folder instead of the shared base-game `Engine_*.conf`, using surgical byte-preserving edits that never re-serialize the prefab.

**Architecture:** A brace-aware locator finds the `Engine` block inside `components → VehicleWheeledSimulation → Simulation Wheeled` in a `.et` file and returns its line range. Reads and writes touch only field lines inside that range; every other byte is left untouched. Values not overridden in the `.et` are resolved from the base-game extracted mirror (via the Engine node's `: "{GUID}…conf"` reference, or the same-path vanilla `.et`). The HTTP server, CLI, and tuner page from the shipped v1 all carry over.

**Tech Stack:** TypeScript (Node `http`, `node:fs`, no new dependencies), Vitest, plain HTML/CSS/JS canvas page.

## Global Constraints

- The 9 engine fields, exact names: `Inertia`, `MaxPower`, `MaxTorque`, `RpmMaxPower`, `RpmMaxTorque`, `Steepness`, `Friction`, `RpmIdle`, `RpmMax`. (`RpmRedline` exists in the files but is deliberately NOT one of the 9 — never read or write it.)
- **Never call `parse()`/`serialize()` from `src/formats/enfusion-text.ts` on a `.et` file.** Measured on the real 1222-line `M151A2.et` it drops the `+` array-append operator, mangles vectors (`Offset 0 0.5 -1.8` → two lines), loses the `Engine` line entirely, and rewrites 1373 of 1415 lines. Do not import it, and do not "fix" it — other MCP tools depend on that module.
- Every write is surgical: replace or insert only field lines inside the located `Engine` block. Every other byte of the file must be byte-identical after a write.
- **No structural creation.** The tool must never create a `components`, `VehicleWheeledSimulation`, `Simulation Wheeled`, or `Engine` block. A vehicle without an existing `Engine` block is not listed and cannot be written. Inserting a missing *field line* into an already-existing `Engine` block IS allowed.
- **Addon-only.** Only `.et` files under `<addonPath>/Prefabs/Vehicles/` are listed or written, where `addonPath` comes from the existing `ENFUSION_TUNING_ADDON` env var (default `RoadForger`). Vanilla vehicles in the extracted mirror are read-only baseline data and are never listed or written.
- Only fields the user actually changed are written. Untouched and unresolved fields are never written.
- After every successful write, the UI shows the Workbench-reload reminder (Workbench silently reverts external edits to a prefab it has open).
- Brace counting must ignore braces inside quoted strings — GUIDs are written `"{CEA5458AC6B97274}Prefabs/…"` and would otherwise be miscounted as nesting.
- Enfusion `.et` files in this codebase indent one space per nesting level.
- Local developer tool: run via `npm run tuning-server` (tsx), not wired into the published package `bin`.

---

## File Structure

```
src/tuning-server/
  et-engine-block.ts   # NEW. Brace-aware Engine-block locate + surgical read/replace/insert
  resolve-engine.ts    # NEW. Fill all 9 fields from .et override -> referenced .conf -> vanilla .et
  engine-conf.ts       # KEPT. Gains parseEngineConfPartial; now read-only baseline source
  discover.ts          # REWRITTEN. Scan Prefabs/Vehicles/**/*.et, keep those with an Engine block
  server.ts            # MODIFIED. /api/engines* -> /api/vehicles*, partial-changes POST body
  index.ts             # MODIFIED. Pass extractedPath through
  public/tuner.html    # MODIFIED. Vehicle dropdown, per-field source badges, changes-only POST
tests/tuning-server/
  et-engine-block.test.ts   # NEW
  resolve-engine.test.ts    # NEW
  discover.test.ts          # REWRITTEN
  server.test.ts            # REWRITTEN
  engine-conf.test.ts       # unchanged
```

---

### Task 1: Engine block locator and reader

**Files:**
- Create: `src/tuning-server/et-engine-block.ts`
- Test: `tests/tuning-server/et-engine-block.test.ts`

**Interfaces:**
- Consumes: `EngineFields`, `ENGINE_FIELD_KEYS` from `./engine-conf.js` (already exist).
- Produces:
  - `interface BlockRange { openLine: number; closeLine: number; }` — 0-based line indices, inclusive.
  - `interface EngineBlockLocation extends BlockRange { inheritance?: string; fieldIndent: string; }`
  - `function findEngineBlock(text: string): EngineBlockLocation | null`
  - `function readEngineFieldsFromBlock(text: string, loc: BlockRange): Partial<EngineFields>`
  - `function countUnquotedBraces(line: string): number` (exported for testing)

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tuning-server/et-engine-block.test.ts
import { describe, it, expect } from "vitest";
import {
  findEngineBlock,
  readEngineFieldsFromBlock,
  countUnquotedBraces,
} from "../../src/tuning-server/et-engine-block.js";

// Shape of RoadForger/Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et:
// has Simulation Wheeled with a Gearbox, but NO Engine block.
const URAL_NO_ENGINE = `Vehicle : "{E03D5609EEA6E03D}Prefabs/Vehicles/Core/Wheeled_Truck_Base.et" {
 ID "0000000000000001"
 components {
  SCR_TerrainDragComponent_BK "{6A81C5A0B3D14E22}" {
   m_fMaxSpeedKmh 95
  }
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Gearbox Gearbox Gearbox {
     Forward {
      10 3.4 2.25 1.48 1
     }
    }
   }
  }
 }
 coords 1213.632 39 2355.943
}
`;

// Shape of vanilla S105_rally.et / BRDM2_base.et: full inline Engine block, no conf reference.
const INLINE_ENGINE = `Vehicle : "{AAAA}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     Inertia 0.3
     MaxPower 100
     MaxTorque 135
     RpmMaxPower 7500
     RpmMaxTorque 5500
     Steepness 15
     Friction 41
     RpmIdle 840
     RpmRedline 8500
     RpmMax 9000
    }
    Clutch Clutch Clutch {
     MaxTorque 250
    }
   }
  }
 }
}
`;

// Shape of vanilla M151A2.et: Engine references a .conf and overrides only Output.
const REF_ENGINE = `Vehicle : "{BBBB}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {
 components {
  SCR_VehicleSoundComponent "{55C2E66AD4EF2CA6}" {
   Filenames + {
    "{D89573B95647C34A}Sounds/A.acp" "{A117C96F2734B916}Sounds/B.acp"
   }
  }
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf" {
     Output "Clutch"
    }
   }
  }
 }
}
`;

describe("countUnquotedBraces", () => {
  it("ignores braces inside quoted strings (GUIDs)", () => {
    expect(countUnquotedBraces(`  Engine : "{CEA5458AC6B97274}path.conf" {`)).toBe(1);
  });

  it("counts a plain opening brace", () => {
    expect(countUnquotedBraces("  Gearbox {")).toBe(1);
  });

  it("counts a plain closing brace", () => {
    expect(countUnquotedBraces("  }")).toBe(-1);
  });

  it("nets to zero for a single-line block", () => {
    expect(countUnquotedBraces("  Foo { }")).toBe(0);
  });
});

describe("findEngineBlock", () => {
  it("returns null when the vehicle has Simulation Wheeled but no Engine block", () => {
    expect(findEngineBlock(URAL_NO_ENGINE)).toBeNull();
  });

  it("returns null when there is no VehicleWheeledSimulation at all", () => {
    const noSim = `Vehicle : "{CCCC}Base.et" {\n components {\n  SCR_Foo "{DDDD}" {\n  }\n }\n}\n`;
    expect(findEngineBlock(noSim)).toBeNull();
  });

  it("locates an inline Engine block and its field indentation", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    expect(loc).not.toBeNull();
    const lines = INLINE_ENGINE.split("\n");
    expect(lines[loc.openLine].trim()).toBe("Engine Engine Engine {");
    expect(lines[loc.closeLine].trim()).toBe("}");
    expect(loc.fieldIndent).toBe("     "); // 5 spaces, one deeper than the header's 4
    expect(loc.inheritance).toBeUndefined();
  });

  it("does not mistake the Clutch block's MaxTorque for the Engine's", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const fields = readEngineFieldsFromBlock(INLINE_ENGINE, loc);
    expect(fields.MaxTorque).toBe(135); // Engine's, not Clutch's 250
  });

  it("captures the conf reference on a referencing Engine block", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    expect(loc.inheritance).toBe(
      "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf"
    );
  });

  it("is not confused by a Filenames + block earlier in the file", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const lines = REF_ENGINE.split("\n");
    expect(lines[loc.openLine]).toContain("Engine Engine Engine");
  });
});

describe("readEngineFieldsFromBlock", () => {
  it("reads all present fields from an inline block, ignoring RpmRedline", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const fields = readEngineFieldsFromBlock(INLINE_ENGINE, loc);
    expect(fields).toEqual({
      Inertia: 0.3,
      MaxPower: 100,
      MaxTorque: 135,
      RpmMaxPower: 7500,
      RpmMaxTorque: 5500,
      Steepness: 15,
      Friction: 41,
      RpmIdle: 840,
      RpmMax: 9000,
    });
    expect("RpmRedline" in fields).toBe(false);
  });

  it("returns an empty object for a block that only overrides Output", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    expect(readEngineFieldsFromBlock(REF_ENGINE, loc)).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/et-engine-block.test.ts`
Expected: FAIL — `Cannot find module '../../src/tuning-server/et-engine-block.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/tuning-server/et-engine-block.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/et-engine-block.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/et-engine-block.ts tests/tuning-server/et-engine-block.test.ts
git commit -m "feat(tuning-server): add brace-aware .et Engine block locator and reader"
```

---

### Task 2: Surgical Engine block writer

**Files:**
- Modify: `src/tuning-server/et-engine-block.ts` (append; do not alter Task 1's functions)
- Test: `tests/tuning-server/et-engine-block.test.ts` (append a new `describe`)

**Interfaces:**
- Consumes: `EngineBlockLocation`, `findEngineBlock`, `countUnquotedBraces`, `FIELD_LINE_RE` logic from Task 1; `EngineFields`, `ENGINE_FIELD_KEYS` from `./engine-conf.js`.
- Produces: `function writeEngineFields(text: string, loc: EngineBlockLocation, changes: Partial<EngineFields>): string`
  — replaces a field line in place when present, inserts it just before the block's closing line when absent, and leaves every other byte of the file untouched.

- [ ] **Step 1: Write the failing tests**

Append to `tests/tuning-server/et-engine-block.test.ts`. Add `writeEngineFields` to the existing import from `../../src/tuning-server/et-engine-block.js`, and add this new block at the end of the file (`INLINE_ENGINE` and `REF_ENGINE` are already defined at the top of that file):

```typescript
describe("writeEngineFields", () => {
  it("replaces an existing field in place and changes nothing else", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxPower: 175 });

    const before = INLINE_ENGINE.split("\n");
    const after = out.split("\n");
    expect(after.length).toBe(before.length);

    const differing = after.filter((l, i) => l !== before[i]);
    expect(differing).toEqual(["     MaxPower 175"]);
  });

  it("preserves the RpmRedline line it does not manage", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxPower: 175 });
    expect(out).toContain("RpmRedline 8500");
  });

  it("does not touch the Clutch block's MaxTorque when writing the Engine's", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxTorque: 999 });
    expect(out).toContain("MaxTorque 999");
    expect(out).toContain("MaxTorque 250"); // Clutch's, untouched
  });

  it("inserts a missing field inside the block using the block's indentation", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const out = writeEngineFields(REF_ENGINE, loc, { MaxPower: 75 });

    const before = REF_ENGINE.split("\n");
    const after = out.split("\n");
    expect(after.length).toBe(before.length + 1);
    expect(out).toContain("     MaxPower 75");
    // inserted inside the block, before its closing brace
    const idx = after.findIndex((l) => l.trim() === "MaxPower 75");
    expect(after[idx - 1].trim()).toBe('Output "Clutch"');
  });

  it("preserves the + array-append operator elsewhere in the file", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const out = writeEngineFields(REF_ENGINE, loc, { MaxPower: 75 });
    expect(out).toContain("Filenames + {");
  });

  it("writes nothing when there are no changes", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    expect(writeEngineFields(INLINE_ENGINE, loc, {})).toBe(INLINE_ENGINE);
  });

  it("preserves CRLF line endings", () => {
    const crlf = INLINE_ENGINE.replace(/\n/g, "\r\n");
    const loc = findEngineBlock(crlf)!;
    const out = writeEngineFields(crlf, loc, { MaxPower: 175 });
    expect(out).toContain("\r\n");
    expect(out).toContain("MaxPower 175");
    expect(out.includes("\n\n")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/et-engine-block.test.ts`
Expected: FAIL — `writeEngineFields is not a function` / import error

- [ ] **Step 3: Write the implementation**

Append to `src/tuning-server/et-engine-block.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/et-engine-block.test.ts`
Expected: PASS (19 tests — 12 from Task 1 plus 7 new)

- [ ] **Step 5: Byte-fidelity check against a real prefab**

This is the check that the shared `enfusion-text.ts` parser would have failed. Create `scratch-fidelity.mjs` in the repo root, run it, then delete it — do not commit it.

```javascript
// scratch-fidelity.mjs
import { readFileSync } from "node:fs";
const { findEngineBlock, writeEngineFields } = await import(
  "./src/tuning-server/et-engine-block.ts"
);
const p = "E:/Arma reforger data/extracted_files/Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et";
const original = readFileSync(p, "utf-8");
const loc = findEngineBlock(original);
console.log("engine block found:", !!loc, loc && `lines ${loc.openLine + 1}-${loc.closeLine + 1}`);
const out = writeEngineFields(original, loc, { MaxPower: 999 });
const a = original.split(/\r?\n/), b = out.split(/\r?\n/);
console.log("line count:", a.length, "->", b.length);
const diff = b.map((l, i) => (l === a[i] ? null : `${i + 1}: ${JSON.stringify(a[i])} -> ${JSON.stringify(l)}`)).filter(Boolean);
console.log("differing lines:", diff.length);
console.log(diff.join("\n"));
console.log("'+' operators preserved:", (original.match(/\+ \{/g) || []).length === (out.match(/\+ \{/g) || []).length);
```

Run: `npx tsx scratch-fidelity.mjs`
Expected: engine block found; line count unchanged; **exactly 1 differing line** (the `MaxPower` line); `'+' operators preserved: true`.

If the differing-line count is anything other than 1, stop and report — the locator or writer is wrong and nothing downstream should be built on it.

Then: `rm scratch-fidelity.mjs`

- [ ] **Step 6: Commit**

```bash
git add src/tuning-server/et-engine-block.ts tests/tuning-server/et-engine-block.test.ts
git commit -m "feat(tuning-server): add surgical byte-preserving Engine block writer"
```

---

### Task 3: Resolve all 9 fields from override, referenced conf, and vanilla fallback

**Files:**
- Modify: `src/tuning-server/engine-conf.ts` (add `parseEngineConfPartial`, refactor `parseEngineConf` to use it)
- Create: `src/tuning-server/resolve-engine.ts`
- Test: `tests/tuning-server/resolve-engine.test.ts`

**Interfaces:**
- Consumes: `findEngineBlock`, `readEngineFieldsFromBlock` from `./et-engine-block.js` (Task 1); `ENGINE_FIELD_KEYS`, `EngineFields` from `./engine-conf.js`.
- Produces (in `engine-conf.ts`): `function parseEngineConfPartial(text: string): Partial<EngineFields>` — same parsing as `parseEngineConf` but never throws on missing fields.
- Produces (in `resolve-engine.ts`):
  - `type FieldSource = "overridden" | "inherited" | "unresolved";`
  - `interface ResolvedField { value: number | null; source: FieldSource; }`
  - `type ResolvedEngine = Record<keyof EngineFields, ResolvedField>;`
  - `function resolveEngineFields(args: { modText: string; relPath: string; extractedPath?: string; readFile?: (path: string) => string | null; }): ResolvedEngine`
    — `relPath` is the vehicle's addon-relative posix path (e.g. `Prefabs/Vehicles/Wheeled/M151A2/M151A2.et`). `readFile` is injectable for tests and defaults to a real filesystem read returning `null` when the file is absent.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tuning-server/resolve-engine.test.ts
import { describe, it, expect } from "vitest";
import { resolveEngineFields } from "../../src/tuning-server/resolve-engine.js";

const MOD_ET_WITH_REF = `Vehicle : "{BBBB}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf" {
     MaxPower 75
    }
   }
  }
 }
}
`;

const ENGINE_M151_CONF = `Engine {
 Inertia 0.3
 MaxPower 53
 MaxTorque 176
 RpmMaxPower 4000
 RpmMaxTorque 1800
 Steepness 15
 Friction 53
 RpmIdle 840
 RpmRedline 4200
 RpmMax 6000
}
`;

const MOD_ET_NO_REF = `Vehicle : "{CCCC}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 120
    }
   }
  }
 }
}
`;

const VANILLA_ET_INLINE = `Vehicle : "{DDDD}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     Inertia 1.3
     MaxPower 103
     MaxTorque 383
     RpmMaxPower 3300
     RpmMaxTorque 2500
     Steepness 12
     Friction 140
     RpmIdle 600
     RpmMax 4000
    }
   }
  }
 }
}
`;

describe("resolveEngineFields", () => {
  it("marks a field written in the mod .et as overridden and the rest as inherited", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_WITH_REF,
      relPath: "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et",
      extractedPath: "E:/mirror",
      readFile: (p) => (p.includes("Engine_M151.conf") ? ENGINE_M151_CONF : null),
    });
    expect(r.MaxPower).toEqual({ value: 75, source: "overridden" });
    expect(r.MaxTorque).toEqual({ value: 176, source: "inherited" });
    expect(r.RpmIdle).toEqual({ value: 840, source: "inherited" });
  });

  it("falls back to the same-path vanilla .et when the block has no conf reference", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
      extractedPath: "E:/mirror",
      readFile: (p) => (p.includes("BRDM2_base.et") ? VANILLA_ET_INLINE : null),
    });
    expect(r.MaxPower).toEqual({ value: 120, source: "overridden" });
    expect(r.Steepness).toEqual({ value: 12, source: "inherited" });
    expect(r.Friction).toEqual({ value: 140, source: "inherited" });
  });

  it("marks fields unresolved when no baseline can be read", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
      extractedPath: undefined,
      readFile: () => null,
    });
    expect(r.MaxPower).toEqual({ value: 120, source: "overridden" });
    expect(r.Steepness).toEqual({ value: null, source: "unresolved" });
  });

  it("returns all nine keys regardless of what resolved", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/X/X.et",
      readFile: () => null,
    });
    expect(Object.keys(r).sort()).toEqual(
      ["Friction", "Inertia", "MaxPower", "MaxTorque", "RpmIdle", "RpmMax", "RpmMaxPower", "RpmMaxTorque", "Steepness"].sort()
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/resolve-engine.test.ts`
Expected: FAIL — `Cannot find module '../../src/tuning-server/resolve-engine.js'`

- [ ] **Step 3: Add `parseEngineConfPartial` to `engine-conf.ts`**

In `src/tuning-server/engine-conf.ts`, replace the existing `parseEngineConf` function with these two (leave `ENGINE_LINE_RE`, `EngineFields`, `ENGINE_FIELD_KEYS`, and `serializeEngineConf` exactly as they are):

```typescript
/** Read whichever of the 9 known fields are present. Never throws. */
export function parseEngineConfPartial(text: string): Partial<EngineFields> {
  const found: Partial<EngineFields> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = ENGINE_LINE_RE.exec(line);
    if (!m) continue;
    const key = m[2];
    if ((ENGINE_FIELD_KEYS as string[]).includes(key)) {
      found[key as keyof EngineFields] = parseFloat(m[3]);
    }
  }
  return found;
}

export function parseEngineConf(text: string): EngineFields {
  const found = parseEngineConfPartial(text);
  const missing = ENGINE_FIELD_KEYS.filter((k) => found[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Engine .conf missing required field(s): ${missing.join(", ")}`);
  }
  return found as EngineFields;
}
```

- [ ] **Step 4: Write `resolve-engine.ts`**

```typescript
// src/tuning-server/resolve-engine.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ENGINE_FIELD_KEYS, parseEngineConfPartial, type EngineFields } from "./engine-conf.js";
import { findEngineBlock, readEngineFieldsFromBlock } from "./et-engine-block.js";

export type FieldSource = "overridden" | "inherited" | "unresolved";

export interface ResolvedField {
  value: number | null;
  source: FieldSource;
}

export type ResolvedEngine = Record<keyof EngineFields, ResolvedField>;

function defaultReadFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Strip a leading `{GUID}` from an Enfusion resource reference. */
function stripGuid(ref: string): string {
  return ref.replace(/^\{[0-9A-Fa-f]+\}/, "");
}

/**
 * Fill all 9 engine fields for a vehicle:
 *   1. written in the mod's own .et Engine block  -> "overridden"
 *   2. from the .conf that block references       -> "inherited"
 *   3. from the same-path vanilla .et in the mirror (its inline values, or the
 *      .conf that IT references)                  -> "inherited"
 *   4. otherwise                                  -> "unresolved"
 */
export function resolveEngineFields(args: {
  modText: string;
  relPath: string;
  extractedPath?: string;
  readFile?: (path: string) => string | null;
}): ResolvedEngine {
  const read = args.readFile ?? defaultReadFile;
  const overridden: Partial<EngineFields> = {};
  const inherited: Partial<EngineFields> = {};

  const modLoc = findEngineBlock(args.modText);
  if (modLoc) {
    Object.assign(overridden, readEngineFieldsFromBlock(args.modText, modLoc));
  }

  const mirror = args.extractedPath;
  const confFromRef = (ref: string | undefined): void => {
    if (!ref || !mirror) return;
    const text = read(join(mirror, ...stripGuid(ref).split("/")));
    if (text) Object.assign(inherited, parseEngineConfPartial(text));
  };

  if (modLoc?.inheritance) {
    confFromRef(modLoc.inheritance);
  } else if (mirror) {
    const vanillaText = read(join(mirror, ...args.relPath.split("/")));
    if (vanillaText) {
      const vLoc = findEngineBlock(vanillaText);
      if (vLoc) {
        const vInline = readEngineFieldsFromBlock(vanillaText, vLoc);
        if (Object.keys(vInline).length > 0) {
          Object.assign(inherited, vInline);
        } else {
          // a vanilla block may itself only reference a conf
          confFromRef(vLoc.inheritance);
        }
      }
    }
  }

  const out = {} as ResolvedEngine;
  for (const key of ENGINE_FIELD_KEYS) {
    if (overridden[key] !== undefined) {
      out[key] = { value: overridden[key]!, source: "overridden" };
    } else if (inherited[key] !== undefined) {
      out[key] = { value: inherited[key]!, source: "inherited" };
    } else {
      out[key] = { value: null, source: "unresolved" };
    }
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/resolve-engine.test.ts tests/tuning-server/engine-conf.test.ts`
Expected: PASS — 4 new resolve tests, and all 5 existing `engine-conf` tests still green (the refactor must not change `parseEngineConf`'s behaviour).

- [ ] **Step 6: Commit**

```bash
git add src/tuning-server/resolve-engine.ts src/tuning-server/engine-conf.ts tests/tuning-server/resolve-engine.test.ts
git commit -m "feat(tuning-server): resolve engine fields from override, referenced conf, vanilla fallback"
```

---

### Task 4: Discover tunable vehicles in the addon

**Files:**
- Rewrite: `src/tuning-server/discover.ts`
- Rewrite: `tests/tuning-server/discover.test.ts`

**Interfaces:**
- Consumes: `findEngineBlock` from `./et-engine-block.js` (Task 1).
- Produces:
  - `const VEHICLES_SUBPATH = "Prefabs/Vehicles"`
  - `function listTunableVehicles(addonPath: string): string[]` — addon-relative posix paths (e.g. `Prefabs/Vehicles/Wheeled/M151A2/M151A2.et`) for `.et` files that contain an Engine block, sorted; `[]` when the directory is absent.
  - `function vehicleEtPath(addonPath: string, relPath: string): string`
  - `function isSafeVehicleRelPath(relPath: string): boolean` — the traversal guard for URL-supplied paths. Unlike v1's filename guard these paths legitimately contain `/`, so this checks for `..`, backslashes, absolute paths, drive letters, and requires the `Prefabs/Vehicles/` prefix and a `.et` suffix.
- The old `ENGINE_CONF_SUBPATH`, `listEngineConfFiles`, and `engineConfPath` are deleted; Task 5 removes their last call sites.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/tuning-server/discover.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listTunableVehicles,
  vehicleEtPath,
  isSafeVehicleRelPath,
  VEHICLES_SUBPATH,
} from "../../src/tuning-server/discover.js";

const WITH_ENGINE = `Vehicle : "{AAAA}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 100
    }
   }
  }
 }
}
`;

const WITHOUT_ENGINE = `Vehicle : "{BBBB}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Gearbox Gearbox Gearbox {
     Forward {
      10 3.4
     }
    }
   }
  }
 }
}
`;

describe("listTunableVehicles", () => {
  let addonDir: string;

  beforeEach(() => {
    addonDir = mkdtempSync(join(tmpdir(), "tuner-vehicles-"));
  });

  afterEach(() => {
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("returns an empty array when Prefabs/Vehicles does not exist", () => {
    expect(listTunableVehicles(addonDir)).toEqual([]);
  });

  it("lists only .et files that contain an Engine block, recursively and sorted", () => {
    const base = join(addonDir, ...VEHICLES_SUBPATH.split("/"));
    mkdirSync(join(base, "Wheeled", "Ural4320"), { recursive: true });
    mkdirSync(join(base, "Wheeled", "M151A2"), { recursive: true });
    writeFileSync(join(base, "Wheeled", "Ural4320", "Ural4320.et"), WITHOUT_ENGINE);
    writeFileSync(join(base, "Wheeled", "M151A2", "M151A2.et"), WITH_ENGINE);
    writeFileSync(join(base, "Wheeled", "M151A2", "notes.txt"), "ignore me");

    expect(listTunableVehicles(addonDir)).toEqual([
      "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et",
    ]);
  });

  it("vehicleEtPath joins the addon path with the relative path", () => {
    const rel = "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et";
    expect(vehicleEtPath(addonDir, rel)).toBe(join(addonDir, ...rel.split("/")));
  });
});

describe("isSafeVehicleRelPath", () => {
  it("accepts a normal vehicle path", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/Wheeled/M151A2/M151A2.et")).toBe(true);
  });

  it("rejects parent-directory traversal", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/../../../etc/passwd")).toBe(false);
  });

  it("rejects backslashes", () => {
    expect(isSafeVehicleRelPath("Prefabs\\Vehicles\\X.et")).toBe(false);
  });

  it("rejects absolute paths and drive letters", () => {
    expect(isSafeVehicleRelPath("/etc/passwd")).toBe(false);
    expect(isSafeVehicleRelPath("C:/Windows/system.ini")).toBe(false);
  });

  it("rejects paths outside Prefabs/Vehicles", () => {
    expect(isSafeVehicleRelPath("Scripts/Game/Thing.et")).toBe(false);
  });

  it("rejects non-.et files", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/Wheeled/X/X.conf")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/discover.test.ts`
Expected: FAIL — `listTunableVehicles` / `isSafeVehicleRelPath` are not exported

- [ ] **Step 3: Rewrite `discover.ts`**

Replace the entire contents of `src/tuning-server/discover.ts`:

```typescript
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findEngineBlock } from "./et-engine-block.js";

export const VEHICLES_SUBPATH = "Prefabs/Vehicles";

/** Recursively collect addon-relative posix paths of every .et under a directory. */
function collectEtFiles(absDir: string, relPrefix: string, out: string[]): void {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      collectEtFiles(abs, rel, out);
    } else if (entry.isFile() && entry.name.endsWith(".et")) {
      out.push(rel);
    }
  }
}

/**
 * Addon-relative paths of vehicle prefabs that already contain an Engine block.
 * Vehicles without one are omitted: this tool never creates the block structure.
 */
export function listTunableVehicles(addonPath: string): string[] {
  const base = join(addonPath, ...VEHICLES_SUBPATH.split("/"));
  if (!existsSync(base) || !statSync(base).isDirectory()) return [];

  const candidates: string[] = [];
  collectEtFiles(base, VEHICLES_SUBPATH, candidates);

  return candidates
    .filter((rel) => {
      try {
        return findEngineBlock(readFileSync(join(addonPath, ...rel.split("/")), "utf-8")) !== null;
      } catch {
        return false;
      }
    })
    .sort();
}

export function vehicleEtPath(addonPath: string, relPath: string): string {
  return join(addonPath, ...relPath.split("/"));
}

/**
 * Guard for URL-supplied vehicle paths. These legitimately contain "/", so the
 * v1 filename guard does not apply; instead pin the prefix and suffix and reject
 * anything that could escape the addon's vehicles directory.
 */
export function isSafeVehicleRelPath(relPath: string): boolean {
  if (relPath.includes("\\")) return false;
  if (relPath.includes("..")) return false;
  if (relPath.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(relPath)) return false;
  if (!relPath.startsWith(`${VEHICLES_SUBPATH}/`)) return false;
  return relPath.endsWith(".et");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/discover.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/discover.ts tests/tuning-server/discover.test.ts
git commit -m "feat(tuning-server): discover addon vehicle .et files that have an Engine block"
```

---

### Task 5: Switch the HTTP server to vehicle routes

**Files:**
- Modify: `src/tuning-server/server.ts`
- Modify: `src/tuning-server/index.ts`
- Rewrite: `tests/tuning-server/server.test.ts`

**Interfaces:**
- Consumes: `listTunableVehicles`, `vehicleEtPath`, `isSafeVehicleRelPath` from `./discover.js` (Task 4); `resolveEngineFields` from `./resolve-engine.js` (Task 3) — its `ResolvedEngine` return type flows through inferred, no type import needed; `findEngineBlock`, `writeEngineFields` from `./et-engine-block.js` (Tasks 1-2); `ENGINE_FIELD_KEYS`, `EngineFields` from `./engine-conf.js`.
- Produces: `function createTuningServer(addonPath: string, extractedPath?: string): Server` — note the new second parameter.
- Routes:
  - `GET /` — unchanged, serves `public/tuner.html`
  - `GET /api/vehicles` → `{ status: "ok", vehicles: string[] }`
  - `GET /api/vehicles/<relPath>` → `{ status: "ok", vehicle: string, fields: ResolvedEngine }`
  - `POST /api/vehicles/<relPath>` with body `{ changes: Partial<EngineFields> }` → `{ status: "ok", vehicle: string, written: string[], message: string }`
- The old `/api/engines*` routes are removed.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/tuning-server/server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createTuningServer } from "../../src/tuning-server/server.js";
import { VEHICLES_SUBPATH } from "../../src/tuning-server/discover.js";

const REL = "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et";

const VEHICLE_ET = `Vehicle : "{AAAA}Base.et" {
 components {
  SCR_VehicleSoundComponent "{55C2E66AD4EF2CA6}" {
   Filenames + {
    "{D89573B95647C34A}Sounds/A.acp"
   }
  }
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     Inertia 0.3
     MaxPower 53
     MaxTorque 176
     RpmMaxPower 4000
     RpmMaxTorque 1800
     Steepness 15
     Friction 53
     RpmIdle 840
     RpmRedline 4200
     RpmMax 6000
    }
   }
  }
 }
}
`;

describe("tuning server", () => {
  let addonDir: string;
  let etPath: string;
  let baseUrl: string;
  let server: ReturnType<typeof createTuningServer>;

  beforeEach(async () => {
    addonDir = mkdtempSync(join(tmpdir(), "tuner-server-"));
    const dir = join(addonDir, ...VEHICLES_SUBPATH.split("/"), "Wheeled", "M151A2");
    mkdirSync(dir, { recursive: true });
    etPath = join(dir, "M151A2.et");
    writeFileSync(etPath, VEHICLE_ET);

    server = createTuningServer(addonDir);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("GET / serves the tuner HTML page", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<title>");
  });

  it("GET /api/vehicles lists tunable vehicles", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok", vehicles: [REL] });
  });

  it("GET /api/vehicles/<rel> returns resolved fields with sources", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/${REL}`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.fields.MaxPower).toEqual({ value: 53, source: "overridden" });
    expect(body.fields.Steepness).toEqual({ value: 15, source: "overridden" });
  });

  it("GET /api/vehicles/<rel> 404s for an unknown vehicle", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/Prefabs/Vehicles/Wheeled/Nope/Nope.et`);
    expect(res.status).toBe(404);
    expect((await res.json()).status).toBe("error");
  });

  it("GET rejects a traversal path", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/Prefabs/Vehicles/../../../etc/passwd`);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("Invalid");
  });

  it("POST writes only the changed field and leaves the rest byte-identical", async () => {
    const before = readFileSync(etPath, "utf-8");
    const res = await fetch(`${baseUrl}/api/vehicles/${REL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: { MaxPower: 75 } }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.written).toEqual(["MaxPower"]);
    expect(body.message).toMatch(/reload/i);

    const after = readFileSync(etPath, "utf-8");
    const a = before.split("\n");
    const b = after.split("\n");
    expect(b.length).toBe(a.length);
    expect(b.filter((l, i) => l !== a[i])).toEqual(["     MaxPower 75"]);
    expect(after).toContain("Filenames + {");
    expect(after).toContain("RpmRedline 4200");
  });

  it("POST rejects a traversal path", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/Prefabs/Vehicles/../../../etc/passwd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: { MaxPower: 75 } }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("Invalid");
  });

  it("POST rejects a non-JSON Content-Type", async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/${REL}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ changes: { MaxPower: 75 } }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("Content-Type");
  });

  it("POST rejects an empty or unknown-key changes object", async () => {
    const empty = await fetch(`${baseUrl}/api/vehicles/${REL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: {} }),
    });
    expect(empty.status).toBe(400);

    const bogus = await fetch(`${baseUrl}/api/vehicles/${REL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: { NotAField: 1 } }),
    });
    expect(bogus.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/server.test.ts`
Expected: FAIL — `/api/vehicles` 404s (routes are still `/api/engines`)

- [ ] **Step 3: Rewrite the server's imports, guard, and routes**

In `src/tuning-server/server.ts`, replace the import block at lines 1-11 with:

```typescript
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENGINE_FIELD_KEYS, type EngineFields } from "./engine-conf.js";
import { listTunableVehicles, vehicleEtPath, isSafeVehicleRelPath } from "./discover.js";
import { resolveEngineFields } from "./resolve-engine.js";
import { findEngineBlock, writeEngineFields } from "./et-engine-block.js";
```

Replace `isValidEngineFields` (lines 33-37) and `isSafeFilename` (lines 39-42) with:

```typescript
/** A partial set of engine changes: at least one known key, all finite numbers. */
function isValidEngineChanges(value: unknown): value is Partial<EngineFields> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;
  if (!keys.every((k) => (ENGINE_FIELD_KEYS as string[]).includes(k))) return false;
  return keys.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
}
```

Replace the `RELOAD_REMINDER` constant (lines 44-46) with:

```typescript
const RELOAD_REMINDER =
  "Written to disk. If this vehicle prefab is open in Workbench, reload it — " +
  "Workbench silently reverts external file edits to a prefab it has open.";
```

Replace the whole `createTuningServer` function (lines 48-132) with:

```typescript
export function createTuningServer(addonPath: string, extractedPath?: string): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        const html = readFileSync(TUNER_HTML_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/vehicles") {
        sendJson(res, 200, { status: "ok", vehicles: listTunableVehicles(addonPath) });
        return;
      }

      const match = /^\/api\/vehicles\/(.+)$/.exec(url.pathname);
      if (match && (req.method === "GET" || req.method === "POST")) {
        const rel = decodeURIComponent(match[1]);
        if (!isSafeVehicleRelPath(rel)) {
          sendJson(res, 400, { status: "error", message: "Invalid vehicle path" });
          return;
        }
        const filePath = vehicleEtPath(addonPath, rel);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { status: "error", message: `Not found: ${rel}` });
          return;
        }

        if (req.method === "GET") {
          const modText = readFileSync(filePath, "utf-8");
          const fields = resolveEngineFields({ modText, relPath: rel, extractedPath });
          sendJson(res, 200, { status: "ok", vehicle: rel, fields });
          return;
        }

        const contentType = req.headers["content-type"];
        if (typeof contentType !== "string" || !contentType.toLowerCase().includes("application/json")) {
          sendJson(res, 400, { status: "error", message: "Content-Type must be application/json" });
          return;
        }

        const rawBody = await readBody(req);
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          sendJson(res, 400, { status: "error", message: "Invalid JSON body" });
          return;
        }

        const changes = (parsedBody as { changes?: unknown }).changes;
        if (!isValidEngineChanges(changes)) {
          sendJson(res, 400, {
            status: "error",
            message: `Body must include a "changes" object with at least one numeric field from: ${ENGINE_FIELD_KEYS.join(", ")}`,
          });
          return;
        }

        const original = readFileSync(filePath, "utf-8");
        const loc = findEngineBlock(original);
        if (!loc) {
          sendJson(res, 409, {
            status: "error",
            message:
              `${rel} has no Engine block. Add the engine override in Workbench first — ` +
              `this tool never creates the block structure.`,
          });
          return;
        }

        writeFileSync(filePath, writeEngineFields(original, loc, changes), "utf-8");
        sendJson(res, 200, {
          status: "ok",
          vehicle: rel,
          written: Object.keys(changes),
          message: RELOAD_REMINDER,
        });
        return;
      }

      sendJson(res, 404, { status: "error", message: "Not found" });
    } catch (e) {
      sendJson(res, 500, { status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  });
}
```

- [ ] **Step 4: Pass `extractedPath` through the CLI**

In `src/tuning-server/index.ts`, replace the `createTuningServer(addonPath)` call and the log block with:

```typescript
const server = createTuningServer(addonPath, config.extractedPath);
server.listen(port, "127.0.0.1", () => {
  console.log(`Vehicle tuning server: http://127.0.0.1:${port}`);
  console.log(`  addon:      ${addonName}`);
  console.log(`  path:       ${addonPath}`);
  console.log(`  base data:  ${config.extractedPath ?? "(not configured — inherited values will show as unresolved)"}`);
  console.log(`  Set ENFUSION_TUNING_ADDON to point at a different addon, ENFUSION_TUNING_PORT to change the port.`);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/`
Expected: PASS — 46 tests, all files green (`engine-conf` 5, `et-engine-block` 19, `resolve-engine` 4, `discover` 9, `server` 9).

- [ ] **Step 6: Commit**

```bash
git add src/tuning-server/server.ts src/tuning-server/index.ts tests/tuning-server/server.test.ts
git commit -m "feat(tuning-server): switch HTTP routes from engine confs to vehicle .et files"
```

---

### Task 6: Point the tuner page at vehicles and show field sources

**Files:**
- Modify: `src/tuning-server/public/tuner.html`
- Test: manual (the page's behaviour is browser-side; the server contract it uses is covered by Task 5)

**Interfaces:**
- Consumes: `GET /api/vehicles` → `{status, vehicles: string[]}`; `GET /api/vehicles/<rel>` → `{status, vehicle, fields: Record<field, {value: number|null, source: "overridden"|"inherited"|"unresolved"}>}`; `POST /api/vehicles/<rel>` with `{changes: {...}}`.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Add a source-badge element after each slider's value**

In `src/tuning-server/public/tuner.html`, add this rule to the `<style>` block, after the `.vl` rule:

```css
.src{font-size:9px;letter-spacing:.04em;text-transform:uppercase;min-width:30px;text-align:right;flex-shrink:0}
.src.ovr{color:#378ADD}
.src.inh{color:#6b6762}
.src.unr{color:#BA7517}
```

Then, for each of the 9 slider rows, add a badge span immediately after that row's `<span class="vl" ...>` element. The badge id is the slider id with a `S` suffix. For example the Max Power row becomes:

```html
<div class="sr"><span class="lbl">Max Power (kW)</span><input type="range" id="ePw" min="30" max="600" step="1" value="246" oninput="sE();dE();markTouched('ePw')"><span class="vl" id="ePwV">246</span><span class="src" id="ePwS"></span></div>
```

Do the same for the other eight rows, adding `<span class="src" id="eTqS"></span>`, `eRppS`, `eRptS`, `eIdleS`, `eRmaxS`, `eSteepS`, `eFricS`, `eInerS` respectively. Leave each row's existing `oninput` handler exactly as it already is.

- [ ] **Step 2: Replace the API-wiring JavaScript**

In the `<script>` block, replace everything from `function setSlidersFromFields(fields){` through the final `loadEngineList();` call (the last ~90 lines before `</script>`) with:

```javascript
function setSlidersFromResolved(resolved){
  Object.keys(FIELD_MAP).forEach(function(sliderId){
    var field = FIELD_MAP[sliderId];
    var entry = resolved[field] || { value: null, source: 'unresolved' };
    var badge = el(sliderId + 'S');
    if (entry.value !== null && entry.value !== undefined) {
      el(sliderId).value = entry.value;
    }
    if (entry.source === 'overridden') { badge.className = 'src ovr'; badge.textContent = 'ovr'; }
    else if (entry.source === 'inherited') { badge.className = 'src inh'; badge.textContent = 'inh'; }
    else { badge.className = 'src unr'; badge.textContent = '?'; }
  });
  sE(); dE();
}

// Only fields the user actually dragged are sent, so slider min/max/step
// snapping can never rewrite a value the user did not touch.
function currentChanges(){
  var changes = {};
  Object.keys(FIELD_MAP).forEach(function(sliderId){
    var field = FIELD_MAP[sliderId];
    if (touchedFields[field]) changes[field] = g(sliderId);
  });
  return changes;
}

async function loadVehicleList(){
  var res = await fetch('/api/vehicles');
  var body = await res.json();
  var select = el('engineSelect');
  select.innerHTML = '';
  if (!body.vehicles || body.vehicles.length === 0) {
    select.innerHTML = '<option value="">No tunable vehicles found</option>';
    showBanner('err', 'No vehicle prefab in this addon has an Engine block yet. In Workbench, open the vehicle prefab, expand VehicleWheeledSimulation > Simulation Wheeled, add an Engine override, and save. This tool never creates that structure itself.');
    return;
  }
  body.vehicles.forEach(function(v){
    var opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v.replace('Prefabs/Vehicles/', '');
    select.appendChild(opt);
  });
  select.onchange = function(){ loadVehicle(select.value); };
  loadVehicle(select.value);
}

async function loadVehicle(rel){
  if (!rel) return;
  currentFile = rel;
  el('applyBtn').disabled = true;
  var res = await fetch('/api/vehicles/' + rel.split('/').map(encodeURIComponent).join('/'));
  var body = await res.json();
  if (body.status !== 'ok') {
    showBanner('err', body.message || 'Failed to load ' + rel);
    return;
  }
  loadedFields = body.fields;
  touchedFields = {};
  setSlidersFromResolved(body.fields);
  el('applyBtn').disabled = false;
  var unresolved = Object.keys(body.fields).filter(function(k){ return body.fields[k].source === 'unresolved'; });
  showBanner('ok', 'Loaded ' + rel + '.' + (unresolved.length ? ' Unresolved (shown as ?): ' + unresolved.join(', ') + '. Base game data not found — drag a slider to set one explicitly.' : ''));
}

async function applyValues(){
  if (!currentFile) return;
  var changes = currentChanges();
  if (Object.keys(changes).length === 0) {
    showBanner('err', 'Nothing changed. Drag a slider first — untouched fields are never written.');
    return;
  }
  el('applyBtn').disabled = true;
  var res = await fetch('/api/vehicles/' + currentFile.split('/').map(encodeURIComponent).join('/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: changes }),
  });
  var body = await res.json();
  el('applyBtn').disabled = false;
  if (body.status !== 'ok') {
    showBanner('err', body.message || 'Failed to apply changes');
    return;
  }
  showBanner('ok', 'Wrote ' + (body.written || []).join(', ') + '. ' + body.message);
  loadVehicle(currentFile);
}

sE(); dE();
loadVehicleList();
```

- [ ] **Step 3: Verify the automated suite still passes**

Run: `npx vitest run tests/tuning-server/`
Expected: PASS — 46 tests. The page is not unit-tested, but Task 5's `GET /` test asserts the file is still served and parses as HTML.

- [ ] **Step 4: Manual end-to-end verification**

1. Give a vehicle an Engine block to tune. Edit `RoadForger/Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et` and insert this inside the existing `Simulation Wheeled` block, immediately before its `Gearbox Gearbox Gearbox {` line (matching the file's 4-space indentation at that level):

```
    Engine Engine Engine {
     MaxPower 132
    }
```

2. Start the server:

```bash
cd "C:\Users\Steffen\Documents\A_documents\Github\enfusion-mcp-BK"
npm run tuning-server
```

Confirm it logs the RoadForger addon path and a base-data path.

3. Open `http://127.0.0.1:5790/`. Confirm `Wheeled/Ural4320/Ural4320.et` appears in the dropdown and that `MaxPower` shows `132` with an `ovr` badge while other fields show `inh` (or `?` if the extracted mirror is not configured).

4. Drag the Max Torque slider. Confirm the graph reshapes with no network requests (check the browser devtools Network tab while dragging).

5. Click "Apply to disk". Confirm the banner reports `Wrote MaxTorque` plus the reload reminder.

6. Verify the write was surgical:

```bash
cd "C:\Users\Steffen\Documents\My Games\ArmaReforgerWorkbench\addons\RoadForger"
git diff Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et
```

Expected: the Engine block gained exactly one `MaxTorque` line (or one line changed), and nothing else in the 130-line file differs.

7. Revert the manual edit if you do not want to keep it: `git checkout Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et`

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/public/tuner.html
git commit -m "feat(tuning-server): point tuner page at vehicle .et files with field source badges"
```

---

## Notes for the implementer

- **The riskiest code in this plan is `findEngineBlock`.** Everything else depends on it pointing at the right line range. Task 2 Step 5's byte-fidelity check against a real 1000+ line prefab is the gate that proves it; do not skip it, and stop if it reports more than one differing line.
- **`src/formats/enfusion-text.ts` is off-limits.** It looks like exactly the right tool and it is not — see Global Constraints for the measured failure modes.
- v1's `serializeEngineConf` is now unused by the server but stays exported and tested; it is harmless and keeps `engine-conf.test.ts` green.
