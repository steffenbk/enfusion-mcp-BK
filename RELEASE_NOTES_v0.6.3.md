## v0.6.3 — Upstream Merge + Internal Refactoring

### New Features (from upstream)
- **`component_search` tool** — Search ScriptComponent descendants, filter by category (character, vehicle, weapon, damage, inventory, ai, ui) and event handlers
- **`wiki_read` tool** — Read full wiki page content by title, no truncation
- **Class hierarchy tree** — `api_search` now supports `format: 'tree'` for ASCII inheritance visualization
- **Connection health tracking** — All `wb_*` tools now report Workbench connection status
- **Inherited members** — `api_search` auto-includes methods/properties from parent classes
- **Enum-like class detection** — Classes with only static properties are surfaced in enum searches
- **Handler script recovery** — Auto-reinstalls missing handler scripts when Workbench is already running

### Bug Fixes
- **Search ranking fix** — `searchAny()` was flattening granular scores (100/80/60) into binary exact-or-not, losing ranking precision
- **Version mismatch** — `index.ts` and `package.json` now always match
- **Inherited array crash guard** — Safety check prevents Workbench crash when removing inherited-only array items

### Internal Improvements
- **Deduplicated ~300 lines** — Extracted shared utilities into `game-paths.ts` and `dir-listing.ts` (were copy-pasted across 5+ tool files)
- **KB index caching** — Knowledge base index no longer re-reads from disk on every query
- **Replaced duplicate GUID generator** — `randomHex16()` replaced with existing `generateGuid()`

### Version Scheme
Following upstream (Articulated7/enfusion-mcp) versioning: upstream = 0.6.1, this fork = 0.6.3.
