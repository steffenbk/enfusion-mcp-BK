# Enfusion MCP — Combined Upgrade Ideas

Ranked by impact-to-effort ratio. Based on full codebase audit of tools, data quality, search engine, prompt engineering, scraper pipeline, and developer workflow.

**Key finding**: 85% of Arma class briefs are empty, 88% of methods lack descriptions, hierarchy.json is empty, and 0 classes have scraped enum values. The LLM is operating with very sparse context and high hallucination surface area.

---

## Implementation Checklist

After implementing any upgrade, complete **all** of the following before marking it done:

1. **Tests** — Add or update tests for new/changed functionality. Run `npm run build && npm test` and ensure everything passes.
2. **Tool descriptions** — If a tool's capabilities changed, update its `description` string in `src/tools/*.ts` (this is what the LLM sees when deciding which tool to use).
3. **Prompts** — If the LLM needs to know about the new capability, update both `src/prompts/create-mod.ts` and `src/prompts/modify-mod.ts`.
4. **README** — If user-facing tool descriptions changed or a new tool was added, update the tools table in `README.md`.
5. **This file** — Mark the item as done: strikethrough the heading with `~~` and add `✅ Done (PR #N)`, and do the same in the Summary Table.
6. **New tools** — If adding a new tool, register it in `src/server.ts` and add a row to the README tools table.

---

## Tier 1: Quick Wins (Small Effort, High Impact)

### ~~1. Automatic Inheritance Context on Class Lookup~~ ✅ Done (PR #7)

**What**: When `api_search` returns a class result, automatically include method signatures from the first 2-3 parent classes inline. `getInheritedMembers()` already exists in `SearchEngine` but is **never called from `api_search`** — it's only wired to the `enfusion://class/{name}` MCP resource, which most LLMs don't proactively read.

**Why**: The LLM sees `SCR_BaseGameMode` inherits from `BaseGameMode` but never sees `BaseGameMode`'s overridable methods unless it makes a second lookup. This is the #1 cause of incorrect override signatures — the LLM guesses what the parent exposes. The data is already indexed; it just isn't surfaced in the primary search tool.

**Where**: `src/tools/api-search.ts` (`formatClassResult`), `src/index/search-engine.ts` (`getInheritedMembers` already exists)

**Effort**: S — The data and method exist; just needs to be wired into the formatter.

**Category**: Hallucination Prevention

---

### ~~2. Enum-Aware Search~~ ✅ Done (PR #8)

**What**: Enfusion represents many enums as classes with static properties (189 classes have >3 properties and no methods — these are enum-like structs/data classes). The current `searchEnums` only checks `cls.enums[]` which is **empty for all 8,693 classes** (0 enums scraped). Add a heuristic that surfaces these property-only classes when `type: "enum"` is searched, and tag them as enum-like in results.

**Why**: When a modder asks "what are the damage types?" or "what EResourceType values exist?", `api_search(query: "EDamageType", type: "enum")` returns 0 results. The data exists as class properties but isn't categorized as enum-like. The LLM then invents enum values.

**Where**: `src/index/search-engine.ts` (`searchEnums`, `load`), `src/tools/api-search.ts` (`formatEnumResult`)

**Effort**: S

**Category**: Context Quality

---

### ~~3. Related Classes in Search Results~~ ✅ Done (PR #8)

**What**: When a class lookup matches (e.g., `SCR_CharacterDamageManagerComponent`), also include a compact one-liner for each sibling class in the same API group — just name + brief. This gives the LLM discovery paths without requiring follow-up searches.

**Why**: Modders often ask "how do I do X" and the LLM finds one class, but the real answer involves a related class it doesn't know to search for (e.g., finding `SCR_DamageManagerComponent` but not `SCR_CharacterDamageManagerComponent`). Groups data exists (157 groups) but is only exposed as an MCP resource, never surfaced in tool search results.

**Where**: `src/tools/api-search.ts` (`formatClassResult`), `src/index/search-engine.ts` (groups already indexed)

**Effort**: S

**Category**: Context Quality

---

### ~~4. Wiki Full-Text Retrieval~~ ✅ Done

**What**: Wiki search truncates results to 2,000 characters (`MAX_LENGTH = 2000` in `wiki-search.ts:53`). Add a `wiki_read` tool (or a `fullText` parameter on `wiki_search`) that returns the full page content by title, without truncation. Alternatively, raise the limit substantially when only 1 result matches.

