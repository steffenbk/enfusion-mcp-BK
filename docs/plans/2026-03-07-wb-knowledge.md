# wb_knowledge Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `wb_knowledge` MCP tool that searches bundled Arma Reforger modding pattern files using a pre-built keyword index, giving any AI using the MCP access to the full KB without needing the local `arma-knowledge` folder.

**Architecture:** The KB markdown files are copied into `data/kb/patterns/` and a `data/kb/index.json` routing map is bundled alongside them. At query time, `kb-loader.ts` tokenizes the query, scores entries by keyword overlap, reads the top N matched files from disk, and returns their content. No pre-loading, no caching, no changes to SearchEngine.

**Tech Stack:** Node.js (fs/path), TypeScript, `@modelcontextprotocol/sdk`, zod

---

### Task 1: Create the data directory structure and copy KB files

**Files:**
- Create: `data/kb/patterns/` (directory tree)
- Source: `C:\Users\Steffen\.claude\arma-knowledge\patterns\` (all `.md` files)

**Step 1: Create the kb directory and copy all pattern files**

Run this from the repo root (`C:\Users\Steffen\Documents\A_documents\Github\enfusion-mcp-BK`):

```bash
mkdir -p data/kb/patterns
cp -r "C:/Users/Steffen/.claude/arma-knowledge/patterns/." data/kb/patterns/
```

**Step 2: Verify the copy**

```bash
find data/kb/patterns -name "*.md" | wc -l
```

Expected: 25+ files across subdirectories like `Scripting_And_Core/`, `Audio_And_Sound/`, etc.

**Step 3: Commit**

```bash
git add data/kb/patterns/
git commit -m "feat: add KB pattern markdown files to data/kb/patterns"
```

---

### Task 2: Create `data/kb/index.json`

**Files:**
- Create: `data/kb/index.json`

This is the routing map. Each entry describes one markdown file with keywords for matching.

**Step 1: Create the index file**

Create `data/kb/index.json` with the following content:

```json
[
  {
    "path": "Scripting_And_Core/enforceScript-language.md",
    "title": "EnforceScript Language",
    "description": "Language quirks, types, OOP, casting, collections, preprocessor, naming conventions, pitfalls",
    "keywords": ["script", "enforce", "language", "types", "oop", "cast", "collection", "enum", "preprocessor", "naming", "pitfall", "string", "array", "map", "class", "interface", "variable", "function", "operator", "autoptr", "ref", "typename"]
  },
  {
    "path": "Scripting_And_Core/entity-lifecycle.md",
    "title": "Entity Lifecycle",
    "description": "Entity/component creation patterns, full lifecycle table, activeness post-0.9.8, user actions, LOD, collision layers, environment metrics",
    "keywords": ["entity", "lifecycle", "component", "create", "spawn", "delete", "init", "postinit", "active", "inactive", "lod", "collision", "layer", "user", "action", "environment", "metric", "event"]
  },
  {
    "path": "Scripting_And_Core/multiplayer-replication.md",
    "title": "Multiplayer Replication",
    "description": "Architecture, entity roles, RPC, RplProp, RplSave/Load, server guard, angular velocity, CRC mismatch, DS-excluded components",
    "keywords": ["multiplayer", "replication", "rpc", "rplprop", "rplsave", "rplload", "server", "client", "authority", "proxy", "network", "sync", "broadcast", "crc", "ds", "dedicated", "role"]
  },
  {
    "path": "Scripting_And_Core/config-system.md",
    "title": "Config System",
    "description": "BaseContainerProps/Attribute decorators, .conf usage patterns, BaseContainer API, WorldEditorAPI SetVariableValue, prefab data, file types",
    "keywords": ["config", "conf", "basecontainer", "attribute", "decorator", "property", "prefab", "data", "container", "variable", "value", "set", "get", "register", "class", "inherit"]
  },
  {
    "path": "Scripting_And_Core/serialization.md",
    "title": "Serialization",
    "description": "JSON/Binary serialization contexts, object serialization, JsonApiStruct, file operations",
    "keywords": ["serialization", "serialize", "json", "binary", "file", "save", "load", "read", "write", "jsonapistruct", "context", "object", "persist"]
  },
  {
    "path": "Scripting_And_Core/resource-usage.md",
    "title": "Resource Usage",
    "description": "Resource lifetime rules, correct/wrong patterns, CreateInstanceFromContainer exception",
    "keywords": ["resource", "lifetime", "resourcename", "load", "unload", "instance", "container", "memory", "leak", "reference"]
  },
  {
    "path": "Scripting_And_Core/script-invoker.md",
    "title": "Script Invoker",
    "description": "Typed ScriptInvoker pattern, lazy creation, common game events via EventHandlerManagerComponent",
    "keywords": ["scriptinvoker", "invoker", "event", "handler", "callback", "subscribe", "insert", "remove", "signal", "delegate", "eventhandler"]
  },
  {
    "path": "Scripting_And_Core/input-manager.md",
    "title": "Input Manager",
    "description": "Action types, input sources, filters, contexts, reading input in script",
    "keywords": ["input", "action", "key", "button", "mouse", "gamepad", "context", "filter", "bind", "press", "hold", "release", "axis", "inputmanager"]
  },
  {
    "path": "Scripting_And_Core/scripting-best-practices.md",
    "title": "Scripting Best Practices",
    "description": "Early return, caching, performance principles, spread pattern, profiling, modding hooks, REST API, RichText, game mode setup",
    "keywords": ["best", "practice", "performance", "cache", "profile", "modding", "hook", "modded", "override", "rest", "api", "richtext", "game", "mode", "setup", "pattern", "convention"]
  },
  {
    "path": "Tools_And_Workbench/workbench-plugins.md",
    "title": "Workbench Plugins",
    "description": "WorldEditorPlugin/ScriptEditorPlugin structure, ScriptDialog, FileIO, CreateEntityTemplate, Code Formatter, Fill From Template, Object Brush, String Editor",
    "keywords": ["workbench", "plugin", "worldeditor", "scripteditor", "dialog", "fileio", "template", "brush", "editor", "tool", "attribute", "menu", "shortcut"]
  },
  {
    "path": "Tools_And_Workbench/world-editor.md",
    "title": "World Editor",
    "description": "WE shortcuts, all tools, generators, WorldEditorAPI, Plugin vs Tool, WorkbenchPluginAttribute, metadata, links",
    "keywords": ["world", "editor", "we", "terrain", "navmesh", "prefab", "generator", "road", "powerline", "worldeditorapi", "entity", "place", "meta", "link", "shortcut", "tool"]
  },
  {
    "path": "Tools_And_Workbench/particle-editor.md",
    "title": "Particle Editor",
    "description": "LOD system, emitter properties, material editor, animation panel, pitfalls",
    "keywords": ["particle", "emitter", "lod", "material", "animation", "effect", "vfx", "texture", "sheet", "lifetime", "emission", "physics", "graph"]
  },
  {
    "path": "Tools_And_Workbench/resource-manager-blender.md",
    "title": "Resource Manager & Blender",
    "description": "Resource Manager UI, FBX import rules, collider naming, texture import, batch plugins, Enfusion Blender Tools features, probes/portals/BSP",
    "keywords": ["resource", "manager", "blender", "fbx", "import", "lod", "collider", "texture", "material", "mesh", "model", "asset", "ebt", "probe", "portal", "bsp", "building"]
  },
  {
    "path": "Tools_And_Workbench/mcp-net-api.md",
    "title": "MCP Net API",
    "description": "EnfusionMCP NetApiHandler skeleton, SetVariableValue, reading properties, array operations, GUID fix",
    "keywords": ["mcp", "net", "api", "netapi", "handler", "variable", "guid", "workbench", "connect", "request", "response", "enfusionmcp"]
  },
  {
    "path": "Weapons_And_Attachments/weapon-components.md",
    "title": "Weapon Components",
    "description": "Required component stack, MuzzleComponent, SightsComponent, obstruction system, stat-modifying attachments, collimator creation, slot/bone naming, animation system, suppressor workflow, PIP optic workflow",
    "keywords": ["weapon", "gun", "muzzle", "sight", "optic", "suppressor", "attachment", "slot", "bone", "animation", "pip", "scope", "collimator", "reticle", "component", "magazine", "ammo", "fire", "reload"]
  },
  {
    "path": "UI_And_Interface/ui-dialogs-tooltips.md",
    "title": "UI Dialogs & Tooltips",
    "description": "SCR_ConfigurableDialogUi (3 usage patterns), widget tooltips, DiagMenu scripting API",
    "keywords": ["ui", "dialog", "tooltip", "widget", "menu", "button", "layout", "configurable", "diag", "debug", "menu", "hud", "screen", "interface", "popup"]
  },
  {
    "path": "Modding_And_Extensions/modding-basics.md",
    "title": "Modding Basics",
    "description": "Mod project setup, data modding (Override/Duplicate/Inherit/Replace), LOD system, game mode setup, 2D map creation, collision layers, prefab system, Entity Catalog",
    "keywords": ["mod", "modding", "project", "setup", "override", "duplicate", "inherit", "replace", "lod", "catalog", "prefab", "layer", "collision", "map", "gproj"]
  },
  {
    "path": "Modding_And_Extensions/prop-creation.md",
    "title": "Prop Creation",
    "description": "FBX prep, collider naming, Layer Preset assignment, Workbench import settings, prefab setup, pitfalls",
    "keywords": ["prop", "static", "object", "fbx", "collider", "import", "prefab", "layer", "preset", "mesh", "model", "create"]
  },
  {
    "path": "Modding_And_Extensions/game-master.md",
    "title": "Game Master",
    "description": "Budget system, waypoint types, composition naming, editable entity generation, context/toolbar actions, entity attributes/properties/tooltips, preview image",
    "keywords": ["game", "master", "gm", "budget", "waypoint", "composition", "editable", "entity", "context", "toolbar", "action", "attribute", "preview", "tooltip"]
  },
  {
    "path": "Modding_And_Extensions/ui-notifications-hints.md",
    "title": "UI Notifications & Hints",
    "description": "UI types, ChimeraMenuPreset enum pattern, MenuManager API, Modular Button, Notification system, Hint system, End Screen, Field Manual, localisation",
    "keywords": ["notification", "hint", "ui", "menu", "manager", "button", "localization", "localisation", "string", "chimera", "field", "manual", "end", "screen", "hud"]
  },
  {
    "path": "Modding_And_Extensions/scripting-misc.md",
    "title": "Scripting Miscellaneous",
    "description": "Generic/template classes, SQF vs EnforceScript differences, Game Identity API, Animation Editor custom properties, Asset Browser, Doxygen, Action Context Setup",
    "keywords": ["generic", "template", "sqf", "identity", "doxygen", "action", "context", "actionsmanager", "browser", "asset", "migration", "diag", "build"]
  },
  {
    "path": "Modding_And_Extensions/faction-creation.md",
    "title": "Faction Creation",
    "description": "Character components, faction config fields, groups, custom EEditableEntityLabel enum pattern, editor registration workflow",
    "keywords": ["faction", "create", "character", "group", "label", "config", "register", "editor", "team", "side", "us", "ussr", "fdf", "custom"]
  },
  {
    "path": "Vehicles_And_Physics/physics-transforms.md",
    "title": "Physics & Transforms",
    "description": "Physics API, transform helpers, parenting, debug shapes",
    "keywords": ["physics", "transform", "position", "rotation", "vector", "matrix", "parent", "attach", "debug", "shape", "rigidbody", "force", "velocity"]
  },
  {
    "path": "Vehicles_And_Physics/damage-vehicles.md",
    "title": "Vehicle Damage",
    "description": "Vehicle damage patterns",
    "keywords": ["vehicle", "damage", "health", "destroy", "hit", "armor", "component", "repair"]
  },
  {
    "path": "Vehicles_And_Physics/vehicle-modding.md",
    "title": "Vehicle Modding",
    "description": "Key vehicle components (damage, fuel, simulation, slots), faction affiliation, component icon types, collision pitfalls",
    "keywords": ["vehicle", "car", "truck", "tank", "fuel", "simulation", "wheeled", "slot", "component", "damage", "faction", "mod", "create", "setup"]
  },
  {
    "path": "AI_And_Behavior/behavior-tree.md",
    "title": "Behavior Tree",
    "description": "BT Editor UI/shortcuts, all node types (Flow/Decorator/Task), debug colors, AI Debug Panel, BaseContainer API",
    "keywords": ["ai", "behavior", "tree", "bt", "node", "flow", "decorator", "task", "selector", "sequence", "condition", "action", "debug", "agent"]
  },
  {
    "path": "AI_And_Behavior/navmesh-terrain.md",
    "title": "Navmesh & Terrain",
    "description": "Navmesh types, world setup, generation workflow, partial regen, override pattern, Terrain entity concepts, new terrain setup workflow, environment prefabs",
    "keywords": ["navmesh", "navigation", "terrain", "world", "generate", "bake", "tile", "area", "environment", "prefab", "setup", "snap", "orient"]
  },
  {
    "path": "Audio_And_Sound/audio-system.md",
    "title": "Audio System",
    "description": "ACP pipeline, all node types, SoundComponent hierarchy, signals, Audio Variables, Directivity, Occlusion, SCR_SoundManagerEntity, Music/Radio/VoN/Door/MPD audio",
    "keywords": ["audio", "sound", "acp", "bank", "signal", "bus", "shader", "amplitude", "frequency", "selector", "component", "music", "radio", "von", "voice", "door", "occlusion", "reverb", "loop", "event"]
  },
  {
    "path": "Terrain_And_Environment/world-environment.md",
    "title": "World Environment",
    "description": "Particle effects, wind API, surface material detection, spatial query, vegetation destruction",
    "keywords": ["world", "environment", "wind", "surface", "material", "particle", "vegetation", "destruction", "spatial", "query", "terrain", "weather"]
  },
  {
    "path": "GameModes_And_Scenarios/scenario-framework.md",
    "title": "Scenario Framework",
    "description": "SF prefab hierarchy (Area/Layer/Slot), activation types, task types, trigger types, logic entities, QRF, game mode setup",
    "keywords": ["scenario", "framework", "sf", "area", "layer", "slot", "task", "trigger", "activation", "qrf", "respawn", "objective", "logic", "mission", "game", "mode"]
  },
  {
    "path": "GameModes_And_Scenarios/capture-and-hold.md",
    "title": "Capture & Hold",
    "description": "C&H setup workflow, required prefabs, mission header creation, score/time settings, Conflict mode overview",
    "keywords": ["capture", "hold", "cah", "conflict", "gamemode", "score", "time", "area", "zone", "spawn", "faction", "mission", "header", "supply", "rank"]
  },
  {
    "path": "Inventory_And_Damage/damage-system.md",
    "title": "Damage System",
    "description": "DamageManager class hierarchy, damage flow, scripting callbacks, SetHealth() pitfall, mod-compatible damage patterns",
    "keywords": ["damage", "health", "hitzone", "damagemanager", "kill", "death", "hit", "resistance", "armor", "callback", "script", "sethealth", "heal"]
  },
  {
    "path": "Character_And_Animation/gadgets-actions.md",
    "title": "Gadgets & Actions",
    "description": "SCR_FlashlightComponent pitfalls, SetEmissiveMultiplier, ScriptedUserAction pattern",
    "keywords": ["gadget", "flashlight", "action", "user", "scripted", "emissive", "item", "use", "interact", "equip"]
  },
  {
    "path": "Character_And_Animation/character-gear-and-anim-data.md",
    "title": "Character Gear & Animation Data",
    "description": "Animation workspace structure, all graph node types, State Machine, Pose 2D, export profiles, human variables, CMD_Weapon_Reload commands, animation instances, SoundInfo signals, gear creation",
    "keywords": ["animation", "character", "gear", "state", "machine", "pose", "blend", "ik", "workspace", "template", "instance", "animset", "export", "profile", "variable", "reload", "weapon", "sound", "signal", "pap", "siga"]
  }
]
```

**Step 2: Verify the JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('data/kb/index.json','utf-8')); console.log('valid')"
```

