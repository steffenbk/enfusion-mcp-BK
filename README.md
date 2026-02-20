# enfusion-mcp

MCP server for Arma Reforger modding. Describe what you want to build, and Claude handles everything — API research, code generation, project scaffolding, Workbench control, and in-editor testing. Zero modding experience required.

## Install

### Claude Code (Windows)

```bash
claude mcp add --scope user enfusion-mcp -- cmd /c npx -y enfusion-mcp
```

### Claude Code (macOS / Linux)

```bash
claude mcp add --scope user enfusion-mcp -- npx -y enfusion-mcp
```

Restart Claude Code. Verify with `/mcp`.

### Claude Desktop

Add to your `claude_desktop_config.json`:

**Windows:**

```json
{
  "mcpServers": {
    "enfusion-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "enfusion-mcp"]
    }
  }
}
```

**macOS / Linux:**

```json
{
  "mcpServers": {
    "enfusion-mcp": {
      "command": "npx",
      "args": ["-y", "enfusion-mcp"]
    }
  }
}
```

### Workbench Plugin

The live Workbench tools (`wb_*`) require handler scripts running inside Workbench. These ship with the package in `mod/Scripts/WorkbenchGame/EnfusionMCP/` and are installed automatically when Claude launches Workbench via `wb_launch`.

## Usage

Just ask Claude to make a mod:

- *"Create a HUD widget that shows player health and stamina"*
- *"Make a zombie survival game mode with wave spawning"*
- *"Create a custom faction called CSAT with desert camo soldiers"*
- *"Add an interactive object that heals the player when used"*
- *"Override the damage system to add armor mechanics"*

Or use the guided prompts for structured workflows:

| Prompt | Description |
|--------|-------------|
| `/create-mod` | Full guided mod creation — from idea to built addon |
| `/modify-mod` | Modify or extend an existing mod project |

Claude will:

1. **Research** the Enfusion API (8,693 indexed classes) to find the right parent classes and methods
2. **Scaffold** the full addon — `.gproj`, scripts, prefabs, configs, UI layouts
3. **Launch Workbench** if it's not already running
4. **Load the project**, reload scripts, register resources
5. **Validate and build** the addon
6. **Enter play mode** so you can test in-game

## Tools

### Offline Tools

Work without Workbench running — API search, mod scaffolding, code generation, validation, and building.

| Tool | What it does |
|------|-------------|
| `api_search` | Search 8,693 Enfusion/Arma Reforger API classes and methods |
| `wiki_search` | Search tutorial and guide content about Enfusion concepts |
| `project_browse` | List files in a mod project directory |
| `project_read` | Read any project file |
| `project_write` | Write or update project files |
| `mod_create` | Scaffold a complete addon with directory structure and `.gproj` |
| `script_create` | Generate Enforce Script (`.c`) files — 7 types: component, gamemode, action, entity, manager, modded, basic |
| `prefab_create` | Generate Entity Template (`.et`) prefabs — 7 types: character, vehicle, weapon, spawnpoint, gamemode, interactive, generic |
| `layout_create` | Generate UI layout (`.layout`) files — 5 types: hud, menu, dialog, list, custom |
| `config_create` | Generate config files — factions, missions, entity catalogs, editor placeables |
| `server_config` | Generate dedicated server config for local testing |
| `mod_validate` | Validate project structure, scripts, prefabs, configs, and naming |
| `mod_build` | Build the addon using the Workbench CLI |

### Live Workbench Tools

Control a running Workbench instance over TCP. Requires the handler scripts installed (see setup above).

| Tool | What it does |
|------|-------------|
| `wb_launch` | Start Workbench if not running, wait for NET API |
| `wb_connect` | Test connection to Workbench |
| `wb_state` | Full state snapshot — mode, world, entity count, selection |
| `wb_play` | Switch to game mode (Play in Editor) |
| `wb_stop` | Return to edit mode |
| `wb_save` | Save the current world |
| `wb_undo_redo` | Undo or redo the last action |
| `wb_open_resource` | Open a resource in its editor |
| `wb_reload` | Reload scripts or plugins without restarting |
| `wb_execute_action` | Run any Workbench menu action by path |
| `wb_entity_create` | Create entity from prefab at a position |
| `wb_entity_delete` | Delete entity by name |
| `wb_entity_list` | List and search entities in the world |
| `wb_entity_inspect` | Get entity details — properties, components, children |
| `wb_entity_modify` | Move, rotate, rename, reparent, set properties |
| `wb_entity_select` | Select, deselect, clear, get current selection |
| `wb_component` | Add, remove, list entity components |
| `wb_terrain` | Query terrain height and world bounds |
| `wb_layers` | Create, delete, rename layers, set visibility/active |
| `wb_resources` | Register resources, rebuild database |
| `wb_prefabs` | Create templates, save, GUID lookup |
| `wb_clipboard` | Copy, cut, paste, duplicate entities |
| `wb_script_editor` | Read/write lines in the open script file |
| `wb_localization` | String table CRUD for localization |
| `wb_projects` | List loaded projects, open `.gproj` files |
| `wb_validate` | Material and texture validation |

### Mod Patterns

10 built-in templates for `mod_create`:

`game-mode` `custom-faction` `custom-action` `spawn-system` `custom-component` `modded-behavior` `admin-tool` `custom-vehicle` `weapon-reskin` `hud-widget`

### MCP Resources

| URI | Description |
|-----|-------------|
| `enfusion://class/{className}` | Full class docs with inheritance, methods, ancestors/descendants |
| `enfusion://pattern/{patternName}` | Mod pattern definition with all templates |
| `enfusion://group/{groupName}` | API group with class list |

## Configuration

All optional. Sensible defaults are used when nothing is set.

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `ENFUSION_PROJECT_PATH` | Default mod output directory | `~/Documents/My Games/ArmaReforgerWorkbench/addons` |
| `ENFUSION_WORKBENCH_PATH` | Path to Arma Reforger Tools | `C:\Program Files (x86)\Steam\steamapps\common\Arma Reforger Tools` |
| `ENFUSION_WORKBENCH_HOST` | NET API host | `127.0.0.1` |
| `ENFUSION_WORKBENCH_PORT` | NET API port | `5775` |

Config can also be loaded from `~/.enfusion-mcp/config.json`. Environment variables take priority.

## Requirements

- **Node.js 20+**
- **Arma Reforger Tools** (Steam) — needed for `mod_build` and all `wb_*` tools

## Development

```bash
git clone https://github.com/Articulated7/enfusion-mcp.git
cd enfusion-mcp
npm install
npm run scrape   # Build API index from Workbench docs
npm run build
npm test         # 163 tests
```

## License

MIT