**Why**: The average wiki page is 8,666 chars. Truncation at 2,000 cuts off the actual tutorial code examples — the most valuable part for the LLM. The modder asks "how does replication work?" and gets the intro paragraph but not the example code.

**Where**: `src/tools/wiki-search.ts` (add `fullText` param or separate `wiki_read` tool)

**Effort**: S

**Category**: Context Quality

---

### ~~5. Component Discovery Tool~~ ✅ Done

**What**: Add a `component_search` tool (or mode in `api_search`) that specifically searches `ScriptComponent` descendants, filterable by what they attach to (entities, vehicles, characters) and what events they handle.

**Why**: `SearchEngine.getComponents()` (`src/index/search-engine.ts:479-487`) already walks all ScriptComponent descendants. But it's only used internally — there's no tool that exposes it. The most common modding question is "what component do I attach to do X?" and currently Claude has to do multiple `api_search` queries and hope the right component surfaces. A dedicated component browser with event/capability filtering would make prefab composition much faster.

**Where**: `src/index/search-engine.ts` (expose `getComponents()` with filtering), new section in `src/tools/api-search.ts` or new `src/tools/component-search.ts`

**Effort**: S — `getComponents()` already exists; needs filtering + a tool wrapper.

**Category**: Context Quality

---

### 6. Workbench Connection Health in Tool Descriptions

**What**: Make `wb_state` a lightweight pre-check that other `wb_*` tools can reference. Add a `connectionStatus` field to all `wb_*` tool responses that shows whether Workbench is connected, in play mode, or in edit mode — so Claude doesn't blindly call `wb_play` when already in play mode or call `wb_entity_create` when in play mode (which fails).

**Why**: The 20+ Workbench tools in `src/tools/wb-*.ts` all independently call `client.call()` which auto-launches Workbench on `CONNECTION_REFUSED`. But there's no state awareness between tool calls. `wb_play` while already in play mode, or `wb_entity_modify` while in play mode, causes errors that Claude has to recover from. The `wb_state` tool (`src/tools/wb-state.ts`) already returns the mode — it just isn't consulted automatically.

**Where**: `src/workbench/client.ts` (add cached state after each `rawCall`), all `src/tools/wb-*.ts` files

**Effort**: S

**Category**: UX Polish

---

### 7. Pattern Composition (Mix-and-Match)

**What**: Allow `mod_create` to accept an array of patterns instead of a single one, merging their scripts/prefabs/configs. A "game-mode + custom-faction + hud-widget" combo should produce one scaffold with all three systems wired together.

**Why**: `mod_create` (`src/tools/mod-create.ts:88`) accepts one `pattern` string. But real mods are compositions — a game mode usually needs a faction, a HUD, and a spawn system. The pattern library (`src/patterns/loader.ts`) already loads each pattern independently. The `mod_create` tool just needs to iterate over an array instead of a single pattern and handle name collisions in the `{PREFIX}` replacement.

**Where**: `src/tools/mod-create.ts` (change `pattern: z.string().optional()` to `patterns: z.array(z.string()).optional()`), `src/patterns/loader.ts`

**Effort**: S

**Category**: Composability

---

### 8. Class Hierarchy Visualization

**What**: Add a `tree` output mode to `api_search` that renders the inheritance chain as an ASCII tree, showing a class's ancestors (up to root) and immediate descendants with their key methods — a "class at a glance" view.

**Why**: `SearchEngine.getClassTree()` and `getInheritanceChain()` (`src/index/search-engine.ts:368-423`) already compute full ancestor/descendant chains. But `api_search` formats results as flat markdown lists. When Claude is deciding which class to extend, it needs to see the full hierarchy at once — "SCR_BaseGameMode → GameMode → BaseGameMode → GenericEntity" — not just the immediate parent.

**Where**: `src/tools/api-search.ts` (new `format` parameter, new `formatClassTree()` function), uses existing `SearchEngine.getInheritanceChain()` and `getClassTree()`

**Effort**: S

**Category**: Developer Experience

---

### 9. Config Validation (Beyond Parse Check)

**What**: Extend config validation in `mod_validate` to check that class names referenced in `.conf` files actually exist in the API index, and that required fields for known config types (faction configs, entity catalogs, etc.) are present.

