# Vehicle Prefab Component Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, machine-derived map of every component and property in the S105 and BRDM2 vehicle prefab chains, plus a diff engine that catches dangling bone references in a work-in-progress prefab before they reach the engine.

**Architecture:** An offline extractor walks each vehicle's `.et` inheritance chain using the existing parser and chain walker, flattens every component into property paths tagged with the chain level that set them, and records every outward reference (bone, prefab, resource). The resulting JSON is committed under `data/schema/`. Three consumers read it: a contrast generator (S105 vs BRDM2), a documentation generator that emits tier-labeled KB markdown, and a diff engine exposed through the MCP `prefab` tool.

**Tech Stack:** TypeScript (ESM, NodeNext), vitest, zod, `@modelcontextprotocol/sdk`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-29-vehicle-prefab-component-map-design.md`

## Global Constraints

- **Node >= 20**, `"type": "module"`. All relative imports MUST carry the `.js` extension (e.g. `import { parse } from "../formats/enfusion-text.js"`). This is enforced by the TypeScript config; omitting it fails the build.
- **Test command:** `npx vitest run <path>` for a single file, `npm test` for the suite. Tests live under `tests/` mirroring `src/` (e.g. `src/prefab-map/extract.ts` -> `tests/prefab-map/extract.test.ts`).
- **Do not write a second `.et` parser.** Use `parse()` from `src/formats/enfusion-text.ts`.
- **Reuse `src/utils/prefab-ancestry.ts`** — `readEtFile`, `stripGuid`, `parseTopLevelComponents`. Task 4 deliberately does *not* call `walkChain()`: that function keeps each level's components as raw strings, while this feature needs them re-parsed into `EnfusionNode`s for property-level flattening. Task 4 reimplements only the traversal loop, mirroring `walkChain`'s ordering and cycle handling, and reuses everything else. Do not duplicate any other part of that module.
- **Bone names are copied verbatim.** Shipped assets contain load-bearing typos (`passangerL_idle`, `passangerR_getIn`). Never normalize, correct, or case-fold a bone name anywhere in this feature.
- **No inferred prose.** Any generated documentation entry that is neither derived from the corpus nor cited to `data/api/arma-classes.json` MUST carry the literal string `UNDOCUMENTED`.
- **Tests run against committed fixtures**, never against the developer's live `extractedPath`. Only `scripts/build-prefab-map.ts` reads the live corpus.
- **Scope is exactly two vehicles:** S105 and BRDM2. Do not generalize to other vehicles, helicopters, or boats.
- **No git commits** unless the plan step says to commit; commit steps are included per task.

---

### Task 1: Property tree flattening

Turn a parsed `EnfusionNode` component into a flat map of dotted property paths to values. This is the primitive every later task builds on.

**Files:**
- Create: `src/prefab-map/types.ts`
- Create: `src/prefab-map/property-tree.ts`
- Test: `tests/prefab-map/property-tree.test.ts`

**Interfaces:**
- Consumes: `EnfusionNode`, `parse` from `src/formats/enfusion-text.ts`.
- Produces:
  - `type PropertyPath = string` — dotted path, array indices in brackets, e.g. `Wheels[0].SoundPoint.PivotID`
  - `interface PropertyLeaf { path: PropertyPath; value: string; nodeType?: string }`
  - `function flattenComponent(node: EnfusionNode): PropertyLeaf[]`

- [ ] **Step 1: Write the failing test**

Create `tests/prefab-map/property-tree.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parse } from "../../src/formats/enfusion-text.js";
import { flattenComponent } from "../../src/prefab-map/property-tree.js";