Expected: `valid`

**Step 3: Commit**

```bash
git add data/kb/index.json
git commit -m "feat: add KB routing index (data/kb/index.json)"
```

---

### Task 3: Create `src/tools/kb-loader.ts`

**Files:**
- Create: `src/tools/kb-loader.ts`

This module loads `index.json`, scores queries against it, and reads matched markdown files from disk.

**Step 1: Create the file**

```typescript
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../utils/logger.js";

export interface KbEntry {
  path: string;
  title: string;
  description: string;
  keywords: string[];
}

function loadIndex(kbDir: string): KbEntry[] {
  const indexPath = resolve(kbDir, "index.json");
  if (!existsSync(indexPath)) {
    logger.warn(`KB index not found: ${indexPath}`);
    return [];
  }
  try {
    const raw = readFileSync(indexPath, "utf-8");
    return JSON.parse(raw) as KbEntry[];
  } catch (e) {
    logger.error(`Failed to load KB index: ${e}`);
    return [];
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s\-_/.,;:!?()[\]{}]+/).filter(Boolean);
}

function scoreEntry(entry: KbEntry, tokens: string[]): number {
  let score = 0;
  const titleTokens = tokenize(entry.title);
  const descTokens = tokenize(entry.description);
  for (const token of tokens) {
    if (entry.keywords.includes(token)) score += 2;
    if (titleTokens.includes(token)) score += 1;
    if (descTokens.includes(token)) score += 1;
  }
  return score;
}

export function searchKb(
  kbDir: string,
  query: string,
  maxFiles: number
): { files: Array<{ title: string; content: string }>; usedIndex: boolean } {
  const index = loadIndex(kbDir);

  // Empty query or "index"/"list" → return index summary
  const q = query.trim().toLowerCase();
  if (!q || q === "index" || q === "list") {
    return { files: [], usedIndex: true };
  }

  const tokens = tokenize(query);
  const scored = index
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  if (scored.length === 0) {
    return { files: [], usedIndex: true };
  }

  const patternsDir = resolve(kbDir, "patterns");
  const files: Array<{ title: string; content: string }> = [];
  for (const { entry } of scored) {
    const filePath = resolve(patternsDir, entry.path);
    if (!existsSync(filePath)) {
      logger.warn(`KB file not found: ${filePath}`);
      continue;
    }
    try {
      const content = readFileSync(filePath, "utf-8");
      files.push({ title: entry.title, content });
    } catch (e) {
      logger.warn(`Failed to read KB file ${filePath}: ${e}`);
    }
  }

  return { files, usedIndex: false };
}

export function getIndexSummary(kbDir: string): string {
  const index = loadIndex(kbDir);
  if (index.length === 0) return "No KB entries found.";
  const lines = index.map((e) => `- **${e.title}**: ${e.description}`);
  return `# Arma Reforger KB — Available Topics\n\n${lines.join("\n")}`;
}
```

**Step 2: No test needed** (file I/O is trivial; tested via the full tool in Task 5). Move on.

**Step 3: Commit**

```bash
git add src/tools/kb-loader.ts
git commit -m "feat: add KB loader (tokenized query scoring over index.json)"
```

---

### Task 4: Create `src/tools/wb-knowledge.ts`

**Files:**
- Create: `src/tools/wb-knowledge.ts`

**Step 1: Create the file**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { searchKb, getIndexSummary } from "./kb-loader.js";

const KB_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "kb"
);

export function registerWbKnowledge(server: McpServer): void {
  server.registerTool(
    "wb_knowledge",
    {
      description:
        "Search the Arma Reforger modding knowledge base — distilled pattern files covering scripting, " +
        "audio, weapons, vehicles, AI, UI, game modes, animation, and all other modding domains. " +
        "Use this before writing EnforceScript code or setting up any Enfusion modding system. " +
        "Call with query='index' to see all available topics.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Topic to look up (e.g. 'replication', 'weapon suppressor', 'scenario framework', 'audio signals'). Use 'index' to list all topics."
          ),
        max_files: z
          .number()
          .min(1)
          .max(4)
          .default(2)
          .describe("Maximum number of pattern files to return (default 2)"),
      },
    },
    async ({ query, max_files }) => {
      const result = searchKb(KB_DIR, query, max_files);

      if (result.usedIndex || result.files.length === 0) {
        const summary = getIndexSummary(KB_DIR);
        const prefix =
          result.files.length === 0 && !result.usedIndex
            ? `No KB entries matched "${query}". Showing all available topics:\n\n`
            : "";
        return {
          content: [{ type: "text", text: prefix + summary }],
        };
      }

      const parts = result.files.map(
        (f) => `## ${f.title}\n\n${f.content}`
      );

      return {
        content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
      };
    }
  );
}
```

**Step 2: Commit**

```bash
git add src/tools/wb-knowledge.ts
git commit -m "feat: add wb_knowledge MCP tool"
```

---

### Task 5: Register the tool in `src/server.ts`

**Files:**
- Modify: `src/server.ts`

**Step 1: Add the import** (after the last import line, before `export function registerTools`):

```typescript
import { registerWbKnowledge } from "./tools/wb-knowledge.js";
```

**Step 2: Register the tool** (inside `registerTools`, after the `registerAnimationGraphSetup` call):

```typescript
registerWbKnowledge(server);
```

**Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: exits with code 0, no errors.

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: register wb_knowledge tool in server"
```