**Why**: `checkConfigs()` in `src/tools/mod-validate.ts:173-191` only verifies that `.conf` files parse correctly via `parse(content)`. It doesn't check whether the class names and resource paths inside them are valid. A faction config referencing `"SCR_FactionManager"` (which doesn't exist — it's `SCR_Faction`) would pass validation but fail at runtime. The search engine's `hasClass()` method is already used for script reference checking in `checkReferences()` — it just needs to be applied to configs too.

**Where**: `src/tools/mod-validate.ts` (`checkConfigs` function at line 173), uses existing `SearchEngine.hasClass()`

**Effort**: S

**Category**: UX Polish

---

### 10. Dry-Run Mode for Mutation Tools

**What**: Add a `dryRun: boolean` parameter to `mod_create`, `script_create`, `prefab_create`, `config_create`, `layout_create`, and `project_write`. When true, return what *would* be created/modified without writing to disk.

**Why**: All creation tools immediately write to disk via `writeFileSync`. There's no way for Claude to preview what it's about to generate and course-correct before committing. `script_create` already has a partial pattern — when a file already exists (`src/tools/script-create.ts:78`), it returns the generated code without writing. Dry-run would generalize this.

**Where**: All tools in `src/tools/{mod,script,prefab,config,layout}-create.ts` and `src/tools/project-write.ts`

**Effort**: S

**Category**: UX Polish

---

### 11. Duplicate Code Consolidation: project_browse & game_browse

**What**: Extract the shared `listDirectory()`, `FILE_TYPE_MAP`, `formatSize()`, and `DirEntry` logic into a common utility. Both `project-browse.ts` and `game-browse.ts` have near-identical implementations (compare `src/tools/project-browse.ts:8-91` with `src/tools/game-browse.ts:9-81`).

**Why**: Two files, ~80 lines each, with copy-pasted directory listing logic. `game-browse.ts` adds `.emat` and `.sounds` to its `FILE_TYPE_MAP` but `project-browse.ts` doesn't — an inconsistency that means project browsing won't label material files. Any fix to one file has to be manually mirrored to the other.

**Where**: New `src/utils/dir-listing.ts`, refactor `src/tools/project-browse.ts` and `src/tools/game-browse.ts`

**Effort**: S

**Category**: Developer Experience

---

## Tier 2: Medium Effort, High Impact

### 12. Fuzzy Search with Typo Tolerance + Trigram Matching

> *Merged from: "Semantic Search via Trigram Index" (List 1) + "Fuzzy Search with Typo Tolerance" (List 2)*

**What**: Replace the pure substring/prefix scoring in all `SearchEngine` search methods with a hybrid approach: Levenshtein distance for typo tolerance (edit distance 1 = score 40, distance 2 = score 20) plus trigram matching on method/class names for semantic similarity. Queries like "ScriptCompnent", "GetPositon", or "get health" should all find results.

**Why**: Every search method in `SearchEngine` (`src/index/search-engine.ts:140-326`) uses strict `===`, `startsWith`, and `includes` checks. The `create-mod` prompt (`src/prompts/create-mod.ts:91-101`) specifically warns "NEVER guess API method names" because a typo returns zero results. With 88% of method descriptions empty, description-based matching almost never fires — and substring matching against method *names* only works if you already know the Enfusion naming convention. Even basic fuzzy matching would catch `GetHealth` → `GetHealthScaled` or `Damage` → `DamageManagerComponent`.

**Where**: `src/index/search-engine.ts` (add `levenshtein()` helper, integrate into `searchClasses`, `searchMethods`, `searchEnums`, `searchProperties` scoring)

**Effort**: M

**Category**: Context Quality

---

### 13. Method Signature Validator Tool

**What**: Add a `script_check` tool that takes a class name + method signature and verifies it exists in the API index, returning the correct signature if there's a close match (Levenshtein/fuzzy). Gives the LLM a lightweight "did I get this right?" check without re-searching the entire class.

**Why**: 88% of methods lack descriptions. The LLM writes `override void OnPlayerSpawned(int playerId, IEntity entity)` but the real signature has `IEntity controlledEntity`. The prompt says "verify every method" but there's no ergonomic single-method verification tool — `api_search` returns full class dumps, making verification expensive in tokens.

**Where**: New file `src/tools/script-check.ts`, `src/index/search-engine.ts` (add fuzzy signature match)

**Note**: Pairs well with #12 (fuzzy search) — shares the Levenshtein/fuzzy matching infrastructure.

