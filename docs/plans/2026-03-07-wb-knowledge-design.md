# Design: wb_knowledge Tool

Date: 2026-03-07

## Goal

Add a `wb_knowledge` MCP tool that gives any AI using the Enfusion MCP access to the Arma Reforger modding knowledge base (KB) — a set of distilled pattern files covering scripting, audio, weapons, vehicles, AI, UI, and all other modding domains.

## File Layout

```
data/
  kb/
    index.json                  ← routing map (pre-built from INDEX.md)
    patterns/
      Scripting_And_Core/
        enforceScript-language.md
        entity-lifecycle.md
        multiplayer-replication.md
        config-system.md
        serialization.md
        resource-usage.md
        script-invoker.md
        input-manager.md
        scripting-best-practices.md
      Tools_And_Workbench/
        workbench-plugins.md
        world-editor.md
        particle-editor.md
        resource-manager-blender.md
        mcp-net-api.md
      Weapons_And_Attachments/
        weapon-components.md
      UI_And_Interface/
        ui-dialogs-tooltips.md
      Modding_And_Extensions/
        modding-basics.md
        prop-creation.md
        game-master.md
        ui-notifications-hints.md
        scripting-misc.md
        faction-creation.md
      Vehicles_And_Physics/
        physics-transforms.md
        damage-vehicles.md
        vehicle-modding.md
      AI_And_Behavior/
        behavior-tree.md
        navmesh-terrain.md
      Audio_And_Sound/
        audio-system.md
      Terrain_And_Environment/
        world-environment.md
      GameModes_And_Scenarios/
        scenario-framework.md
        capture-and-hold.md
      Inventory_And_Damage/
        damage-system.md
      Character_And_Animation/
        gadgets-actions.md
        character-gear-and-anim-data.md
```

## index.json Structure

Array of file entries. Each entry has:
- `path` — relative path inside `data/kb/patterns/`
- `title` — human-readable file title
- `description` — one-line summary of contents (from INDEX.md)
- `keywords` — array of lowercase keyword strings used for query routing

Example:
```json
[
  {
    "path": "Scripting_And_Core/enforceScript-language.md",
    "title": "EnforceScript Language",
    "description": "Language quirks, types, OOP, casting, collections, preprocessor, naming conventions, pitfalls",
    "keywords": ["script", "enforce", "language", "types", "oop", "cast", "collection", "enum", "preprocessor", "naming", "pitfall", "string", "array", "map", "class", "interface"]
  }
]
```

## Tool Behavior

**Input:**
- `query` (string, required) — topic to look up
- `max_files` (number, optional, default 2, max 4) — how many pattern files to return

**Routing logic (`src/tools/kb-loader.ts`):**
1. Load `index.json` from the `data/kb/` directory.
2. Tokenize query (lowercase, split on whitespace/punctuation).
3. Score each entry: +2 per keyword match in `keywords`, +1 per token match in `title`/`description`.
4. Return top N entries by score.
5. If no entry scores above 0: return the index summary (all titles + descriptions) so the caller can orient itself.

**Output:**
- For each matched file: render `## <title>` header + full markdown content.
- If falling back to index: render a formatted list of all available topics.

**Edge cases:**
- Empty query or query `"index"` or `"list"`: always return index summary.
- File read error: skip that file, log warning, continue with others.

## New Files

| File | Role |
|---|---|
| `data/kb/index.json` | Pre-built routing map |
| `data/kb/patterns/**/*.md` | Copied KB markdown files |
| `src/tools/kb-loader.ts` | Loads index.json, scores queries, reads markdown |
| `src/tools/wb-knowledge.ts` | MCP tool registration |

## Changed Files

| File | Change |
|---|---|
| `src/server.ts` | Import and register `registerWbKnowledge` |

No changes to `SearchEngine`, `wiki_search`, or `src/index/` loader.

## Non-Goals

- No semantic/embedding search — keyword scoring is sufficient for targeted pattern lookup.
- No integration with `wiki_search` — `wb_knowledge` is a separate tool with separate data.
- No hot-reload of markdown files — files are read on each tool call (simple, no caching needed).
