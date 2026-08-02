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

New subsystem inside `enfusion-mcp` (not RoadForger) — this is generic to any vehicle entity, so
it belongs with the tool that already owns the Workbench connection (`WorkbenchClient` in
`src/workbench/client.ts`), not duplicated into a game mod.

A small standalone local HTTP server, run as its own process alongside (not replacing) the MCP
stdio server. The browser tuner page talks to this server directly — no Claude/MCP tool call in
the loop for reading or applying values.

```
Browser tuner page  <--fetch/POST-->  tuning-server (Node, local)  <--TCP NET API-->  Workbench
                                              |
                                    reuses existing WorkbenchClient
                                    calls existing EMCP_WB_ModifyEntity handler
```

## Components

- **`src/tuning-server/server.ts`** — plain Node `http` server (no new framework dependency).
  Routes:
  - `GET /api/entities` — lists candidate vehicle entities in the currently open World Editor
    scene (enumerate via `WorldEditorAPI.GetEditorEntityCount`/`GetEditorEntity`, same call the
    existing `FindEntityByName` helper in `EMCP_WB_ModifyEntity.c` already uses).
  - `GET /api/entities/:name/engine` — reads all 9 engine fields for the named entity.
  - `POST /api/entities/:name/engine` — writes all 9 fields back.
  - `GET /` — serves the static tuner page.
- **`src/tuning-server/engine-fields.ts`** — single source of truth: each slider ID maps to its
  real component path (`propertyPath` = component class name, `propertyKey`/nested path = field).
  Keeps the field list from silently drifting away from the schema confirmed against
  `Engine_M151.conf`.
- **Static tuner page** — the existing HTML tool's Engine tab (canvas graph + slider math
  unchanged, it already works), with the other three tabs removed for v1, plus:
  - a vehicle dropdown populated from `/api/entities`
  - a Fetch step on vehicle selection (populates sliders from live values)
  - an Apply button (POSTs current slider values)
  - a status banner for success/error, including partial-failure detail (see Error handling)

## Data flow

1. Page loads → `GET /api/entities` → dropdown fills.
2. User picks a vehicle → `GET /api/entities/:name/engine` → server calls
   `EMCP_WB_ModifyEntity` (`action: "getProperty"`) once per field → JSON back to browser →
   sliders initialize to live values, graph draws immediately.
3. Slider drags are pure browser-side math (unchanged from the existing tool) — no round trip,
   stays instant.
4. Click Apply → `POST` with all 9 current values → server calls `setProperty` per field, wrapped
   in one `BeginEntityAction`/`EndEntityAction` pair server-side (matching the existing handler's
   own pattern for multi-field edits) → response reports per-field success/failure, not just a
   single pass/fail — if field 5 of 9 fails mid-batch, the UI shows exactly which fields wrote and
   which didn't.

Apply target is edit-mode only: values are written into the prefab's stored data via
`SetVariableValue`, same effect as hand-editing in the Workbench property panel. This does not
push into a live running vehicle instance — feeling the change still requires the normal
reload/recompile step. (Live-instance push was considered and explicitly deferred — more complex,
needs a running entity reference not just a prefab source, and doesn't persist without a separate
save.)

## Key open risk — verify before building the rest

`getProperty`/`setProperty` on `EMCP_WB_ModifyEntity` navigate nested paths via `propertyPath`
(component class name) + `propertyKey`. Every existing confirmed use is **one level deep**
(component → field). This design needs **two levels**:
`VehicleWheeledSimulation → Simulation Wheeled → Engine → MaxPower`.

This has not been confirmed to work. **First implementation step must be a spike**: read/write a
single field (`MaxPower`) through the generic path builder and diff the result against
`Engine_M151.conf` on disk before building the other 8 fields or any UI on top of it.

**Fallback if the generic path builder can't reach that depth:** a dedicated new Workbench handler
script, `EMCP_WB_GetSetEngineCurve.c`, that navigates
`GetObject("Simulation Wheeled").GetObject("Engine")` directly via the container API instead of
through `BuildPathEntries`/`SetVariableValue`'s generic dot-path walk.

## Error handling

- Workbench not running, entity not found, or a property write failing → the existing handler's
  `{status: "error", message}` shape is passed straight through to a visible banner in the tuner
  UI — never silently swallowed.
- Partial-apply is a first-class case, not an edge case: the POST response lists per-field
  outcome so the user knows exactly what did and didn't take effect.

## Testing

- Unit test `engine-fields.ts`'s mapping table — cheap, catches a path/typo error before it causes
  a silent wrong-field write.
- Integration-style test for both routes, mocking `WorkbenchClient` the same way existing
  `tests/tools/*.test.ts` do — verifies request/response shape without a live Workbench.
- Manual verification step, not implicit: after the nested-path spike succeeds, read the M151's
  live engine values through the bridge and diff against `Engine_M151.conf` on disk. If they
  don't match, the path mapping is wrong before anything else gets built on it.
