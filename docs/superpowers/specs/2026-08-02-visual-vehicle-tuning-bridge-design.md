# Visual Vehicle Tuning Bridge — Design

## Problem

Tuning Arma Reforger vehicle engine curves today means hand-editing `.et`/`Engine.conf` fields
blind, reloading in Workbench, and driving the vehicle to feel the change. There's a browser-based
tuning tool (`arma_reforger_vehicle_tuner.html`) that visualizes the Pacejka tire model and the
engine power/torque/RPM curve with live graphs — but it's disconnected from the actual game data.
Its Engine tab field names (`MaxPower`, `MaxTorque`, `RpmMaxPower`, `RpmMaxTorque`, `RpmIdle`,
`RpmMax`, `Steepness`, `Friction`, `Inertia`) were confirmed to match the real
`Prefabs/Vehicles/Core/Configs/Engines/Engine_*.conf` schema exactly (verified against
`Engine_M151.conf`).

Goal: let the user drag sliders in that browser tool, see the curve reshape live (already works),
and write the tuned values straight into the selected vehicle's real prefab data in Workbench —
without going through an LLM round trip for every tweak.

## Scope (v1)

Engine curve only. Not in scope for this pass:
- Pacejka tire coefficients (per `physics-transforms.md`, the wiki reports these may not affect
  in-game behavior at all — visually tuning something possibly inert isn't worth building first).
- TerrainDrag mud/terrain multipliers (RoadForger's own live levers — different graph shape
  entirely, separate design effort).
- Gearbox ratios / suspension.

## Architecture

**Correction from the first draft of this spec:** engine data is not an inline per-vehicle-entity
property. `Engine_M151.conf` (and its siblings under
`Prefabs/Vehicles/Core/Configs/Engines/`) is its own standalone resource file, referenced by a
vehicle's `.et`. `WorldEditorAPI`'s entity-property calls (`SetVariableValue`/`getProperty` via
`EMCP_WB_ModifyEntity`) operate on entity *instances placed in an open world* — editing a
reference through that path doesn't change the underlying curve numbers, and there's no confirmed
API for walking three levels into a nested sub-object that way regardless. The actual resource is
a **trivial flat text format**:

```
Engine {
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
```

So this needs no Workbench connection at all: a small local HTTP server in `enfusion-mcp` reads
and writes that `.conf` file directly. The browser tuner page talks to this server directly — no
Claude/MCP tool call in the loop for reading or applying values.

```
Browser tuner page  <--fetch/POST-->  tuning-server (Node, local)  <--plain file I/O-->  Engine_*.conf
```

## Components

- **`src/tuning-server/server.ts`** — plain Node `http` server (no new framework dependency).
  Routes:
  - `GET /api/engines` — lists available engine `.conf` files (glob
    `Prefabs/Vehicles/Core/Configs/Engines/*.conf` under the configured project path).
  - `GET /api/engines/:file` — reads and parses all 9 engine fields from the named `.conf`.
  - `POST /api/engines/:file` — writes all 9 fields back into that `.conf`, preserving its
    existing key order/formatting.
  - `GET /` — serves the static tuner page.
- **`src/tuning-server/engine-conf.ts`** — parse/serialize module: `parseEngineConf(text)` →
  typed record of the 9 fields, `serializeEngineConf(original, values)` → new text with only the
  9 known keys' values replaced, everything else (braces, unknown keys, formatting) left intact.
  Single source of truth for the field list, keeping it from drifting away from the schema
  confirmed against `Engine_M151.conf`.
- **Static tuner page** — the existing HTML tool's Engine tab (canvas graph + slider math
  unchanged, it already works), with the other three tabs removed for v1, plus:
  - an engine-file dropdown populated from `/api/engines`
  - a Fetch step on selection (populates sliders from the file's current values)
  - an Apply button (POSTs current slider values)
  - a status banner for success/error, and a persistent reminder after a successful Apply: *"If
    this engine's vehicle prefab is open in Workbench, reload it — Workbench silently reverts
    external file edits to a prefab it has open."* (see `physics-transforms.md`'s documented
    editor-vs-disk race)

## Data flow

1. Page loads → `GET /api/engines` → dropdown fills with engine `.conf` filenames.
2. User picks one → `GET /api/engines/:file` → server reads the file, parses the 9 fields →
   JSON back to browser → sliders initialize to real values, graph draws immediately.
3. Slider drags are pure browser-side math (unchanged from the existing tool) — no round trip,
   stays instant.
4. Click Apply → `POST` with all 9 current values → server re-serializes the file with those
   values and writes it → response reports success/failure plus the Workbench-reload reminder.

No live-instance push: this only ever edits the `.conf` file on disk. Feeling the change still
requires Workbench to pick up the file (auto-detected if the prefab isn't currently open, or a
manual reload if it is — see the reminder above).

## Former risk section — resolved

The original draft flagged an unverified nested-path risk in `EMCP_WB_ModifyEntity`'s
`getProperty`/`setProperty` actions. That's moot now: this design doesn't use `WorkbenchClient` or
the NET API for engine data at all, so that risk doesn't apply. `EMCP_WB_ModifyEntity` remains
untouched by this feature.

## Error handling

- File not found, unreadable, or a required key missing from the `.conf` → `{status: "error",
  message}` passed straight through to a visible banner in the tuner UI — never silently
  swallowed.
- Write failure (e.g. file locked, permissions) surfaces the OS error message directly rather than
  a generic "failed to save."
- The Workbench-reload reminder (see Components) always shows after a successful Apply, not
  conditionally — the server has no way to know whether the prefab is currently open in Workbench.

## Testing

- Unit tests for `engine-conf.ts`: `parseEngineConf` against the real `Engine_M151.conf` fixture
  content (asserts all 9 fields extracted correctly), and `serializeEngineConf` round-trips
  (parse → serialize → parse again yields the same values; unknown keys/formatting survive
  untouched).
- Integration-style test for both routes using a temp `.conf` file written to a test tmp
  directory — verifies request/response shape and that the file on disk actually changed after
  POST, following the existing project convention of no network mocking needed for pure file I/O.
- Manual verification step, not implicit: point the server at the real
  `Prefabs/Vehicles/Core/Configs/Engines/` directory, fetch `Engine_M151.conf` through the API,
  and diff the returned JSON against the file's own contents before trusting Apply on a real file.