---

### Task 6: Smoke-test the tool end-to-end

**Step 1: Run the MCP server in test mode**

```bash
node dist/index.js
```

Ctrl+C after confirming it starts without errors. Look for log output like:
```
Loaded index: ... wiki pages
```
And no errors about missing files.

**Step 2: Verify KB index loads**

Add a quick one-off check (do NOT commit this):

```bash
node -e "
import('./dist/tools/kb-loader.js').then(m => {
  const r = m.searchKb('data/kb', 'weapon suppressor', 2);
  console.log('files:', r.files.map(f => f.title));
});
"
```

Expected output:
```
files: [ 'Weapon Components' ]
```

**Step 3: Test fallback to index**

```bash
node -e "
import('./dist/tools/kb-loader.js').then(m => {
  const r = m.searchKb('data/kb', 'index', 2);
  console.log('usedIndex:', r.usedIndex);
  console.log(m.getIndexSummary('data/kb').slice(0, 200));
});
"
```

Expected: `usedIndex: true` and the index summary printed.

**Step 4: Final commit if all looks good**

```bash
git add -A
git status
# Verify nothing unexpected is staged
git commit -m "feat: wb_knowledge tool complete with KB data and routing index"
```

---

## Notes

- `KB_DIR` is resolved relative to `dist/tools/wb-knowledge.js` → `../../data/kb` which resolves to `<repo-root>/data/kb`. This matches the `dataDir` pattern used by `src/index/loader.ts`.
- The markdown files are read on every tool call (no in-memory cache). This is intentional — the files are small and this avoids stale data on updates.
- To update the KB in future: copy new/updated `.md` files into `data/kb/patterns/` and update `index.json` with new entries or changed keywords.