**Effort**: M

**Category**: Hallucination Prevention

---

### 14. `script_create` Should Auto-Fetch Parent Methods

**What**: When `script_create` is called with a `parentClass`, automatically look up the parent class in the search engine and populate the method stubs with the actual overridable methods (virtual/protected) from the parent, instead of relying on hardcoded lists like `GAMEMODE_METHODS` and `COMPONENT_METHODS`.

**Why**: The hardcoded method lists in `src/templates/script.ts:33-95` are incomplete and will rot as the game updates. The API data already has the full method lists. A modder who says "create a component extending SCR_InventoryStorageManagerComponent" gets stubs for `EOnInit`/`OnPostInit` — generic ScriptComponent methods — instead of the actual overridable inventory methods. Currently `script_create` doesn't take a `SearchEngine` dependency at all.

**Where**: `src/tools/script-create.ts`, `src/templates/script.ts`, `src/server.ts` (inject SearchEngine dependency)

**Effort**: M

**Category**: Composability

---

### 15. Prefab Introspection + Ancestry Resolver

> *Merged from: "Base Game Prefab Introspection" (List 1) + "Prefab Ancestry Resolver" (List 2)*

**What**: Two complementary features:

1. **`asset_inspect` tool**: Read a base game `.et` prefab from PAK, parse it with the existing Enfusion text parser, and return a structured summary: entity type, components list, key property values, parent prefab reference. No raw dump — a formatted component manifest.

2. **Ancestry-aware `prefab_create`**: When `prefab_create` generates an `.et` file, automatically look up the base game prefab via `asset_search`, read it with `game_read`, and pre-populate components/properties that already exist on the parent — so the generated prefab is a proper *delta* rather than a blank slate that overwrites inherited structure.

**Why**: `prefab_create` generates prefabs from hardcoded component lists per type in `src/templates/prefab.ts:42-103`. These templates don't know what the parent prefab already provides. Users end up with prefabs that either duplicate parent components or miss required ones, causing silent failures in Workbench. The `create-mod` prompt even has to warn about MeshObject being invisible (`src/prompts/create-mod.ts:103-116`) — a problem that wouldn't exist if the tool just *read* the parent first. The `asset_inspect` tool also helps the LLM see "this prefab has MeshObject, RigidBody, and SCR_InteractionHandlerComponent" and correctly compose its own prefab.

**Where**: New file `src/tools/asset-inspect.ts` (uses `src/pak/vfs.ts` + `src/formats/enfusion-text.ts`); `src/templates/prefab.ts` + `src/tools/prefab-create.ts` (ancestry-aware generation)

**Effort**: M

**Category**: Modder Workflow + Hallucination Prevention

---

### 16. Compilation Error Feedback + Log Capture

> *Merged from: "Compilation Error Feedback Loop" (List 1) + "Workbench Console Log Capture" (List 2)*

**What**: Two complementary features for the same problem:

1. **Error parsing**: After `wb_play` or `wb_reload` fails due to compilation errors, parse the Workbench response to extract file path, line number, and error message, then automatically `project_read` the failing file and present the error in context with surrounding code lines.

2. **Log capture tool**: Add a tool that reads Workbench's script compilation output and runtime `Print()` log, so Claude can see actual error messages instead of guessing what went wrong. The Workbench NET API handler scripts (`mod/Scripts/WorkbenchGame/EnfusionMCP/`) already run inside Workbench's scripting environment and could potentially capture `Log.Info`/`Log.Error` output.

**Why**: The `create-mod` prompt workflow (`src/prompts/create-mod.ts:143`) says "If compilation failed (errors in the Workbench console), fix with project_write." But Claude has no way to *see* those errors — it can only infer compilation failed from the lack of a success response. Auto-extracting the error location and reading the surrounding code would let it fix issues in one pass instead of 3-4 round trips.

**Where**: `src/tools/wb-script-editor.ts` or new `src/tools/wb-compile-errors.ts`, `src/workbench/client.ts`; new `mod/Scripts/WorkbenchGame/EnfusionMCP/EMCP_WB_GetLog.c`, new `src/tools/wb-log.ts`

**Effort**: M

**Category**: Modder Workflow

---

### 17. Example Code Snippets in Patterns

**What**: Expand pattern JSON files to include `codeExamples` — short, complete, working Enfusion code snippets (3-15 lines) for common operations within that pattern. Inject these into the create-mod prompt context when the pattern is selected.