describe("flattenComponent", () => {
  it("flattens a flat component to dotted paths", () => {
    const node = parse(`SCR_FuelManagerComponent "{5622A70CD78A9E2C}" {
 MaxFuel 60
 FuelTankName "tank_main"
}`);
    expect(flattenComponent(node)).toEqual([
      { path: "MaxFuel", value: "60" },
      { path: "FuelTankName", value: "tank_main" },
    ]);
  });

  it("flattens nested blocks with dotted paths", () => {
    const node = parse(`SCR_VehicleSoundComponent "{55C2E66AD4EF2CA6}" {
 SoundPoints {
  SoundPointInfo Engine {
   Offset 0 1.5 -1.1
  }
 }
}`);
    const leaves = flattenComponent(node);
    expect(leaves).toContainEqual({
      path: "SoundPoints.SoundPointInfo[0].Offset",
      value: "0 1.5 -1.1",
      nodeType: "SoundPointInfo",
    });
  });

  it("indexes repeated sibling blocks of the same type", () => {
    const node = parse(`Wheels {
 VehicleWheelSound L_01 {
  SoundPoint PointInfo "{58F8DC78283E1FE5}" {
   PivotID "v_wheel_l01"
  }
 }
 VehicleWheelSound R_01 {
  SoundPoint PointInfo "{58F8DC78283E1FFD}" {
   PivotID "v_wheel_r01"
  }
 }
}`);
    const paths = flattenComponent(node).map((l) => l.path);
    expect(paths).toContain("VehicleWheelSound[0].SoundPoint.PivotID");
    expect(paths).toContain("VehicleWheelSound[1].SoundPoint.PivotID");
  });

  it("preserves a shipped typo in a bone name verbatim", () => {
    const node = parse(`PointInfo "{1}" {
 PivotID "passangerL_idle"
}`);
    expect(flattenComponent(node)[0].value).toBe("passangerL_idle");
  });

  it("records standalone quoted values under a [value] index", () => {
    const node = parse(`Filenames {
 "{994DA84C543C990A}Sounds/A.acp" "{5B2A3941F79B5F0F}Sounds/B.acp"
}`);
    const leaves = flattenComponent(node);
    expect(leaves.map((l) => l.path)).toEqual(["[value][0]", "[value][1]"]);
    expect(leaves[1].value).toBe("{5B2A3941F79B5F0F}Sounds/B.acp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/property-tree.test.ts`
Expected: FAIL — cannot resolve `../../src/prefab-map/property-tree.js`.

- [ ] **Step 3: Write the types**

Create `src/prefab-map/types.ts`:

```typescript
// src/prefab-map/types.ts
// Shared types for the vehicle prefab component map.
// See docs/superpowers/specs/2026-08-29-vehicle-prefab-component-map-design.md

/** Dotted property path within a component. Repeated sibling blocks are indexed. */
export type PropertyPath = string;

/** A single leaf value inside a component's property tree. */
export interface PropertyLeaf {
  path: PropertyPath;
  value: string;
  /** Block type name, when the leaf sits inside a typed sub-block. */
  nodeType?: string;
}
```

- [ ] **Step 4: Write the flattener**

Create `src/prefab-map/property-tree.ts`:

```typescript
// src/prefab-map/property-tree.ts
import type { EnfusionNode } from "../formats/enfusion-text.js";
import type { PropertyLeaf } from "./types.js";

/**
 * Flatten a parsed component node into dotted property paths.
 *
 * Repeated sibling blocks of the same type are indexed (`Wheels[0]`, `Wheels[1]`)
 * so two wheels with the same structure stay distinguishable. Standalone quoted
 * values (Enfusion arrays such as `Filenames`) land under `[value][n]`.
 *
 * Values are copied verbatim — shipped assets contain load-bearing typos in bone
 * names and correcting them would break the very lookups this map exists to check.
 */
export function flattenComponent(node: EnfusionNode): PropertyLeaf[] {
  const out: PropertyLeaf[] = [];
  walk(node, "", undefined, out);
  return out;
}

function join(prefix: string, segment: string): string {
  return prefix === "" ? segment : `${prefix}.${segment}`;
}

function walk(
  node: EnfusionNode,
  prefix: string,
  nodeType: string | undefined,
  out: PropertyLeaf[],
): void {
  for (const prop of node.properties) {
    if (typeof prop.value === "string") {
      out.push(leaf(join(prefix, prop.key), prop.value, nodeType));
    } else {
      walk(prop.value, join(prefix, prop.key), prop.value.type || nodeType, out);
    }
  }

  node.values.forEach((v, i) => {
    out.push(leaf(join(prefix, `[value][${i}]`), v, nodeType));
  });

  // Index children by type so repeated siblings get stable distinct paths.
  const seen = new Map<string, number>();
  for (const child of node.children) {
    const type = child.type;
    const idx = seen.get(type) ?? 0;
    seen.set(type, idx + 1);
    walk(child, join(prefix, `${type}[${idx}]`), type, out);
  }
}

function leaf(path: string, value: string, nodeType: string | undefined): PropertyLeaf {
  return nodeType === undefined ? { path, value } : { path, value, nodeType };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/property-tree.test.ts`
Expected: PASS, 5 tests.

If the `[value][0]` test fails because `parse()` puts the two quoted strings somewhere other than `node.values`, inspect the actual parse output with a temporary `console.log(JSON.stringify(parse(input), null, 2))` and adjust the *test's* expected path to match reality — the parser is the source of truth here, not this plan's guess about it. Do not change the parser.

- [ ] **Step 6: Commit**

```bash
git add src/prefab-map/types.ts src/prefab-map/property-tree.ts tests/prefab-map/property-tree.test.ts
git commit -m "feat(prefab-map): flatten component nodes into dotted property paths"
```

---

### Task 2: Chain merge with per-property provenance

Merge property trees down the inheritance chain so every final value records which `.et` file set it, and which values it shadowed.

**Files:**
- Create: `src/prefab-map/chain-merge.ts`
- Modify: `src/prefab-map/types.ts`
- Test: `tests/prefab-map/chain-merge.test.ts`

**Interfaces:**
- Consumes: `PropertyLeaf`, `flattenComponent` from Task 1.
- Produces:
  - `interface ResolvedProperty { path: PropertyPath; value: string; nodeType?: string; setBy: string; overrides: { value: string; from: string }[] }`
  - `interface ResolvedComponent { typeName: string; properties: ResolvedProperty[]; introducedBy: string }`
  - `interface ChainLevelInput { path: string; components: { typeName: string; node: EnfusionNode }[] }`
  - `function mergeChain(levels: ChainLevelInput[]): ResolvedComponent[]` — `levels` ordered oldest ancestor first, matching `walkChain()` output order.

- [ ] **Step 1: Add types**

Add this import at the **top** of `src/prefab-map/types.ts`, above the existing type declarations:

```typescript
import type { EnfusionNode } from "../formats/enfusion-text.js";
```

Then append the new types to the end of the file:

```typescript
/** A property value after chain resolution, with provenance. */
export interface ResolvedProperty {
  path: PropertyPath;
  value: string;
  nodeType?: string;
  /** The `.et` file whose value won. */
  setBy: string;
  /** Values this one shadowed, oldest ancestor first. */
  overrides: { value: string; from: string }[];
}

/** A component after chain resolution. */
export interface ResolvedComponent {
  typeName: string;
  properties: ResolvedProperty[];
  /** The `.et` file that first declared this component. */
  introducedBy: string;
}

/** One level of an inheritance chain, oldest ancestor first. */
export interface ChainLevelInput {
  path: string;
  components: { typeName: string; node: EnfusionNode }[];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/chain-merge.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parse } from "../../src/formats/enfusion-text.js";
import { mergeChain } from "../../src/prefab-map/chain-merge.js";
import type { ChainLevelInput } from "../../src/prefab-map/types.js";

function level(path: string, ...comps: string[]): ChainLevelInput {
  return {
    path,
    components: comps.map((src) => {
      const node = parse(src);
      return { typeName: node.type, node };
    }),
  };
}

describe("mergeChain", () => {
  it("keeps the descendant's value and records what it shadowed", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 40 }`),
      level("S105_base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 60 }`),
    ]);
    const maxFuel = merged[0].properties.find((p) => p.path === "MaxFuel");
    expect(maxFuel).toEqual({
      path: "MaxFuel",
      value: "60",
      setBy: "S105_base.et",
      overrides: [{ value: "40", from: "Vehicle_Base.et" }],
    });
  });

  it("marks an untouched inherited property as set by the ancestor", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 40 }`),
      level("S105_base.et", `SCR_FuelManagerComponent "{1}" { FuelTankName "t" }`),
    ]);
    const maxFuel = merged[0].properties.find((p) => p.path === "MaxFuel");
    expect(maxFuel?.setBy).toBe("Vehicle_Base.et");
    expect(maxFuel?.overrides).toEqual([]);
  });

  it("records where a component was first introduced", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `MeshObject "{1}" { Object "a.xob" }`),
      level("BRDM2_base.et", `MeshObject "{1}" { Object "b.xob" }`, `SlotManagerComponent "{2}" { Slots {} }`),
    ]);
    const byName = Object.fromEntries(merged.map((c) => [c.typeName, c.introducedBy]));
    expect(byName["MeshObject"]).toBe("Vehicle_Base.et");
    expect(byName["SlotManagerComponent"]).toBe("BRDM2_base.et");
  });

  it("chains three levels of overrides in ancestor order", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `RigidBody "{1}" { Mass 1000 }`),
      level("Wheeled_Base.et", `RigidBody "{1}" { Mass 1500 }`),
      level("S105_base.et", `RigidBody "{1}" { Mass 1200 }`),
    ]);
    const mass = merged[0].properties.find((p) => p.path === "Mass");
    expect(mass?.value).toBe("1200");
    expect(mass?.setBy).toBe("S105_base.et");
    expect(mass?.overrides).toEqual([
      { value: "1000", from: "Vehicle_Base.et" },
      { value: "1500", from: "Wheeled_Base.et" },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/chain-merge.test.ts`
Expected: FAIL — cannot resolve `chain-merge.js`.

- [ ] **Step 4: Write the implementation**

Create `src/prefab-map/chain-merge.ts`:

```typescript
// src/prefab-map/chain-merge.ts
import { flattenComponent } from "./property-tree.js";
import type { ChainLevelInput, ResolvedComponent, ResolvedProperty } from "./types.js";

interface Accum {
  introducedBy: string;
  props: Map<string, ResolvedProperty>;
}

/**
 * Merge components down an inheritance chain, oldest ancestor first.
 *
 * Provenance is tracked per property, not per component: a descendant that changes
 * one field of a large component leaves every other field attributed to the
 * ancestor that set it. That granularity is the whole point — a bone name still
 * pointing at a donor rig is exactly a property whose `setBy` is an ancestor when
 * it should have been overridden.
 */
export function mergeChain(levels: ChainLevelInput[]): ResolvedComponent[] {
  const acc = new Map<string, Accum>();

  for (const level of levels) {
    for (const { typeName, node } of level.components) {
      let entry = acc.get(typeName);
      if (!entry) {
        entry = { introducedBy: level.path, props: new Map() };
        acc.set(typeName, entry);
      }

      for (const leaf of flattenComponent(node)) {
        const existing = entry.props.get(leaf.path);
        if (!existing) {
          entry.props.set(leaf.path, {
            path: leaf.path,
            value: leaf.value,
            ...(leaf.nodeType === undefined ? {} : { nodeType: leaf.nodeType }),
            setBy: level.path,
            overrides: [],
          });
          continue;
        }
        if (existing.value === leaf.value) {
          // Restated identically; the older attribution stays correct.
          continue;
        }
        existing.overrides.push({ value: existing.value, from: existing.setBy });
        existing.value = leaf.value;
        existing.setBy = level.path;
        if (leaf.nodeType !== undefined) existing.nodeType = leaf.nodeType;
      }
    }
  }

  return Array.from(acc.entries()).map(([typeName, entry]) => ({
    typeName,
    introducedBy: entry.introducedBy,
    properties: Array.from(entry.props.values()),
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/chain-merge.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/prefab-map/chain-merge.ts src/prefab-map/types.ts tests/prefab-map/chain-merge.test.ts
git commit -m "feat(prefab-map): merge inheritance chain with per-property provenance"
```

---

### Task 3: Reference edges and bone surface

Classify every resolved property value that points outward, and build the deduplicated bone surface with full referencing sites.

**Files:**
- Create: `src/prefab-map/references.ts`
- Modify: `src/prefab-map/types.ts`
- Test: `tests/prefab-map/references.test.ts`

**Interfaces:**
- Consumes: `ResolvedComponent`, `ResolvedProperty` from Task 2.
- Produces:
  - `type ReferenceKind = "bone" | "prefab" | "resource"`
  - `interface ReferenceEdge { component: string; propertyPath: PropertyPath; kind: ReferenceKind; target: string; setBy: string }`
  - `interface BoneSite { component: string; propertyPath: PropertyPath; setBy: string }`
  - `interface BoneSurface { bone: string; sites: BoneSite[] }`
  - `function extractReferences(components: ResolvedComponent[]): ReferenceEdge[]`
  - `function buildBoneSurface(edges: ReferenceEdge[]): BoneSurface[]`
  - `const BONE_BEARING_KEYS: readonly string[]`

- [ ] **Step 1: Add types**

Append to `src/prefab-map/types.ts`:

```typescript
export type ReferenceKind = "bone" | "prefab" | "resource";

/** A property value that points outside the component. */
export interface ReferenceEdge {
  component: string;
  propertyPath: PropertyPath;
  kind: ReferenceKind;
  target: string;
  setBy: string;
}

/** One place a bone name is referenced from. */
export interface BoneSite {
  component: string;
  propertyPath: PropertyPath;
  setBy: string;
}

/** Every bone the prefab expects, with all sites referencing it. */
export interface BoneSurface {
  bone: string;
  sites: BoneSite[];
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/references.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractReferences, buildBoneSurface } from "../../src/prefab-map/references.js";
import type { ResolvedComponent } from "../../src/prefab-map/types.js";

function comp(typeName: string, props: [string, string][]): ResolvedComponent {
  return {
    typeName,
    introducedBy: "S105_base.et",
    properties: props.map(([path, value]) => ({
      path,
      value,
      setBy: "S105_base.et",
      overrides: [],
    })),
  };
}

describe("extractReferences", () => {
  it("classifies a PivotID as a bone reference", () => {
    const edges = extractReferences([
      comp("SCR_VehicleSoundComponent", [["Wheels.VehicleWheelSound[0].SoundPoint.PivotID", "v_wheel_l01"]]),
    ]);
    expect(edges).toEqual([
      {
        component: "SCR_VehicleSoundComponent",
        propertyPath: "Wheels.VehicleWheelSound[0].SoundPoint.PivotID",
        kind: "bone",
        target: "v_wheel_l01",
        setBy: "S105_base.et",
      },
    ]);
  });

  it("classifies a GUID-prefixed .et value as a prefab reference and strips the GUID", () => {
    const edges = extractReferences([
      comp("SlotManagerComponent", [["Slots.EntitySlotInfo[0].Prefab", "{ABCDEF0123456789}Prefabs/Vehicles/Wheeled/S105/VehParts/Wheels/S105_wheel_01.et"]]),
    ]);
    expect(edges[0].kind).toBe("prefab");
    expect(edges[0].target).toBe("Prefabs/Vehicles/Wheeled/S105/VehParts/Wheels/S105_wheel_01.et");
  });

  it("classifies asset extensions as resource references", () => {
    const edges = extractReferences([
      comp("MeshObject", [["Object", "{1111111111111111}Assets/Vehicles/S105/S105.xob"]]),
      comp("SCR_VehicleSoundComponent", [["Filenames.[value][0]", "{2222222222222222}Sounds/S105.acp"]]),
      comp("VehicleAnimationComponent", [["AnimationGraph", "{3333333333333333}Animation/S105.agf"]]),
    ]);
    expect(edges.map((e) => e.kind)).toEqual(["resource", "resource", "resource"]);
  });

  it("ignores a plain value that references nothing", () => {
    expect(extractReferences([comp("RigidBody", [["Mass", "1200"]])])).toEqual([]);
  });

  it("ignores an empty PivotID rather than emitting an empty bone", () => {
    const edges = extractReferences([comp("SlotManagerComponent", [["Slots.EntitySlotInfo[0].PivotID", ""]])]);
    expect(edges).toEqual([]);
  });

  it("keeps a shipped typo bone name verbatim", () => {
    const edges = extractReferences([
      comp("SCR_BaseCompartmentManagerComponent", [["Compartments.PointInfo[0].PivotID", "passangerL_idle"]]),
    ]);
    expect(edges[0].target).toBe("passangerL_idle");
  });
});

describe("buildBoneSurface", () => {
  it("dedups a bone and lists every referencing site", () => {
    const surface = buildBoneSurface([
      { component: "A", propertyPath: "p1", kind: "bone", target: "v_body", setBy: "Vehicle_Base.et" },
      { component: "B", propertyPath: "p2", kind: "bone", target: "v_body", setBy: "S105_base.et" },
      { component: "C", propertyPath: "p3", kind: "prefab", target: "x.et", setBy: "S105_base.et" },
    ]);
    expect(surface).toEqual([
      {
        bone: "v_body",
        sites: [
          { component: "A", propertyPath: "p1", setBy: "Vehicle_Base.et" },
          { component: "B", propertyPath: "p2", setBy: "S105_base.et" },
        ],
      },
    ]);
  });

  it("sorts bones by name for stable golden output", () => {
    const surface = buildBoneSurface([
      { component: "A", propertyPath: "p", kind: "bone", target: "v_wheel", setBy: "x.et" },
      { component: "A", propertyPath: "q", kind: "bone", target: "v_body", setBy: "x.et" },
    ]);
    expect(surface.map((s) => s.bone)).toEqual(["v_body", "v_wheel"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/references.test.ts`
Expected: FAIL — cannot resolve `references.js`.

- [ ] **Step 4: Write the implementation**

Create `src/prefab-map/references.ts`:

```typescript
// src/prefab-map/references.ts
import type {
  BoneSite,
  BoneSurface,
  ReferenceEdge,
  ResolvedComponent,
} from "./types.js";

/**
 * Property keys confirmed to hold a rig bone name.
 *
 * `PivotID` dominates by a wide margin in the S105 and BRDM2 chains. This list is
 * the audited set for those two vehicles, not a guess at the engine's full surface:
 * Task 4 asserts that no key outside this list holds a value matching a known bone,
 * so the list stays honest as the corpus is walked.
 */
export const BONE_BEARING_KEYS: readonly string[] = ["PivotID"];

const GUID_PREFIX = /^\{[0-9A-Fa-f]{16}\}/;
const RESOURCE_EXTENSIONS = [".xob", ".acp", ".agf", ".agr", ".asi", ".emat", ".ptc", ".txo"];

function lastSegment(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path : path.slice(dot + 1);
}

/**
 * Classify every resolved property value that points outside its component.
 * Values that reference nothing produce no edge.
 */
export function extractReferences(components: ResolvedComponent[]): ReferenceEdge[] {
  const edges: ReferenceEdge[] = [];

  for (const component of components) {
    for (const prop of component.properties) {
      const kindAndTarget = classify(prop.path, prop.value);
      if (!kindAndTarget) continue;
      edges.push({
        component: component.typeName,
        propertyPath: prop.path,
        kind: kindAndTarget.kind,
        target: kindAndTarget.target,
        setBy: prop.setBy,
      });
    }
  }

  return edges;
}

function classify(
  path: string,
  value: string,
): { kind: ReferenceEdge["kind"]; target: string } | null {
  if (value === "") return null;

  const key = lastSegment(path);
  if (BONE_BEARING_KEYS.includes(key)) {
    return { kind: "bone", target: value };
  }

  const stripped = value.replace(GUID_PREFIX, "");
  const lower = stripped.toLowerCase();

  if (lower.endsWith(".et")) return { kind: "prefab", target: stripped };
  if (RESOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { kind: "resource", target: stripped };
  }

  return null;
}

/**
 * Collapse bone edges into the deduplicated set of bones the prefab expects,
 * each carrying every site that references it. A single missing bone therefore
 * shows all the places that will silently misbehave, which is the information the
 * old set-based check threw away.
 */
export function buildBoneSurface(edges: ReferenceEdge[]): BoneSurface[] {
  const byBone = new Map<string, BoneSite[]>();

  for (const edge of edges) {
    if (edge.kind !== "bone") continue;
    const sites = byBone.get(edge.target) ?? [];
    sites.push({
      component: edge.component,
      propertyPath: edge.propertyPath,
      setBy: edge.setBy,
    });
    byBone.set(edge.target, sites);
  }

  return Array.from(byBone.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bone, sites]) => ({ bone, sites }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/references.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/prefab-map/references.ts src/prefab-map/types.ts tests/prefab-map/references.test.ts
git commit -m "feat(prefab-map): classify reference edges and build bone surface"
```

---

### Task 4: Extractor, fixtures, and build script

Wire Tasks 1-3 into a whole-vehicle extractor, commit the corpus fixtures, and add the CLI that regenerates the committed schema from the live extracted directory.

**Files:**
- Create: `src/prefab-map/extract.ts`
- Create: `scripts/build-prefab-map.ts`
- Create: `tests/fixtures/prefab-map/` (copied `.et` files, see Step 1)
- Test: `tests/prefab-map/extract.test.ts`
- Modify: `package.json` (add script)
- Modify: `src/prefab-map/types.ts`

**Interfaces:**
- Consumes: `mergeChain` (Task 2), `extractReferences` / `buildBoneSurface` / `BONE_BEARING_KEYS` (Task 3), `walkChain` and `parseTopLevelComponents` from `src/utils/prefab-ancestry.js`, `parse` from `src/formats/enfusion-text.js`.
- Produces:
  - `interface VehicleSchema { vehicle: string; rootPath: string; chain: string[]; components: ResolvedComponent[]; references: ReferenceEdge[]; boneSurface: BoneSurface[]; unparsed: { path: string; reason: string }[] }`
  - `function extractVehicle(rootPath: string, config: Config, opts?: { readFile?: (p: string) => string | null }): VehicleSchema`

- [ ] **Step 1: Copy the fixture corpus**

The live corpus lives at `<extractedPath>/Prefabs/Vehicles/`, conventionally
`C:/Users/Steffen/Documents/My Games/ArmaReforgerWorkbench/extracted`.

Run from the repo root (Git Bash):

```bash
E="C:/Users/Steffen/Documents/My Games/ArmaReforgerWorkbench/extracted"
D=tests/fixtures/prefab-map/Prefabs/Vehicles
mkdir -p "$D/Core" "$D/Wheeled/S105/VehParts/Wheels" "$D/Wheeled/BRDM2/VehParts/Turrets" "$D/Wheeled/BRDM2/VehParts/Wheels"
cp "$E/Prefabs/Vehicles/Core/Vehicle_Base.et" "$D/Core/"
cp "$E/Prefabs/Vehicles/Core/Wheeled_Base.et" "$D/Core/"
cp "$E/Prefabs/Vehicles/Core/Wheeled_Car_Base.et" "$D/Core/"
cp "$E/Prefabs/Vehicles/Core/Wheeled_APC_Base.et" "$D/Core/"
cp "$E/Prefabs/Vehicles/Wheeled/S105/S105_base.et" "$D/Wheeled/S105/"
cp "$E/Prefabs/Vehicles/Wheeled/S105/VehParts/Wheels/S105_wheel_01.et" "$D/Wheeled/S105/VehParts/Wheels/"
cp "$E/Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et" "$D/Wheeled/BRDM2/"
cp "$E/Prefabs/Vehicles/Wheeled/BRDM2/VehParts/Turrets/BRDM2_turret.et" "$D/Wheeled/BRDM2/VehParts/Turrets/"
cp "$E/Prefabs/Vehicles/Wheeled/BRDM2/VehParts/Turrets/BRDM2_turret_commander.et" "$D/Wheeled/BRDM2/VehParts/Turrets/"
cp "$E/Prefabs/Vehicles/Wheeled/BRDM2/VehParts/Wheels/BRDM2_wheel_base.et" "$D/Wheeled/BRDM2/VehParts/Wheels/"
find tests/fixtures/prefab-map -name '*.et' | wc -l   # expect 10
```

If `Vehicle_Base.et` has a parent of its own, copy that ancestor too and add it to
the expected chain in the tests below. Check with:

```bash
head -1 "$E/Prefabs/Vehicles/Core/Vehicle_Base.et"
```

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/extract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractVehicle } from "../../src/prefab-map/extract.js";
import type { Config } from "../../src/config.js";

