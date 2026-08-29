# Vehicle Prefab Component Map — Design

Date: 2026-08-29
Status: approved (design), ready for implementation planning

## Problem

Vehicle animation automation keeps failing in ways that trace back to incomplete
knowledge of what a vehicle prefab actually contains. The concrete symptom: after
duplicating a donor vehicle and swapping in a new mesh, 24 locator bones still
carried donor rig coordinates, putting action buttons in the wrong place. The
engine did not error — components hold bone names as plain strings, and a name
that no longer resolves is silently ignored or resolves to the wrong transform.

Existing knowledge covers vehicle prefabs at the "which components exist" level
(`arma-knowledge/patterns/Prefabs_And_Components/component-anatomy-and-dependencies.md`,
`Vehicles_And_Physics/vehicle-modding.md`). Nothing covers the property level, and
nothing distinguishes inherited from overridden values.

## Goal

A complete, derived, verifiable map of every component and every property in two
reference vehicle prefabs, plus a diff engine that checks a working prefab against
that map and reports dangling bone references before they reach the engine.

## Scope

Two vehicles, chosen as Bohemia's most recent and most standard-conforming
examples of their kinds:

- **S105** — plain civilian car. Chain:
  `S105_base.et` -> `Wheeled_Car_Base.et` -> `Wheeled_Base.et` -> `Vehicle_Base.et`
- **BRDM2** — turreted armored car. Chain:
  `BRDM2_base.et` -> `Wheeled_APC_Base.et` -> `Wheeled_Base.et` -> `Vehicle_Base.et`

The chains share `Wheeled_Base` and `Vehicle_Base`, so the union is 6 files.

Also in scope: the child prefabs those chains reference — wheels, lights, windows
(`Dst/`), probe, shadow, and for BRDM2 the two turret prefabs. Roughly 70 small
files. Turret prefabs are explicitly in scope; they carry the turret bone wiring.

Measured size of the 6-file union: **44 distinct components, 513 distinct property
keys** across all nesting depths. Every one is covered. No cherry-picking.

Out of scope: all other vehicles, helicopters, boats, and non-vehicle prefab
categories. Statistics across a large corpus are explicitly rejected — with n=2 the
value is the *contrast* between a plain car and a turreted armored car, not
frequency counts.

Source corpus: `<extractedPath>/Prefabs/Vehicles/`, resolved via the existing
`config.extractedPath` (conventionally `.../My Games/ArmaReforgerWorkbench/extracted`).

## Existing machinery to build on

- `src/formats/enfusion-text.ts` — recursive `.et` parser (`parse`, `serialize`,
  `EnfusionNode`). Reuse; do not write a second parser.
- `src/utils/prefab-ancestry.ts` — `parseParentPath`, `walkChain`,
  `parseTopLevelComponents`, `mergeAncestryComponents`. Reuse for chain resolution.
- `data/api/arma-classes.json` — local API class dump, source for tier 2 citation.
  Spot-checked: all 8 priority components have entries.
- `src/utils/component-dependencies.ts` — `checkBonePivotIds(components, boneNames)`
  already reports dangling `PivotID`s, wired into `prefab` action=inspect. It is a
  partial diff engine: it matches only `PivotID` via regex over `rawBody`, dedups
  hits into a `Set` so referencing sites are lost, and has no notion of the
  inheritance chain. The new diff engine supersedes it rather than duplicating it —
  same silent-failure class, with site attribution and provenance added. The
  existing function and its `prefab` wiring stay until the new action is proven,
  then the call site moves over.
- `src/utils/mesh-contract.ts` — `loadMeshContract` returns `boneNames` and
  `colliderNames` for a mesh. This is the rig bone list the diff engine needs;
  `src/animation/skeleton-index.ts` is not the right source.

## Data model

One JSON document per vehicle, committed under `data/schema/`.

### Resolved tree

Every component, every nested property, merged down the inheritance chain. Each
leaf carries the file in the chain that set its final value:

```
component -> property path -> { value, type, setBy, overrides[] }
```

`setBy` is the chain level that won (e.g. `S105_base.et`). `overrides` lists the
values it shadowed, in chain order. This makes inherited-vs-overridden answerable
**per property**, not per component — which is the granularity the ghost-bone
problem lives at.

### Reference edges

Every value that points outside itself, recorded as
`{ component, propertyPath, kind, target }`:

- `kind: "bone"` — `PivotID` dominates; also `SoundPointInfo` names, hitzone bone
  fields, and any other key confirmed during extraction to hold a rig bone name.
  The set of bone-bearing keys is derived from the corpus, not assumed.
- `kind: "prefab"` — `{GUID}Path/To/Thing.et`
- `kind: "resource"` — `.xob`, `.acp`, `.agf`, `.agr`, and other asset refs

### Bone surface

The flat deduplicated set of every bone name the prefab expects, each with the
full list of `{component, propertyPath}` sites referencing it. This is the list a
working prefab gets diffed against.

Note: shipped assets contain load-bearing typos (e.g. `passanger*` pivot names).
Bone names are copied verbatim, never normalized or corrected.

## Knowledge tiers

Every entry in the generated documentation is labeled with how it is known. This
labeling is a hard requirement, not a nicety.

- **Tier 1 — Derived.** Exists / type / value per vehicle / chain level that set it
  / what it references. 100% coverage, mechanical, no inference.
