# Vehicle `.et` Engine Tuning — Design (v2)

Supersedes the write target of
[2026-08-02-visual-vehicle-tuning-bridge-design.md](2026-08-02-visual-vehicle-tuning-bridge-design.md).
That version shipped and works; this changes *what file gets written*, and reuses most of its code.

## Why change

v1 writes to `Prefabs/Vehicles/Core/Configs/Engines/Engine_*.conf`. Two problems:

1. **Engine configs are shared resources.** A vehicle's `.et` references one by GUID
   (`Engine Engine Engine : "{CEA5458AC6B97274}…/Engine_M151.conf"`). Editing the conf changes
   every prefab pointing at it, and it is base-game data the mod has no business owning.
2. **Per-vehicle tuning is the actual goal.** RoadForger already tunes per vehicle this way —
   `Ural4320.et:48-54` overrides `VehicleWheeledSimulation → Simulation Wheeled → Gearbox →
   Forward`, and `S105_base.et` overrides `Aerodynamics → DragCoefficient`.

Vanilla confirms inline engine override is the supported pattern: `S105_rally.et:6-14` and
`BRDM2_base.et:971-982` both define the full engine inline in the vehicle `.et`, no conf
reference at all. `S105_rally` is literally a hotter variant of `S105` done this way.

## Hard constraint discovered during design: do NOT use `parse`/`serialize`

`src/formats/enfusion-text.ts` exists and looks like the obvious tool. **It corrupts real
vehicle prefabs.** Measured against the real 1222-line `M151A2.et`:

- `Filenames + {` → `Filenames {` — **drops the `+` array-append operator**, silently converting
  an append-to-inherited into a wholesale replace
- `Offset 0 0.5 -1.8` → `Offset 0` + `"0.5" -1.8` — vectors split across lines and re-quoted
- the `Engine Engine Engine : "{GUID}…" {` line is **absent from the output entirely**
- 1373 of 1415 lines differ; file grows 1222 → 1415 lines

Its own round-trip test asserts *semantic* equality (parse→serialize→parse, compare tree) on a
10-line synthetic prefab with no vectors and no `+`. It was never exercised on a real vehicle.

Do not fix it as part of this work — other MCP tools depend on that module and its current
callers presumably work. **This feature must never round-trip a whole `.et` through it.**

## Approach

Byte-preserving surgical edit, the same principle as v1's `.conf` module, plus a block locator:

1. Brace-aware scan to find the line range of the `Engine` block inside
   `components → VehicleWheeledSimulation → Simulation Wheeled`.
2. Read/replace/insert **only** field lines inside that range.
3. Every other byte in the file is left untouched. Never re-emit the document.

This sidesteps vectors, `+`, quoting heuristics, and comments entirely — because none of it is
ever re-serialized.

## Scope

- **Addon-only.** Scans `<addonPath>/Prefabs/Vehicles/**/*.et` where `addonPath` comes from the
  existing `ENFUSION_TUNING_ADDON` (default `RoadForger`). Vanilla vehicles are never listed and
  never written — editing the extracted mirror has no effect in game.
- **Only vehicles that already have an Engine block are listed.** The tool performs no structural
  creation: it will not create `VehicleWheeledSimulation`, `Simulation Wheeled`, or the `Engine`
  block itself. A vehicle without one is skipped, and the UI explains how to add it in Workbench.
  (Consequence, accepted: the dropdown is empty until at least one vehicle gets an Engine override
  added in Workbench. That one-time setup happens in the editor, which gets GUIDs and nesting
  right; the tool then owns the fast iteration.)
- **Inserting a missing *field* into an existing Engine block is allowed** — a single line into a
  located block, not structural creation.
- Engine curve only. No gearbox, tire/Pacejka, suspension, or TerrainDrag in this pass.

## Reading effective values

An Engine block usually holds only the overridden fields, so all 9 must be resolved:

1. Field present in the mod `.et`'s Engine block → that value (mark **overridden**).
2. Else, if the Engine node carries a `: "{GUID}path/Engine_X.conf"` reference → read the field
   from that conf in the extracted base-game mirror (mark **inherited**).
3. Else, fall back to the same-relative-path vanilla `.et` in the mirror, and resolve its Engine
   block the same way (inline values, or its own `:` reference).
4. Still unresolved → surface as **unresolved** in the UI, excluded from writes unless the user
   explicitly changes it.

The mirror path is configurable, defaulting to the existing `ENFUSION_EXTRACTED_PATH` /
`config.extractedPath` (`E:\Arma reforger data\extracted_files`). If it is not configured,
inherited values simply cannot be resolved — the UI says so rather than guessing.

v1's `engine-conf.ts` survives unchanged for step 2, demoted from "the thing we write" to "the
thing we read baselines from."

## Writing

- Only fields the user actually changed are written (v1's `loadedFields`/`touchedFields` mechanism
  carries over — it already prevents slider snap/clamp from rewriting untouched values).
- A changed field present in the block → replace that line in place, preserving indentation.
- A changed field absent from the block → insert a line inside the block, matching the block's
  existing indentation.
- Unresolved and untouched fields are never written.

## What carries over from v1

| File | Fate |
|---|---|
| `src/tuning-server/server.ts` | Survives; routes renamed `/api/engines*` → `/api/vehicles*` |
| `src/tuning-server/index.ts` | Survives; unchanged except wording |
| `src/tuning-server/public/tuner.html` | Survives; dropdown source + per-field override/inherited/unresolved badges |
| `src/tuning-server/engine-conf.ts` | Survives; read-only baseline resolution |
| `src/tuning-server/discover.ts` | Rewritten: scan `Prefabs/Vehicles/**/*.et`, keep those with an Engine block |
| new `src/tuning-server/et-engine-block.ts` | Brace-aware locate + surgical read/replace/insert |

Path-traversal guard, Content-Type check, and loopback bind all carry over unchanged.

## Testing

- Unit tests for the block locator against **real prefab text** as fixtures, not synthetic
  snippets — that is precisely the gap that let `enfusion-text.ts` look healthy. Include:
  a vehicle with `Simulation Wheeled` but no Engine block (Ural4320 shape), a vehicle with an
  inline full Engine block (S105_rally / BRDM2 shape), and one with a `:` conf reference and a
  single `Output` override (M151A2 shape).
- A byte-fidelity test: edit one field in a large real prefab and assert every other line is
  byte-identical and the line count is unchanged (or +1 for a single insert).
- A `+`-preservation regression test: a fixture containing `Filenames + {` must come out with the
  `+` intact — the specific way `enfusion-text.ts` fails.
- HTTP route tests over a temp addon directory, as in v1.
- Manual: point at RoadForger, confirm a vehicle with a hand-added Engine block loads real values,
  drag one slider, Apply, and `git diff` the prefab to confirm exactly one changed line.

## Risks

- **Workbench editor-vs-disk race is sharper here** than with a conf: you are far more likely to
  have the vehicle prefab open. The reload reminder from v1 stays and should name the prefab.
- The block locator is the single point of failure. It is the only new logic and it must be
  tested against real prefab text, not hand-written examples.