**Why**: The current 10 patterns in `data/patterns/*.json` define class names and method stubs but give zero example logic. The LLM then writes the body of `override void OnPlayerConnected(int playerId)` by guessing at Enfusion API calls. Having a known-working 5-line snippet for "spawn a character at a spawn point" eliminates entire categories of hallucination.

**Where**: `data/patterns/*.json` (add `codeExamples` field), `src/patterns/loader.ts` (type update), `src/prompts/create-mod.ts` (inject into context)

**Effort**: M (writing correct snippets requires Enfusion domain knowledge)

**Category**: Hallucination Prevention

---

### 18. Common Pitfalls Context Injection

**What**: Maintain a structured list of known Enfusion gotchas (e.g., "scripts in Scripts/GameLib/ won't load for mods", "modded classes are global", "EntityEvent.FRAME requires SetEventMask", "`ref` keyword for reference types") and inject the relevant ones based on what the LLM is creating (detected from script_create type, api_search queries, etc.).

**Why**: The create-mod prompt already includes several hardcoded warnings (mesh requirement, API verification rule). But these are static. A data-driven pitfall system could match against context — if the LLM is creating an entity with `EOnFrame`, auto-inject the `SetEventMask` requirement. This catches the long tail of Enfusion-specific traps that aren't in the docs.

**Where**: New `data/pitfalls.json`, `src/tools/script-create.ts`, `src/prompts/create-mod.ts`

**Effort**: M

**Category**: Hallucination Prevention

---

### 19. Validation-Driven Fix Suggestions

**What**: Extend `mod_validate` to return machine-actionable fix objects alongside each `ValidationIssue` — e.g., `{ fix: "move", from: "Scripts/MySrc.c", to: "Scripts/Game/MySrc.c" }` — so the LLM (or a future `mod_fix` tool) can apply fixes automatically instead of requiring the user to interpret text warnings.

**Why**: `mod_validate` (`src/tools/mod-validate.ts`) currently returns human-readable strings like `"Scripts/MySrc.c: Script is outside a valid module folder — it will be silently ignored"`. Claude has to parse these strings, figure out the fix, then call `project_write` or `project_read` to move files. Every validation check in `checkStructure`, `checkScripts`, `checkGproj`, `checkReferences`, and `checkNaming` has an obvious programmatic fix that could be expressed as a structured action.

**Where**: `src/tools/mod-validate.ts` (extend `ValidationIssue` interface at line 9), new `src/tools/mod-fix.ts`

**Effort**: M

**Category**: Power Feature

---

### 20. Cross-Index "Used By" Backlinks

**What**: Add reverse-lookup to `SearchEngine`: given a class, find all classes that *reference* it (as parent, parameter type, return type, or property type). Expose via a new `usedBy` field in `api_search` results and the `enfusion://class` resource.

**Why**: The search engine (`src/index/search-engine.ts`) indexes forward relationships — parents, children, methods, properties — but has no reverse index. When Claude is writing a modded class and needs to know "what calls this method?" or "what other components use this class as a property type?", it has to do speculative `api_search` queries. A reverse index would make composition discovery instant, especially for the 8,693 indexed classes.

**Where**: `src/index/search-engine.ts` (new `Map<string, string[]>` for usedBy, built in `load()` at line 48), `src/tools/api-search.ts` (format output), `src/resources/class-resource.ts`

**Effort**: M

**Category**: Power Feature

---

### 21. MODPLAN as Structured Data

**What**: Replace the freeform markdown MODPLAN.md with a structured JSON/YAML format that tools can read and write programmatically. Add a `mod_plan` tool that can query plan status, mark phases complete, and generate the next phase's task list.

**Why**: Both prompts (`src/prompts/create-mod.ts:46-75` and `src/prompts/modify-mod.ts:34-36`) rely on MODPLAN.md as the handoff document between sessions. But it's freeform markdown that Claude has to parse with `project_read` and rewrite with `project_write`. A structured format with typed fields (phases, status, files, architecture notes) would make the handoff reliable instead of hoping Claude correctly parses the previous Claude's markdown.

**Where**: New `src/tools/mod-plan.ts`, updates to `src/prompts/create-mod.ts` and `src/prompts/modify-mod.ts`

**Effort**: M

**Category**: Power Feature

---

### 22. Incremental Asset Index

