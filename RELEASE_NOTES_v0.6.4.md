## v0.6.4 — Prefab Inspector + Component Listing Fixes

### New Features

- **`prefab_inspect` tool** — Inspect any `.et` prefab and its full inheritance chain. Reads each ancestor prefab, parses all components, and returns a fully merged view showing which ancestor each component comes from. Child values override parent values (matched by component GUID). Works transparently across loose files, extracted files, and `.pak` archives. This solves a key pain point: opening a prefab in Workbench only shows overridden values — `prefab_inspect` gives you the complete inherited component tree.

- **`wb_component` — entity index support** — `wb_component list` now accepts an `entityIndex` parameter in addition to `entityName`. This allows listing components on unnamed entities (e.g. prefabs placed in a scene that have no name set in the hierarchy).

### Bug Fixes

- **`wb_component list` — empty name guard** — Fixed early return that blocked `entityIndex`-based lookups when `entityName` was empty.
- **`wb_component list` — Unknown component entries** — Components with empty class names are now filtered out in the JS layer, removing spurious "Unknown" entries from the list output.

### Notes

- `prefab_inspect` output can be large for deep vehicle/character chains (20+ ancestor levels). A `component_filter` parameter may be added in a future release to narrow results.
- The `wb_component` bridge script (`EMCP_WB_Components.c`) has been updated in the EnfusionMCP addon with the entity index support and empty-name guard changes.