- **Tier 2 — Cited.** Component and property matched against `data/api/arma-classes.json`
  and the wiki data, with the source recorded. Coverage will be lopsided: `SCR_*`
  script classes are documented; engine-side components such as
  `VehicleWheeledSimulation` and `BaseVehicleNodeComponent` largely are not.
  Class-level matching is reliable; property-level matching is partial, because
  serialized `.et` attribute names do not always equal script member names.
- **Tier 3 — Observed.** "What breaks if this is wrong," from in-engine testing.
  Starts near-empty, grows as we test. First pass targets the animation-relevant
  components: `VehicleAnimationComponent`, `CarProcAnimComponent`,
  `SlotManagerComponent`, `ActionsManagerComponent`,
  `SCR_BaseCompartmentManagerComponent`, `VehicleWheeledSimulation`, and the damage
  managers holding hitzone bones.

**Hard rule: no prose written from inference.** Anything neither derived nor cited
is stamped `UNDOCUMENTED`. That marker is the deliverable — it shows exactly where
the real unknowns are. A plausible-sounding guess in this document would poison
every downstream automation decision, which is the failure mode this whole effort
exists to prevent.

## Components

### 1. Extractor

Walks a named vehicle's chain plus its referenced child prefabs, produces the JSON
document above. Pure function of the corpus: same input, same output. No network,
no Workbench.

### 2. Contrast generator

Given the two vehicle JSONs, emits a three-way split: components and properties
present in both (core), only in BRDM2 (turret/armor), only in S105 (civilian). This
is the substitute for corpus statistics.

### 3. Diff engine

The part that closes the loop on the original bug. Given a target prefab (the
user's work-in-progress) and its rig's actual bone list, reports:

- **Dangling bone references** — a `PivotID` or equivalent naming a bone the target
  rig does not contain. Reported with every referencing site, so a single missing
  bone shows all the places that will misbehave.
- **Inherited-but-unadjusted** — properties whose value is still the donor's, where
  the reference map says the value is rig-dependent. This is the direct detector
  for the 24-ghost-bone case.
- **Unreferenced rig bones** — bones present in the mesh that no component points
  at. Informational; may be legitimate (deform-only bones).

Rig bone lists come from `loadMeshContract(...).boneNames` (`src/utils/mesh-contract.ts`),
which reads the mesh's `.txo`.

### 4. Documentation generator

Generates KB markdown from the JSON. Generated, never hand-edited, with a header
saying so and naming the generator. Tier 3 observations live in a separate
hand-maintained sidecar keyed by `component + propertyPath`, merged in at
generation time, so regenerating never destroys hand-written findings.

Destination: `arma-knowledge/patterns/Vehicles_And_Physics/`. Per repo convention,
if a generated file exceeds ~800 lines it is split into a subfolder with a local
`INDEX.md`, and the main `INDEX.md` row points at it.

### 5. MCP surface

One tool action exposing the diff engine against a live prefab. The extractor and
generators run offline as build steps, not per-query.

## Data flow

```
extracted/Prefabs/Vehicles/**   ->  Extractor  ->  data/schema/{s105,brdm2}.json
                                                        |
                          +-----------------------------+------------------+
                          |                             |                  |
                  Contrast generator            Doc generator        Diff engine
                          |                             |                  |
                   contrast.json          arma-knowledge KB docs      MCP action
                                                   ^                       ^
                                          tier-3 sidecar          target prefab + rig
```

## Error handling

- **Missing corpus** — if `extractedPath` is unset or the vehicle files are absent,
  fail loudly with the path checked. Never emit a partial schema silently.
- **Broken chain** — a parent `.et` that cannot be resolved aborts extraction for
  that vehicle and names the missing file. A prefab map with a silently absent
  ancestor is worse than none.
- **Unknown property shapes** — parser output that does not fit the expected node
  or leaf shape is recorded in an `unparsed` list in the JSON rather than dropped.
  An empty `unparsed` list is part of the acceptance criteria.
- **Diff engine, missing rig** — refuse rather than assume an empty bone list; an
  empty list would report every reference as dangling.

## Testing

- Committed fixtures: the 6 chain files, plus a representative subset of child
  prefabs including both BRDM2 turrets. Tests run against fixtures, not the
  developer's live extracted directory.
- Extractor: targeted assertions against the fixture set — chain order, empty
  `unparsed`, `introducedBy` for a known inherited component, and known bone names
  present with all their sites. Not a golden-file snapshot: a snapshot of two
  1700-line prefabs is unreviewable, so a diff in it would get rubber-stamped rather
  than read. Chain-resolution tests assert `setBy` for properties known to be
  overridden at each level.
- Reference edges: assert the known `PivotID` values appear with all their sites,
  including the `passanger*` typo names, verbatim.
- Diff engine: synthetic target prefab with a deliberately renamed bone; assert the
  dangling reference is found with every referencing site listed. Assert the
  missing-rig case refuses instead of reporting everything dangling.
- Doc generator: assert every generated entry carries a tier label, and that no
  entry lacking derivation or citation is missing its `UNDOCUMENTED` stamp.
- Regeneration is idempotent, and a regeneration with a populated tier-3 sidecar
  preserves every sidecar entry.

## Success criteria

1. All 44 components and 513 property keys in the two chains appear in the schema.
2. Every property reports which chain level set its value.
3. The bone surface for each vehicle is complete, with all referencing sites.
4. The diff engine, run against the known-bad Opel prefab, reports the 24 ghost
   bones — this is the acceptance test that the effort solved the original problem.
5. No generated prose is unlabeled, and no inferred prose exists at all.