**What**: Replace the session-scoped module-level cache for asset search (`let cachedIndex: AssetEntry[] | null = null` at `src/tools/asset-search.ts:29`) with a persistent on-disk index that uses file modification timestamps to incrementally update only changed files.

**Why**: The asset index rebuilds by walking the entire game directory + all `.pak` files on first search each session. For a full Arma Reforger install, this is thousands of files. The log line at `asset-search.ts:83` (`Asset index built: ${entries.length} files in ${elapsed}ms`) shows this is a blocking cold-start cost. A persisted index with mtime-based invalidation would make first searches instant on subsequent sessions.

**Where**: `src/tools/asset-search.ts` (replace `cachedIndex`/`cachedBasePath` with file-backed cache), possibly new `src/utils/cache.ts`

**Effort**: M

**Category**: Developer Experience

---

### 23. Multi-Mod Workspace Support

**What**: Currently `ENFUSION_PROJECT_PATH` points to a single addon. Support a workspace model where the path points to the `addons/` directory and tools accept a `modName` parameter to select which addon to operate on. `project_browse` would list all addons in the workspace, and creation tools would scope to the selected one.

**Why**: Many modders work on multiple mods simultaneously. The current single-path design means switching mods requires restarting the MCP server or passing `projectPath` on every call. `mod_create` already creates subdirectories under `projectPath`, but other tools don't navigate them well.

**Where**: `src/config.ts`, all tools that use `config.projectPath`

**Effort**: M

**Category**: Modder Workflow

---

### 24. Diff-Based Script Patching (Read-Modify-Write)

> *Merged from: "Diff-Based Project Write" (List 1) + "Smart Script Patching" (List 2)*

**What**: Add a `script_patch` / `project_patch` tool that supports targeted modifications without rewriting entire files. Two approaches:

1. **Diff-based**: Accept a file path and a diff (old lines → new lines), rather than requiring the LLM to re-emit the entire file via `project_write`.

2. **Structure-aware** (stretch): Parse `.c` files structurally (class name, methods, member variables) and support targeted operations — add method, modify method body, add member variable, add import. The codebase already has the regex patterns for parsing class declarations and method signatures in `src/tools/mod-validate.ts:132-133` and `src/templates/script.ts:329-354` — they just aren't composed into a structural editor.

**Why**: For any script modification, the LLM currently must `project_read` (consuming tokens for the full file), then `project_write` the entire file again (emitting all tokens). For a 200-line script where it's changing 5 lines, this is 95% waste. A patch-based tool would let it emit only the changed lines, saving tokens and reducing error surface.

**Where**: New `src/tools/script-patch.ts` or `src/tools/project-patch.ts`, reuses parsing from `src/templates/script.ts` (`extractMethodName`, `extractParamNames`, `stripOverride`)

**Effort**: M (diff approach) to L (structural approach)

**Category**: Power Feature + Token Efficiency

---

## Tier 3: Larger Effort, High Impact

### 25. Cross-Reference Validation on Write

**What**: When `project_write` writes a `.c` script, run a lightweight static check: extract class references and method calls via regex, verify them against the API index. Return warnings inline ("Warning: `HitZone.SetHealth()` not found in API — did you mean `SCR_CharacterDamageManagerComponent.FullHeal()`?").

**Why**: The prompt instructs "verify every method with api_search" but the LLM often doesn't. Doing it automatically on write catches hallucinated API calls before the modder even tries to compile. The existing `mod_validate` tool only checks parent class references (`checkReferences` at `src/tools/mod-validate.ts:194`), not method calls within scripts.

**Where**: `src/tools/project-write.ts`, `src/index/search-engine.ts`

**Effort**: L

**Category**: Hallucination Prevention

---

### 26. Component Compatibility Matrix

**What**: Build a mapping of which components commonly co-occur on entity types in the base game. Add a `type: "components"` search mode to `api_search` that, given an entity type (e.g., `GenericEntity`, `SCR_ChimeraCharacter`), returns which components are typically attached. Derive this by scanning base game `.et` files during asset indexing.

**Where**: `src/tools/asset-search.ts` (extend indexing), new data structure in `src/index/`

**Why**: Enfusion components have implicit compatibility rules (some require others, some conflict). The LLM frequently attaches incompatible components — e.g., putting `WeaponComponent` on a `GenericEntity` without the required `BaseWeaponManagerComponent`. A compatibility matrix derived from base game prefabs would prevent this.