const FIXTURES = resolve(__dirname, "../fixtures/prefab-map");

/** Read fixtures instead of the developer's live extracted directory. */
function fixtureReader(path: string): string | null {
  const full = join(FIXTURES, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

const config = {} as Config;

describe("extractVehicle — S105", () => {
  const schema = extractVehicle("Prefabs/Vehicles/Wheeled/S105/S105_base.et", config, {
    readFile: fixtureReader,
  });

  it("resolves the full chain oldest ancestor first", () => {
    expect(schema.chain).toEqual([
      "Prefabs/Vehicles/Core/Vehicle_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Car_Base.et",
      "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
    ]);
  });

  it("parses every file without leaving anything unparsed", () => {
    expect(schema.unparsed).toEqual([]);
  });

  it("attributes an inherited component to the ancestor that introduced it", () => {
    const rigidBody = schema.components.find((c) => c.typeName === "RigidBody");
    expect(rigidBody).toBeDefined();
    expect(rigidBody!.introducedBy).toBe("Prefabs/Vehicles/Core/Vehicle_Base.et");
  });

  it("includes the crew pivot bones with their shipped typos intact", () => {
    const bones = schema.boneSurface.map((b) => b.bone);
    expect(bones).toContain("driver_idle");
    expect(bones).toContain("passangerL_idle");
  });

  it("lists every site that references a shared bone", () => {
    const vBody = schema.boneSurface.find((b) => b.bone === "v_body");
    expect(vBody).toBeDefined();
    expect(vBody!.sites.length).toBeGreaterThan(1);
  });
});

describe("extractVehicle — BRDM2", () => {
  const schema = extractVehicle("Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et", config, {
    readFile: fixtureReader,
  });

  it("resolves the APC chain", () => {
    expect(schema.chain).toEqual([
      "Prefabs/Vehicles/Core/Vehicle_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_APC_Base.et",
      "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
    ]);
  });

  it("records the turret prefabs as prefab references", () => {
    const turrets = schema.references.filter(
      (r) => r.kind === "prefab" && r.target.includes("Turrets/"),
    );
    expect(turrets.length).toBeGreaterThan(0);
  });

  it("covers all four road wheels in the bone surface", () => {
    const bones = schema.boneSurface.map((b) => b.bone);
    for (const b of ["v_wheel_L01", "v_wheel_L02", "v_wheel_R01", "v_wheel_R02"]) {
      expect(bones).toContain(b);
    }
  });
});

describe("extractVehicle — failure modes", () => {
  it("throws naming the file when the root prefab cannot be read", () => {
    expect(() =>
      extractVehicle("Prefabs/Vehicles/Wheeled/Nope/Nope.et", config, { readFile: () => null }),
    ).toThrow(/Prefabs\/Vehicles\/Wheeled\/Nope\/Nope\.et/);
  });

  it("throws naming the missing ancestor rather than emitting a partial schema", () => {
    const onlyChild = (p: string) =>
      p.endsWith("S105_base.et") ? fixtureReader(p) : null;
    expect(() =>
      extractVehicle("Prefabs/Vehicles/Wheeled/S105/S105_base.et", config, { readFile: onlyChild }),
    ).toThrow(/Wheeled_Car_Base\.et/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/extract.test.ts`
Expected: FAIL — cannot resolve `extract.js`.

- [ ] **Step 4: Add the schema type**

Append to `src/prefab-map/types.ts`:

```typescript
/** The complete derived map for one vehicle. */
export interface VehicleSchema {
  /** Short name, e.g. "S105". */
  vehicle: string;
  /** Corpus-relative path of the leaf prefab. */
  rootPath: string;
  /** Inheritance chain, oldest ancestor first, leaf last. */
  chain: string[];
  components: ResolvedComponent[];
  references: ReferenceEdge[];
  boneSurface: BoneSurface[];
  /** Content the parser could not turn into properties. Must be empty. */
  unparsed: { path: string; reason: string }[];
}
```

- [ ] **Step 5: Write the extractor**

Create `src/prefab-map/extract.ts`:

```typescript
// src/prefab-map/extract.ts
import { basename } from "node:path";
import { parse } from "../formats/enfusion-text.js";
import { parseTopLevelComponents, readEtFile, stripGuid } from "../utils/prefab-ancestry.js";
import type { Config } from "../config.js";
import { mergeChain } from "./chain-merge.js";
import { buildBoneSurface, extractReferences } from "./references.js";
import type { ChainLevelInput, VehicleSchema } from "./types.js";

export interface ExtractOptions {
  /**
   * Corpus reader override. Tests pass a fixture reader so the suite never depends
   * on the developer's live extracted directory.
   */
  readFile?: (path: string) => string | null;
  projectPath?: string;
}

/**
 * Build the complete derived map for one vehicle.
 *
 * Walks the inheritance chain by hand rather than through `walkChain()` because
 * this needs each level's raw content re-parsed into `EnfusionNode`s for
 * property-level flattening, where `walkChain` keeps components as raw strings.
 * Chain traversal order and cycle handling mirror `walkChain` deliberately.
 */
export function extractVehicle(
  rootPath: string,
  config: Config,
  opts: ExtractOptions = {},
): VehicleSchema {
  const read =
    opts.readFile ?? ((p: string) => readEtFile(p, config, opts.projectPath));

  const levels: ChainLevelInput[] = [];
  const unparsed: { path: string; reason: string }[] = [];
  const visited = new Set<string>();

  // Walk leaf -> ancestor, collecting content, then reverse so oldest is first.
  const stack: string[] = [];
  let current: string | null = stripGuid(rootPath);

  while (current !== null) {
    const key = current.toLowerCase();
    if (visited.has(key)) {
      throw new Error(`Inheritance cycle at ${current}`);
    }
    visited.add(key);

    const content = read(current);
    if (content === null) {
      throw new Error(
        `Could not read prefab: ${current}. ` +
          `Check config.extractedPath points at the extracted game data directory.`,
      );
    }

    stack.push(current);
    const node = parse(content);
    const comps = parseTopLevelComponents(content);

    const components: ChainLevelInput["components"] = [];
    for (const [, comp] of comps) {
      try {
        components.push({
          typeName: comp.typeName,
          node: parse(`${comp.typeName} "{${comp.guid}}" {${comp.rawBody}}`),
        });
      } catch (err) {
        unparsed.push({
          path: `${current}#${comp.typeName}`,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    levels.push({ path: current, components });
    current = node.inheritance === undefined ? null : stripGuid(node.inheritance);
  }

  levels.reverse();
  stack.reverse();

  const components = mergeChain(levels);
  const references = extractReferences(components);

  return {
    vehicle: basename(stripGuid(rootPath), ".et").replace(/_base$/i, ""),
    rootPath: stripGuid(rootPath),
    chain: stack,
    components,
    references,
    boneSurface: buildBoneSurface(references),
    unparsed,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/extract.test.ts`
Expected: PASS, 10 tests.

Two likely real failures, both of which mean the plan guessed and reality differs — fix the *code or test to match reality*, never the fixture:

- The chain assertion fails because `Vehicle_Base.et` has an ancestor. Add it to the expected chain and copy the fixture.
- `parse()` rejects the re-wrapped component string. If so, drop the re-parse and instead locate each top-level component as a child of the already-parsed document node, matching on `type` — the document parse already contains them.

- [ ] **Step 7: Add the build script**

Create `scripts/build-prefab-map.ts`:

```typescript
// scripts/build-prefab-map.ts
// Regenerates data/schema/*.json from the live extracted corpus.
// Run: npm run build:prefab-map
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { extractVehicle } from "../src/prefab-map/extract.js";

const VEHICLES: { name: string; path: string }[] = [
  { name: "s105", path: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" },
  { name: "brdm2", path: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et" },
];

const config = loadConfig();
if (!config.extractedPath) {
  console.error(
    "extractedPath is not configured. Set ENFUSION_EXTRACTED_PATH or place the " +
      "extracted directory beside the addons directory.",
  );
  process.exit(1);
}

const outDir = resolve("data/schema");
mkdirSync(outDir, { recursive: true });

for (const { name, path } of VEHICLES) {
  const schema = extractVehicle(path, config);
  if (schema.unparsed.length > 0) {
    console.error(`${name}: ${schema.unparsed.length} unparsed entries`);
    for (const u of schema.unparsed) console.error(`  ${u.path}: ${u.reason}`);
    process.exit(1);
  }
  const file = resolve(outDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  console.log(
    `${name}: ${schema.components.length} components, ` +
      `${schema.boneSurface.length} bones, ${schema.references.length} references -> ${file}`,
  );
}
```

Add to `package.json` `scripts`, after `"scrape:local"`:

```json
    "build:prefab-map": "tsx scripts/build-prefab-map.ts",
```

- [ ] **Step 8: Run the build script against the live corpus**

Run: `npm run build:prefab-map`
Expected: two lines of output, and `data/schema/s105.json` + `data/schema/brdm2.json` written. Component counts should be in the low forties for each. If it exits non-zero on unparsed entries, fix the extractor — an unparsed list is a hard failure by design.

- [ ] **Step 9: Audit the bone-bearing key list**

The `BONE_BEARING_KEYS` list from Task 3 claims `PivotID` is the only bone-holding key in these two chains. Verify against the generated schema:

```bash
node -e "const s=require('./data/schema/s105.json');const bones=new Set(s.boneSurface.map(b=>b.bone));const suspects=s.components.flatMap(c=>c.properties.filter(p=>bones.has(p.value)&&!p.path.endsWith('PivotID')).map(p=>c.typeName+' '+p.path+' = '+p.value));console.log(suspects.length?suspects.join('\n'):'clean')"
```

Expected: `clean`. If any lines print, those keys hold bone names too — add each to `BONE_BEARING_KEYS` in `src/prefab-map/references.ts`, add a test in `tests/prefab-map/references.test.ts` asserting that key classifies as `"bone"`, and rerun `npm run build:prefab-map`. Repeat until clean. Run the same check against `brdm2.json`.

- [ ] **Step 10: Verify coverage against the spec's measured counts**

The spec's success criterion 1 is that all 44 components and 513 distinct property
keys in the two chains appear in the schema. Those numbers were measured directly
from the corpus. Check the extractor reproduces them:

```bash
node -e "
const s=require('./data/schema/s105.json'), b=require('./data/schema/brdm2.json');
const comps=new Set([...s.components,...b.components].map(c=>c.typeName));
const keys=new Set();
for(const c of [...s.components,...b.components])
  for(const p of c.properties)
    for(const seg of p.path.split('.')) keys.add(seg.replace(/\[.*\]\$/,''));
console.log('distinct components: '+comps.size+' (spec measured 44)');
console.log('distinct property keys: '+keys.size+' (spec measured 513)');
"
```

Expected: components exactly 44. The property-key count is measured a different way
here (path segments, after index stripping) than the spec's raw `grep` over the six
files, so an exact 513 is not required — but it should land close. A count far below
513 means the flattener is dropping content; investigate before continuing. Record
both numbers in the commit message.

- [ ] **Step 11: Run the full suite**

Run: `npm test`
Expected: PASS. The pre-existing `integration-m151a2` failure is known and expected; nothing else may fail.

- [ ] **Step 12: Commit**

```bash
git add src/prefab-map/extract.ts src/prefab-map/types.ts scripts/build-prefab-map.ts package.json tests/prefab-map/extract.test.ts tests/fixtures/prefab-map data/schema
git commit -m "feat(prefab-map): extract S105 and BRDM2 schemas from the .et chains"
```

---

### Task 5: Contrast generator

Split the two vehicles into shared core, BRDM2-only, and S105-only. This is the substitute for corpus statistics that n=2 makes meaningless.

**Files:**
- Create: `src/prefab-map/contrast.ts`
- Test: `tests/prefab-map/contrast.test.ts`
- Modify: `scripts/build-prefab-map.ts`

**Interfaces:**
- Consumes: `VehicleSchema` (Task 4).
- Produces:
  - `interface ContrastEntry { component: string; propertyPath?: string; detail: string }`
  - `interface Contrast { sharedComponents: string[]; onlyInA: ContrastEntry[]; onlyInB: ContrastEntry[]; divergentProperties: { component: string; propertyPath: string; valueA: string; valueB: string }[] }`
  - `function contrastVehicles(a: VehicleSchema, b: VehicleSchema): Contrast`

- [ ] **Step 1: Write the failing test**

Create `tests/prefab-map/contrast.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { contrastVehicles } from "../../src/prefab-map/contrast.js";
import type { ResolvedComponent, VehicleSchema } from "../../src/prefab-map/types.js";

function schema(vehicle: string, components: ResolvedComponent[]): VehicleSchema {
  return {
    vehicle,
    rootPath: `${vehicle}.et`,
    chain: [`${vehicle}.et`],
    components,
    references: [],
    boneSurface: [],
    unparsed: [],
  };
}

function comp(typeName: string, props: [string, string][]): ResolvedComponent {
  return {
    typeName,
    introducedBy: "x.et",
    properties: props.map(([path, value]) => ({ path, value, setBy: "x.et", overrides: [] })),
  };
}

describe("contrastVehicles", () => {
  const a = schema("S105", [
    comp("RigidBody", [["Mass", "1200"]]),
    comp("SCR_VehicleSoundComponent", [["Horn", "civ"]]),
  ]);
  const b = schema("BRDM2", [
    comp("RigidBody", [["Mass", "7000"]]),
    comp("SlotManagerComponent", [["Slots.Turret", "t.et"]]),
  ]);

  it("lists components present in both", () => {
    expect(contrastVehicles(a, b).sharedComponents).toEqual(["RigidBody"]);
  });

  it("lists components unique to each side", () => {
    const c = contrastVehicles(a, b);
    expect(c.onlyInA.map((e) => e.component)).toEqual(["SCR_VehicleSoundComponent"]);
    expect(c.onlyInB.map((e) => e.component)).toEqual(["SlotManagerComponent"]);
  });

  it("reports shared properties whose values differ", () => {
    expect(contrastVehicles(a, b).divergentProperties).toEqual([
      { component: "RigidBody", propertyPath: "Mass", valueA: "1200", valueB: "7000" },
    ]);
  });

  it("does not report a shared property with an identical value", () => {
    const same = schema("BRDM2", [comp("RigidBody", [["Mass", "1200"]])]);
    expect(contrastVehicles(a, same).divergentProperties).toEqual([]);
  });

  it("sorts output for stable golden comparison", () => {
    const multi = schema("BRDM2", [
      comp("ZComponent", [["p", "1"]]),
      comp("AComponent", [["p", "1"]]),
    ]);
    expect(contrastVehicles(schema("S105", []), multi).onlyInB.map((e) => e.component)).toEqual([
      "AComponent",
      "ZComponent",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/contrast.test.ts`
Expected: FAIL — cannot resolve `contrast.js`.

- [ ] **Step 3: Write the implementation**

Create `src/prefab-map/contrast.ts`:

```typescript
// src/prefab-map/contrast.ts
import type { ResolvedComponent, VehicleSchema } from "./types.js";

export interface ContrastEntry {
  component: string;
  propertyPath?: string;
  detail: string;
}

export interface Contrast {
  sharedComponents: string[];
  onlyInA: ContrastEntry[];
  onlyInB: ContrastEntry[];
  divergentProperties: {
    component: string;
    propertyPath: string;
    valueA: string;
    valueB: string;
  }[];
}

/**
 * Contrast two vehicles. With only two samples, frequency counts say nothing;
 * what a plain car and a turreted armored car share is the ground-vehicle core,
 * and what only one has is that vehicle's character. That split is the analysis.
 */
export function contrastVehicles(a: VehicleSchema, b: VehicleSchema): Contrast {
  const byName = (s: VehicleSchema) =>
    new Map(s.components.map((c) => [c.typeName, c] as const));
  const ma = byName(a);
  const mb = byName(b);

  const shared: string[] = [];
  const onlyInA: ContrastEntry[] = [];
  const onlyInB: ContrastEntry[] = [];
  const divergent: Contrast["divergentProperties"] = [];

  for (const [name, ca] of ma) {
    const cb = mb.get(name);
    if (!cb) {
      onlyInA.push({ component: name, detail: `only on ${a.vehicle}` });
      continue;
    }
    shared.push(name);
    divergent.push(...diffProperties(name, ca, cb));
  }

  for (const [name] of mb) {
    if (!ma.has(name)) onlyInB.push({ component: name, detail: `only on ${b.vehicle}` });
  }

  const byComponent = (x: { component: string }, y: { component: string }) =>
    x.component < y.component ? -1 : x.component > y.component ? 1 : 0;

  return {
    sharedComponents: shared.sort(),
    onlyInA: onlyInA.sort(byComponent),
    onlyInB: onlyInB.sort(byComponent),
    divergentProperties: divergent.sort(
      (x, y) => byComponent(x, y) || (x.propertyPath < y.propertyPath ? -1 : 1),
    ),
  };
}

function diffProperties(
  component: string,
  ca: ResolvedComponent,
  cb: ResolvedComponent,
): Contrast["divergentProperties"] {
  const pb = new Map(cb.properties.map((p) => [p.path, p.value] as const));
  const out: Contrast["divergentProperties"] = [];
  for (const pa of ca.properties) {
    const other = pb.get(pa.path);
    if (other !== undefined && other !== pa.value) {
      out.push({ component, propertyPath: pa.path, valueA: pa.value, valueB: other });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/contrast.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Emit contrast.json from the build script**

In `scripts/build-prefab-map.ts`, add the import at the top:

```typescript
import { contrastVehicles } from "../src/prefab-map/contrast.js";
```

Replace the `for (const { name, path } of VEHICLES) { ... }` loop's closing so the schemas are retained, then write the contrast. The loop becomes:

```typescript
const built = new Map<string, ReturnType<typeof extractVehicle>>();

for (const { name, path } of VEHICLES) {
  const schema = extractVehicle(path, config);
  if (schema.unparsed.length > 0) {
    console.error(`${name}: ${schema.unparsed.length} unparsed entries`);
    for (const u of schema.unparsed) console.error(`  ${u.path}: ${u.reason}`);
    process.exit(1);
  }
  built.set(name, schema);
  const file = resolve(outDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  console.log(
    `${name}: ${schema.components.length} components, ` +
      `${schema.boneSurface.length} bones, ${schema.references.length} references -> ${file}`,
  );
}

const contrast = contrastVehicles(built.get("s105")!, built.get("brdm2")!);
const contrastFile = resolve(outDir, "contrast.json");
writeFileSync(contrastFile, `${JSON.stringify(contrast, null, 2)}\n`, "utf8");
console.log(
  `contrast: ${contrast.sharedComponents.length} shared, ` +
    `${contrast.onlyInA.length} S105-only, ${contrast.onlyInB.length} BRDM2-only -> ${contrastFile}`,
);
```

- [ ] **Step 6: Regenerate and eyeball the contrast**

Run: `npm run build:prefab-map`
Expected: a third output line. Open `data/schema/contrast.json` and confirm `onlyInB` contains turret-related components and `sharedComponents` contains the ground-vehicle core (`RigidBody`, `VehicleWheeledSimulation`, `SlotManagerComponent`). If the shared list is near-empty, component naming is not matching between the two — investigate before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/prefab-map/contrast.ts tests/prefab-map/contrast.test.ts scripts/build-prefab-map.ts data/schema
git commit -m "feat(prefab-map): contrast S105 against BRDM2"
```

---

### Task 6: Diff engine

Check a work-in-progress prefab's bone references against its rig's actual bones, reporting every referencing site. This is the task that closes the loop on the original 24-ghost-bone bug.

**Files:**
- Create: `src/prefab-map/diff.ts`
- Test: `tests/prefab-map/diff.test.ts`

**Interfaces:**
- Consumes: `VehicleSchema`, `BoneSurface` (Task 4), `MeshContract` from `src/utils/mesh-contract.js`.
- Produces:
  - `interface DanglingBone { bone: string; sites: BoneSite[] }`
  - `interface InheritedUnadjusted { bone: string; setBy: string; sites: BoneSite[] }`
  - `interface DiffReport { danglingBones: DanglingBone[]; inheritedUnadjusted: InheritedUnadjusted[]; unreferencedRigBones: string[] }`
  - `function diffAgainstRig(schema: VehicleSchema, boneNames: string[], opts?: { leafPath?: string }): DiffReport`

- [ ] **Step 1: Write the failing test**

Create `tests/prefab-map/diff.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { diffAgainstRig } from "../../src/prefab-map/diff.js";
import type { VehicleSchema } from "../../src/prefab-map/types.js";

function schema(bones: { bone: string; sites: { component: string; propertyPath: string; setBy: string }[] }[]): VehicleSchema {
  return {
    vehicle: "Opel",
    rootPath: "Opel.et",
    chain: ["Prefabs/Vehicles/Wheeled/S105/S105_base.et", "Opel.et"],
    components: [],
    references: [],
    boneSurface: bones,
    unparsed: [],
  };
}

describe("diffAgainstRig", () => {
  it("reports a bone the rig does not have, with every referencing site", () => {
    const s = schema([
      {
        bone: "v_door_L01_handle",
        sites: [
          { component: "ActionsManagerComponent", propertyPath: "a.PivotID", setBy: "S105_base.et" },
          { component: "SCR_VehicleSoundComponent", propertyPath: "b.PivotID", setBy: "S105_base.et" },
        ],
      },
    ]);
    const report = diffAgainstRig(s, ["v_body"]);
    expect(report.danglingBones).toHaveLength(1);
    expect(report.danglingBones[0].bone).toBe("v_door_L01_handle");
    expect(report.danglingBones[0].sites).toHaveLength(2);
  });

  it("reports nothing dangling when every bone resolves", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["v_body"]).danglingBones).toEqual([]);
  });

  it("flags a dangling bone still attributed to an ancestor as inherited-but-unadjusted", () => {
    const s = schema([
      {
        bone: "v_wheel_l01",
        sites: [{ component: "A", propertyPath: "p", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" }],
      },
    ]);
    const report = diffAgainstRig(s, ["wheel_front_left"], { leafPath: "Opel.et" });
    expect(report.inheritedUnadjusted).toEqual([
      {
        bone: "v_wheel_l01",
        setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
        sites: [{ component: "A", propertyPath: "p", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" }],
      },
    ]);
  });

  it("does not flag a dangling bone the leaf itself set as inherited", () => {
    const s = schema([
      { bone: "typo_bone", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    const report = diffAgainstRig(s, ["v_body"], { leafPath: "Opel.et" });
    expect(report.danglingBones).toHaveLength(1);
    expect(report.inheritedUnadjusted).toEqual([]);
  });

  it("lists rig bones nothing references", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["v_body", "deform_spine"]).unreferencedRigBones).toEqual([
      "deform_spine",
    ]);
  });

  it("refuses an empty rig instead of reporting every bone dangling", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(() => diffAgainstRig(s, [])).toThrow(/rig bone list is empty/i);
  });

  it("matches bone names case-sensitively and verbatim", () => {
    const s = schema([
      { bone: "passangerL_idle", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["passengerL_idle"]).danglingBones).toHaveLength(1);
    expect(diffAgainstRig(s, ["passangerL_idle"]).danglingBones).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/diff.test.ts`
Expected: FAIL — cannot resolve `diff.js`.

- [ ] **Step 3: Write the implementation**

Create `src/prefab-map/diff.ts`:

```typescript
// src/prefab-map/diff.ts
import type { BoneSite, VehicleSchema } from "./types.js";

export interface DanglingBone {
  bone: string;
  sites: BoneSite[];
}

export interface InheritedUnadjusted {
  bone: string;
  setBy: string;
  sites: BoneSite[];
}

export interface DiffReport {
  danglingBones: DanglingBone[];
  inheritedUnadjusted: InheritedUnadjusted[];
  unreferencedRigBones: string[];
}

export interface DiffOptions {
  /** The leaf prefab's own path, used to tell inherited values from local ones. */
  leafPath?: string;
}

/**
 * Check a prefab's bone surface against the bones its rig actually has.
 *
 * Bone names are compared verbatim and case-sensitively. The engine does not
 * fuzzy-match, and neither does this: `passanger` and `passenger` are different
 * bones, and a check that quietly accepted both would hide the exact defect this
 * exists to find.
 */
export function diffAgainstRig(
  schema: VehicleSchema,
  boneNames: string[],
  opts: DiffOptions = {},
): DiffReport {
  if (boneNames.length === 0) {
    throw new Error(
      "Refusing to diff: the rig bone list is empty. Every reference would be " +
        "reported dangling. Check the mesh's .txo is readable (loadMeshContract).",
    );
  }

  const rig = new Set(boneNames);
  const referenced = new Set(schema.boneSurface.map((b) => b.bone));
  const leaf = opts.leafPath;

  const danglingBones: DanglingBone[] = [];
  const inheritedUnadjusted: InheritedUnadjusted[] = [];

  for (const entry of schema.boneSurface) {
    if (rig.has(entry.bone)) continue;
    danglingBones.push({ bone: entry.bone, sites: entry.sites });

    if (leaf === undefined) continue;
    // A dangling bone whose value came from an ancestor is the donor-rig case:
    // the prefab was duplicated and this reference was never repointed.
    const inheritedSites = entry.sites.filter((s) => s.setBy !== leaf);
    if (inheritedSites.length === entry.sites.length && inheritedSites.length > 0) {
      inheritedUnadjusted.push({
        bone: entry.bone,
        setBy: inheritedSites[0].setBy,
        sites: entry.sites,
      });
    }
  }

  return {
    danglingBones,
    inheritedUnadjusted,
    unreferencedRigBones: boneNames.filter((b) => !referenced.has(b)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/diff.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/prefab-map/diff.ts tests/prefab-map/diff.test.ts
git commit -m "feat(prefab-map): diff a prefab's bone surface against its rig"
```

---

### Task 7: Tier-2 citation matcher

Match components and properties against the local API dump so generated docs can cite a source or admit they cannot.

**Files:**
- Create: `src/prefab-map/citations.ts`
- Test: `tests/prefab-map/citations.test.ts`

**Interfaces:**
- Consumes: `data/api/arma-classes.json`.
- Produces:
  - `interface Citation { source: "arma-classes" | null; className?: string; memberName?: string; description?: string }`
  - `interface CitationIndex { forComponent(typeName: string): Citation; forProperty(typeName: string, propertyPath: string): Citation }`
  - `function buildCitationIndex(apiClasses: unknown): CitationIndex`
  - `const UNDOCUMENTED = "UNDOCUMENTED"`

- [ ] **Step 1: Inspect the API dump shape before writing anything**

The implementation must match the real file, not a guess. Run:

```bash
node -e "const a=require('./data/api/arma-classes.json'); console.log(Array.isArray(a)?'array of '+a.length:'object keys: '+Object.keys(a).slice(0,10).join(',')); const first=Array.isArray(a)?a[0]:a[Object.keys(a)[0]]; console.log(JSON.stringify(first).slice(0,600));"
```

Record the actual shape. Every code block below assumes an object keyed by class name whose values carry an optional `description` and an optional `members` array of `{ name, description }`. **If the real shape differs, adapt `buildCitationIndex` and its tests to the real shape** — the contract that matters is the `CitationIndex` interface, not the parsing details.

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/citations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildCitationIndex, UNDOCUMENTED } from "../../src/prefab-map/citations.js";

const api = {
  SCR_FuelManagerComponent: {
    description: "Manages vehicle fuel tanks.",
    members: [{ name: "MaxFuel", description: "Maximum fuel in litres." }],
  },
  VehicleWheeledSimulation: {},
};

describe("buildCitationIndex", () => {
  const index = buildCitationIndex(api);

  it("cites a documented component", () => {
    expect(index.forComponent("SCR_FuelManagerComponent")).toEqual({
      source: "arma-classes",
      className: "SCR_FuelManagerComponent",
      description: "Manages vehicle fuel tanks.",
    });
  });

  it("cites a documented property by its last path segment", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "MaxFuel")).toEqual({
      source: "arma-classes",
      className: "SCR_FuelManagerComponent",
      memberName: "MaxFuel",
      description: "Maximum fuel in litres.",
    });
  });

  it("matches a nested property path on its final segment", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "Tanks.Tank[0].MaxFuel").memberName).toBe(
      "MaxFuel",
    );
  });

  it("returns a null-source citation for a class present but undescribed", () => {
    expect(index.forComponent("VehicleWheeledSimulation").source).toBeNull();
  });

  it("returns a null-source citation for a class absent from the dump", () => {
    expect(index.forComponent("BaseVehicleNodeComponent").source).toBeNull();
  });

  it("returns a null-source citation for an undocumented property", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "SecretField").source).toBeNull();
  });

  it("exports the exact marker string the doc generator must emit", () => {
    expect(UNDOCUMENTED).toBe("UNDOCUMENTED");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/citations.test.ts`
Expected: FAIL — cannot resolve `citations.js`.

- [ ] **Step 4: Write the implementation**

Create `src/prefab-map/citations.ts`:

```typescript
// src/prefab-map/citations.ts

/** The literal marker the doc generator emits when nothing can be cited. */
export const UNDOCUMENTED = "UNDOCUMENTED";

export interface Citation {
  source: "arma-classes" | null;
  className?: string;
  memberName?: string;
  description?: string;
}

export interface CitationIndex {
  forComponent(typeName: string): Citation;
  forProperty(typeName: string, propertyPath: string): Citation;
}

interface ApiMember {
  name?: string;
  description?: string;
}

interface ApiClass {
  description?: string;
  members?: ApiMember[];
}

const NONE: Citation = { source: null };

function lastSegment(path: string): string {
  const dot = path.lastIndexOf(".");
  const seg = dot === -1 ? path : path.slice(dot + 1);
  return seg.replace(/\[\d+\]$/, "");
}

/**
 * Build a lookup from the local API class dump.
 *
 * Coverage is expected to be lopsided: `SCR_*` script classes are documented,
 * engine-side components largely are not. A miss returns `{ source: null }` so the
 * doc generator can stamp UNDOCUMENTED. It must never fall back to a plausible
 * description — an invented explanation in this map would be worse than a gap,
 * because it would be trusted.
 */
export function buildCitationIndex(apiClasses: unknown): CitationIndex {
  const classes = (apiClasses ?? {}) as Record<string, ApiClass>;

  return {
    forComponent(typeName: string): Citation {
      const entry = classes[typeName];
      if (!entry || entry.description === undefined) return NONE;
      return {
        source: "arma-classes",
        className: typeName,
        description: entry.description,
      };
    },

    forProperty(typeName: string, propertyPath: string): Citation {
      const entry = classes[typeName];
      if (!entry?.members) return NONE;
      const wanted = lastSegment(propertyPath);
      const member = entry.members.find((m) => m.name === wanted);
      if (!member || member.description === undefined) return NONE;
      return {
        source: "arma-classes",
        className: typeName,
        memberName: member.name,
        description: member.description,
      };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/citations.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Measure real citation coverage**

Run:

```bash
node -e "const api=require('./data/api/arma-classes.json');const s=require('./data/schema/s105.json');let hit=0;for(const c of s.components){if(api[c.typeName])hit++;}console.log('components with an API entry: '+hit+'/'+s.components.length);"
```

Record the number in the commit message. A low number is a valid outcome and exactly what the UNDOCUMENTED marker exists to make visible — do not adjust the matcher to inflate it.

- [ ] **Step 7: Commit**

```bash
git add src/prefab-map/citations.ts tests/prefab-map/citations.test.ts
git commit -m "feat(prefab-map): cite components and properties against the API dump"
```

---

### Task 8: Documentation generator with tier-3 sidecar

Generate tier-labeled KB markdown from the schema, merging in hand-written in-engine observations without ever overwriting them.

**Files:**
- Create: `src/prefab-map/docgen.ts`
- Create: `data/schema/observations.json` (the tier-3 sidecar, seeded empty)
- Test: `tests/prefab-map/docgen.test.ts`
- Modify: `scripts/build-prefab-map.ts`

**Interfaces:**
- Consumes: `VehicleSchema` (Task 4), `CitationIndex` / `UNDOCUMENTED` (Task 7).
- Produces:
  - `type ObservationKey = string` — `"<ComponentName>#<propertyPath>"`, or `"<ComponentName>"` for a component-level note
  - `type Observations = Record<ObservationKey, string>`
  - `function generateVehicleDoc(schema: VehicleSchema, citations: CitationIndex, observations: Observations): string`

- [ ] **Step 1: Seed the sidecar**

Create `data/schema/observations.json`:

```json
{
  "_README": "Tier-3 observations: what actually breaks in-engine when a property is wrong. Hand-maintained. Keys are '<ComponentName>' or '<ComponentName>#<propertyPath>'. Never generated, never overwritten by npm run build:prefab-map. Delete the _README key only if it ever collides with a real component name."
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/docgen.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateVehicleDoc } from "../../src/prefab-map/docgen.js";
import { buildCitationIndex, UNDOCUMENTED } from "../../src/prefab-map/citations.js";
import type { VehicleSchema } from "../../src/prefab-map/types.js";

const schema: VehicleSchema = {
  vehicle: "S105",
  rootPath: "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
  chain: ["Prefabs/Vehicles/Core/Vehicle_Base.et", "Prefabs/Vehicles/Wheeled/S105/S105_base.et"],
  components: [
    {
      typeName: "SCR_FuelManagerComponent",
      introducedBy: "Prefabs/Vehicles/Core/Vehicle_Base.et",
      properties: [
        { path: "MaxFuel", value: "60", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et", overrides: [{ value: "40", from: "Prefabs/Vehicles/Core/Vehicle_Base.et" }] },
      ],
    },
    {
      typeName: "VehicleWheeledSimulation",
      introducedBy: "Prefabs/Vehicles/Core/Vehicle_Base.et",
      properties: [
        { path: "Wheels.Wheel[0].PivotID", value: "v_wheel_l01", setBy: "Prefabs/Vehicles/Core/Vehicle_Base.et", overrides: [] },
      ],
    },
  ],
  references: [],
  boneSurface: [
    { bone: "v_wheel_l01", sites: [{ component: "VehicleWheeledSimulation", propertyPath: "Wheels.Wheel[0].PivotID", setBy: "Prefabs/Vehicles/Core/Vehicle_Base.et" }] },
  ],
  unparsed: [],
};

const citations = buildCitationIndex({
  SCR_FuelManagerComponent: {
    description: "Manages vehicle fuel tanks.",
    members: [{ name: "MaxFuel", description: "Maximum fuel in litres." }],
  },
});

describe("generateVehicleDoc", () => {
  it("marks the file as generated and names its generator", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("<!-- GENERATED FILE — do not edit by hand.");
    expect(doc).toContain("scripts/build-prefab-map.ts");
  });

  it("stamps UNDOCUMENTED on a component with no citation", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    const section = doc.slice(doc.indexOf("### VehicleWheeledSimulation"));
    expect(section).toContain(UNDOCUMENTED);
  });

  it("does not stamp UNDOCUMENTED on a cited component", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    const section = doc.slice(
      doc.indexOf("### SCR_FuelManagerComponent"),
      doc.indexOf("### VehicleWheeledSimulation"),
    );
    expect(section).toContain("Manages vehicle fuel tanks.");
    expect(section).not.toContain(UNDOCUMENTED);
  });

  it("shows which chain level set an overridden property and what it shadowed", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("S105_base.et");
    expect(doc).toContain("overrides 40");
  });

  it("merges a tier-3 observation into the matching property", () => {
    const doc = generateVehicleDoc(schema, citations, {
      "VehicleWheeledSimulation#Wheels.Wheel[0].PivotID":
        "Wrong value here leaves the wheel un-animated with no error.",
    });
    expect(doc).toContain("Wrong value here leaves the wheel un-animated with no error.");
  });

  it("merges a component-level observation", () => {
    const doc = generateVehicleDoc(schema, citations, {
      VehicleWheeledSimulation: "Engine-side; not scriptable.",
    });
    expect(doc).toContain("Engine-side; not scriptable.");
  });

  it("ignores the sidecar README key", () => {
    const doc = generateVehicleDoc(schema, citations, { _README: "housekeeping note" });
    expect(doc).not.toContain("housekeeping note");
  });

  it("lists the bone surface with every referencing site", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("v_wheel_l01");
    expect(doc).toContain("Wheels.Wheel[0].PivotID");
  });

  it("is deterministic across runs", () => {
    expect(generateVehicleDoc(schema, citations, {})).toBe(
      generateVehicleDoc(schema, citations, {}),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/docgen.test.ts`
Expected: FAIL — cannot resolve `docgen.js`.

- [ ] **Step 4: Write the implementation**

Create `src/prefab-map/docgen.ts`:

```typescript
// src/prefab-map/docgen.ts
import { UNDOCUMENTED, type CitationIndex } from "./citations.js";
import type { VehicleSchema } from "./types.js";

export type ObservationKey = string;
export type Observations = Record<ObservationKey, string>;

const HEADER =
  "<!-- GENERATED FILE — do not edit by hand.\n" +
  "     Regenerate with: npm run build:prefab-map (scripts/build-prefab-map.ts).\n" +
  "     Hand-written in-engine findings belong in data/schema/observations.json,\n" +
  "     which is merged in at generation time and never overwritten. -->";

/**
 * Render one vehicle's derived map as KB markdown.
 *
 * Every entry is labeled with how it is known. Tier 1 is derived from the corpus,
 * tier 2 is cited to the API dump, tier 3 comes from the hand-maintained sidecar.
 * Anything with neither a citation nor an observation is stamped UNDOCUMENTED
 * rather than described from inference.
 */
export function generateVehicleDoc(
  schema: VehicleSchema,
  citations: CitationIndex,
  observations: Observations,
): string {
  const out: string[] = [];

  out.push(HEADER, "");
  out.push(`# ${schema.vehicle} Prefab Component Map`, "");
  out.push(`Root: \`${schema.rootPath}\``, "");
  out.push("Inheritance chain, oldest ancestor first:", "");
  for (const level of schema.chain) out.push(`1. \`${level}\``);
  out.push("");
  out.push(
    `${schema.components.length} components, ${schema.boneSurface.length} distinct bones referenced.`,
    "",
  );
  out.push(
    "Tier 1 entries are derived from the prefab files. Tier 2 entries cite the local " +
      "API dump. Tier 3 entries are in-engine observations. " +
      `Entries with neither a citation nor an observation are marked ${UNDOCUMENTED}.`,
    "",
  );

  out.push("## Components", "");
  for (const component of [...schema.components].sort((a, b) =>
    a.typeName < b.typeName ? -1 : 1,
  )) {
    out.push(`### ${component.typeName}`, "");
    out.push(`Introduced by \`${component.introducedBy}\`. (tier 1)`, "");

    const cite = citations.forComponent(component.typeName);
    const note = observations[component.typeName];
    if (cite.source !== null) out.push(`${cite.description} (tier 2, arma-classes)`, "");
    if (note !== undefined) out.push(`${note} (tier 3, observed)`, "");
    if (cite.source === null && note === undefined) out.push(`${UNDOCUMENTED}`, "");

    out.push("| Property | Value | Set by | Notes |", "|---|---|---|---|");
    for (const prop of [...component.properties].sort((a, b) => (a.path < b.path ? -1 : 1))) {
      const notes: string[] = [];
      if (prop.overrides.length > 0) {
        notes.push(`overrides ${prop.overrides.map((o) => o.value).join(", ")}`);
      }
      const pc = citations.forProperty(component.typeName, prop.path);
      if (pc.source !== null) notes.push(`${pc.description} (tier 2)`);
      const pn = observations[`${component.typeName}#${prop.path}`];
      if (pn !== undefined) notes.push(`${pn} (tier 3)`);
      if (notes.length === 0) notes.push(UNDOCUMENTED);
      out.push(
        `| \`${prop.path}\` | \`${prop.value}\` | \`${short(prop.setBy)}\` | ${notes.join("; ")} |`,
      );
    }
    out.push("");
  }

  out.push("## Bone surface", "");
  out.push("| Bone | Referenced from |", "|---|---|");
  for (const entry of schema.boneSurface) {
    const sites = entry.sites
      .map((s) => `${s.component} \`${s.propertyPath}\` (${short(s.setBy)})`)
      .join("<br>");
    out.push(`| \`${entry.bone}\` | ${sites} |`);
  }
  out.push("");

  return out.join("\n");
}

function short(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/docgen.test.ts`
Expected: PASS, 9 tests.

The `_README` test passes because `_README` matches no component type name and no `Component#path` key, so it is never looked up. No filtering code is needed.

- [ ] **Step 6: Wire doc generation into the build script**

Add to the imports in `scripts/build-prefab-map.ts`:

```typescript
import { readFileSync } from "node:fs";
import { buildCitationIndex } from "../src/prefab-map/citations.js";
import { generateVehicleDoc } from "../src/prefab-map/docgen.js";
```

Append at the end of the script:

```typescript
const KB_DIR = "C:/Users/Steffen/.claude/arma-knowledge/patterns/Vehicles_And_Physics";

const api = JSON.parse(readFileSync(resolve("data/api/arma-classes.json"), "utf8"));
const citations = buildCitationIndex(api);
const observations = JSON.parse(
  readFileSync(resolve("data/schema/observations.json"), "utf8"),
);

for (const [name, schema] of built) {
  const doc = generateVehicleDoc(schema, citations, observations);
  const file = resolve(KB_DIR, `${name}-component-map.md`);
  writeFileSync(file, doc, "utf8");
  const lines = doc.split("\n").length;
  console.log(`${name} doc: ${lines} lines -> ${file}`);
  if (lines > 800) {
    console.warn(
      `  ${name}-component-map.md exceeds 800 lines. Repo convention: split into a ` +
        `subfolder with a local INDEX.md and point the main INDEX.md row at it.`,
    );
  }
}
```

- [ ] **Step 7: Generate the docs and check the result**

Run: `npm run build:prefab-map`
Expected: two additional lines naming the generated KB files. Open one and confirm it is readable, the tier labels are present, and `UNDOCUMENTED` appears where you would expect (mostly on engine-side components).

If the 800-line warning fires, split the file per the repo convention in `CLAUDE.md`: create `arma-knowledge/patterns/Vehicles_And_Physics/<vehicle>-component-map/` with a local `INDEX.md` routing table, adjust the generator to write one file per component group, and update the main `INDEX.md` row.

- [ ] **Step 8: Verify regeneration preserves observations**

Add a real tier-3 entry to `data/schema/observations.json` — use one you actually know:

```json
{
  "_README": "Tier-3 observations: what actually breaks in-engine when a property is wrong. Hand-maintained. Keys are '<ComponentName>' or '<ComponentName>#<propertyPath>'. Never generated, never overwritten by npm run build:prefab-map. Delete the _README key only if it ever collides with a real component name.",
  "VehicleAnimationComponent": "Points at the .agf animation graph. A dangling bone reference inside the graph does not raise an engine error; the affected node silently does nothing."
}
```

Run: `npm run build:prefab-map`
Expected: the note appears in the generated BRDM2 and S105 docs, and `data/schema/observations.json` is unchanged on disk.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS apart from the known `integration-m151a2` failure.

- [ ] **Step 10: Commit**

```bash
git add src/prefab-map/docgen.ts tests/prefab-map/docgen.test.ts scripts/build-prefab-map.ts data/schema
git commit -m "feat(prefab-map): generate tier-labeled KB docs with an observation sidecar"
```

The generated KB files live outside this repo (`~/.claude/arma-knowledge/`) and are not part of this commit.

---

### Task 9: MCP action

Expose the diff engine through the existing `prefab` tool so it can be run against a work-in-progress prefab from a session.

**Files:**
- Modify: `src/tools/prefab.ts`
- Test: `tests/prefab-map/prefab-action.test.ts`

**Interfaces:**
- Consumes: `extractVehicle` (Task 4), `diffAgainstRig` (Task 6), `loadMeshContract` from `src/utils/mesh-contract.js`.
- Produces: `function formatDiffReport(report: DiffReport, vehicle: string): string`, exported from `src/prefab-map/diff.ts` for testability, plus a new `action` value on the `prefab` tool.

- [ ] **Step 1: Read the existing tool to match its conventions**

Read `src/tools/prefab.ts` and note: how `action` is declared in the zod schema, how existing actions dispatch, and how a text report is returned (`{ content: [{ type: "text", text }] }`). Follow whatever pattern is already there. Note in particular how `action=inspect` obtains a mesh path and calls `loadMeshContract` — the new action reuses that path resolution rather than inventing its own.

- [ ] **Step 2: Write the failing test**

Create `tests/prefab-map/prefab-action.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatDiffReport } from "../../src/prefab-map/diff.js";
import type { DiffReport } from "../../src/prefab-map/diff.js";

describe("formatDiffReport", () => {
  it("reports a clean result plainly", () => {
    const report: DiffReport = {
      danglingBones: [],
      inheritedUnadjusted: [],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("no dangling bone references");
  });

  it("lists each dangling bone with all its referencing sites", () => {
    const report: DiffReport = {
      danglingBones: [
        {
          bone: "v_door_L01_handle",
          sites: [
            { component: "ActionsManagerComponent", propertyPath: "a.PivotID", setBy: "S105_base.et" },
            { component: "SCR_VehicleSoundComponent", propertyPath: "b.PivotID", setBy: "S105_base.et" },
          ],
        },
      ],
      inheritedUnadjusted: [],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("v_door_L01_handle");
    expect(text).toContain("ActionsManagerComponent");
    expect(text).toContain("SCR_VehicleSoundComponent");
    expect(text).toContain("2 site");
  });

  it("calls out inherited-but-unadjusted bones as the donor-rig case", () => {
    const report: DiffReport = {
      danglingBones: [
        { bone: "v_wheel_l01", sites: [{ component: "A", propertyPath: "p", setBy: "S105_base.et" }] },
      ],
      inheritedUnadjusted: [
        {
          bone: "v_wheel_l01",
          setBy: "S105_base.et",
          sites: [{ component: "A", propertyPath: "p", setBy: "S105_base.et" }],
        },
      ],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toMatch(/inherited/i);
    expect(text).toContain("S105_base.et");
  });

  it("reports unreferenced rig bones as informational", () => {
    const report: DiffReport = {
      danglingBones: [],
      inheritedUnadjusted: [],
      unreferencedRigBones: ["deform_spine"],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("deform_spine");
    expect(text).toMatch(/informational|may be legitimate/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/prefab-map/prefab-action.test.ts`
Expected: FAIL — `formatDiffReport` is not exported from `diff.js`.

- [ ] **Step 4: Add the formatter**

Append to `src/prefab-map/diff.ts`:

```typescript
/** Render a diff report as the text an MCP client shows the user. */
export function formatDiffReport(report: DiffReport, vehicle: string): string {
  const lines: string[] = [`Bone reference check: ${vehicle}`, ""];

  if (report.danglingBones.length === 0) {
    lines.push("OK — no dangling bone references. Every referenced bone exists on the rig.");
  } else {
    lines.push(
      `${report.danglingBones.length} dangling bone reference(s) — these name bones the rig ` +
        `does not have. The engine will not error; the affected feature silently does nothing.`,
      "",
    );
    for (const d of report.danglingBones) {
      lines.push(`  ${d.bone} — ${d.sites.length} site(s):`);
      for (const s of d.sites) {
        lines.push(`    ${s.component} ${s.propertyPath} (set by ${s.setBy})`);
      }
    }
  }

  if (report.inheritedUnadjusted.length > 0) {
    lines.push(
      "",
      `${report.inheritedUnadjusted.length} of those are inherited and never repointed — ` +
        `the donor's value survived the duplication:`,
      "",
    );
    for (const i of report.inheritedUnadjusted) {
      lines.push(`  ${i.bone} — still set by ${i.setBy}`);
    }
  }

  if (report.unreferencedRigBones.length > 0) {
    lines.push(
      "",
      `${report.unreferencedRigBones.length} rig bone(s) nothing references (informational — ` +
        `deform-only bones are legitimately unreferenced):`,
      `  ${report.unreferencedRigBones.join(", ")}`,
    );
  }

  return lines.join("\n");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/prefab-map/prefab-action.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Wire the action into the prefab tool**

In `src/tools/prefab.ts`, add the imports:

```typescript
import { extractVehicle } from "../prefab-map/extract.js";
import { diffAgainstRig, formatDiffReport } from "../prefab-map/diff.js";
```

At `src/tools/prefab.ts:177`, widen the action enum:

```typescript
        action: z.enum(["create", "inspect", "check-bones"]).describe(
```

Keep the existing `.describe(...)` text and append a sentence describing the new action.

The `inspect` handler already destructures the parameters this needs at
`src/tools/prefab.ts:402`:

```typescript
      const { path: inputPath, include_raw, meshPath, meshSource, projectPath } = params;
```

`check-bones` takes the same `path`, `meshPath`, `meshSource`, and `projectPath`. Add
the dispatch branch alongside the `inspect` branch. There is no `textResult` helper in
this file — neighbouring actions return the literal object shape used below:

```typescript
      if (action === "check-bones") {
        const { path: inputPath, meshPath, meshSource, projectPath } = params;

        if (!inputPath) {
          return {
            content: [{ type: "text", text: "check-bones requires 'path' — the .et prefab to check." }],
          };
        }
        if (!meshPath) {
          return {
            content: [{
              type: "text",
              text: "check-bones requires 'meshPath' — the .xob/.txo whose skeleton the prefab must match.",
            }],
          };
        }

        const mesh = loadMeshContract(meshPath, meshSource ?? "mod", projectPath, config);
        if (mesh.boneNames.length === 0) {
          return {
            content: [{
              type: "text",
              text:
                `Could not read a skeleton for ${meshPath} (looked for ` +
                `${mesh.txoPath ?? "a sibling .txo"}). Refusing to check: with no bone list ` +
                `every reference would look dangling.`,
            }],
          };
        }

        const schema = extractVehicle(inputPath, config, { projectPath });
        const report = diffAgainstRig(schema, mesh.boneNames, { leafPath: schema.rootPath });
        return { content: [{ type: "text", text: formatDiffReport(report, schema.vehicle) }] };
      }
```

`loadMeshContract` is already imported in this file (`src/tools/prefab.ts:23`); do not add a second import for it.

- [ ] **Step 7: Verify the build and the suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm test`
Expected: PASS apart from the known `integration-m151a2` failure.

- [ ] **Step 8: Acceptance test against the real bug**

This is the criterion the whole effort is measured by. Run `check-bones` against the work-in-progress Opel prefab with its real mesh.

Expected: the report names the ghost bones, lists every referencing site, and flags them under "inherited and never repointed" pointing at the S105 chain.

If it reports far fewer than expected, the likely cause is that some bone-holding key is still missing from `BONE_BEARING_KEYS` — rerun the Task 4 Step 9 audit against the Opel schema. If it reports far more, check whether the mesh's `.txo` is the current export.

Record the actual result. If it does not find them, **stop and report** rather than adjusting thresholds to make the output look right.

- [ ] **Step 9: Commit**

```bash
git add src/prefab-map/diff.ts src/tools/prefab.ts tests/prefab-map/prefab-action.test.ts
git commit -m "feat(prefab-map): add prefab check-bones action"
```

---

## Deferred

Not built by this plan; recorded so they are not silently forgotten:

- **Retiring `checkBonePivotIds`.** The old set-based check at `src/utils/component-dependencies.ts:478` stays wired into `prefab` action=inspect until `check-bones` has proven itself on real work. Moving the call site is a follow-up.
- **Child prefab expansion.** The extractor records child prefabs (turrets, wheels, lights) as `kind: "prefab"` reference edges but does not recurse into them. Turret-internal bone wiring therefore appears as a reference, not as resolved properties. Recursing is a natural extension once the flat case is proven.
- **Tier 3 population.** The sidecar starts nearly empty by design. It fills in as in-engine testing happens; that work is not schedulable here.