**Effort**: L

**Category**: Hallucination Prevention

---

## Summary Table

| # | Idea | Effort | Category | Sources |
|---|------|--------|----------|---------|
| ~~1~~ | ~~Automatic Inheritance Context~~ ✅ | S | Hallucination Prevention | L1 |
| ~~2~~ | ~~Enum-Aware Search~~ ✅ | S | Context Quality | L1 |
| ~~3~~ | ~~Related Classes in Search Results~~ ✅ | S | Context Quality | L1 |
| ~~4~~ | ~~Wiki Full-Text Retrieval~~ ✅ | S | Context Quality | L1 |
| ~~5~~ | ~~Component Discovery Tool~~ ✅ | S | Context Quality | L2 |
| 6 | Workbench Connection Health | S | UX Polish | L2 |
| 7 | Pattern Composition | S | Composability | L2 |
| 8 | Class Hierarchy Visualization | S | Developer Experience | L2 |
| 9 | Config Validation (Semantic) | S | UX Polish | L2 |
| 10 | Dry-Run Mode for Mutation Tools | S | UX Polish | L2 |
| 11 | Duplicate Code Consolidation | S | Developer Experience | L2 |
| 12 | Fuzzy Search + Trigram Matching | M | Context Quality | L1+L2 merged |
| 13 | Method Signature Validator | M | Hallucination Prevention | L1 |
| 14 | Auto-Fetch Parent Methods | M | Composability | L1 |
| 15 | Prefab Introspection + Ancestry | M | Modder Workflow | L1+L2 merged |
| 16 | Compilation Error + Log Capture | M | Modder Workflow | L1+L2 merged |
| 17 | Example Code Snippets in Patterns | M | Hallucination Prevention | L1 |
| 18 | Common Pitfalls Context Injection | M | Hallucination Prevention | L1 |
| 19 | Validation-Driven Fix Suggestions | M | Power Feature | L2 |
| 20 | Cross-Index "Used By" Backlinks | M | Power Feature | L2 |
| 21 | MODPLAN as Structured Data | M | Power Feature | L2 |
| 22 | Incremental Asset Index | M | Developer Experience | L2 |
| 23 | Multi-Mod Workspace Support | M | Modder Workflow | L1 |
| 24 | Diff-Based Script Patching | M-L | Power Feature | L1+L2 merged |
| 25 | Cross-Reference Validation on Write | L | Hallucination Prevention | L1 |
| 26 | Component Compatibility Matrix | L | Hallucination Prevention | L1 |

---

## Data Quality Summary

| Metric | Value | Concern |
|--------|-------|---------|
| Arma classes indexed | 7,881 | Good coverage |
| Enfusion classes indexed | 812 | Good coverage |
| Empty class briefs | 85% | LLM has minimal context for class purpose |
| Empty method descriptions | 88% | LLM must guess method behavior from name alone |
| Scraped enum values | 0 | Enum search returns nothing; scraper misses Enfusion enum format |
| hierarchy.json entries | 0 | Empty file; inheritance relies solely on per-class parents[] |
| Wiki pages | 258 | Decent, but truncated to 2K chars in search results |
| Avg wiki page length | 8,666 chars | 75% of content is lost to truncation |

---

## Merge Notes

Four items were merged from overlapping ideas across both lists:

1. **#12 Fuzzy Search + Trigram Matching** — "Semantic Search via Trigram Index" (L1#10) + "Fuzzy Search with Typo Tolerance" (L2#9). Both address the same core problem: search fails on anything that isn't an exact/prefix/substring match.

2. **#15 Prefab Introspection + Ancestry Resolver** — "Base Game Prefab Introspection" (L1#7) + "Prefab Ancestry Resolver" (L2#1). Both address reading base game prefabs. L1's `asset_inspect` tool is the foundation; L2's ancestry-aware `prefab_create` is the application of that data.

3. **#16 Compilation Error + Log Capture** — "Compilation Error Feedback Loop" (L1#9) + "Workbench Console Log Capture" (L2#10). Both address the same blind spot: Claude can't see Workbench error output.

4. **#24 Diff-Based Script Patching** — "Diff-Based Project Write" (L1#13) + "Smart Script Patching" (L2#4). Both address the token-wasteful full-file rewrite pattern. The diff approach is simpler; the structural approach is more powerful.
