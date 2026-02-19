# enfusion-mcp

MCP server for Arma Reforger / Enfusion engine modding. Create working mods from natural language — no modding experience required.

## What It Does

Connect this server to any MCP-compatible client and describe what you want:

- *"Create a zombie survival game mode with waves of AI enemies"*
- *"Add a custom faction with unique loadouts"*
- *"Make a spawn system with weighted random positions"*

12 MCP tools search 8,693 API classes, scaffold the addon, generate scripts/prefabs/configs, validate everything, and build it — all through conversation.

## Installation

### npx (no install)

```bash
npx -y enfusion-mcp
```

### Global install

```bash
npm install -g enfusion-mcp
```

### From source

```bash
git clone https://github.com/Articulated7/enfusion-mcp.git
cd enfusion-mcp
npm install
npm run scrape        # Build the API index from local Workbench docs
npm run build
```

## Setup

### MCP Client Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "enfusion-mcp": {
      "command": "npx",
      "args": ["-y", "enfusion-mcp"],
      "env": {
        "ENFUSION_PROJECT_PATH": "C:\\path\\to\\your\\mod"
      }
    }
  }
}
```

### Local Build

If running from source, point your client at the compiled entry point:

```json
{
  "mcpServers": {
    "enfusion-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\enfusion-mcp\\dist\\index.js"],
      "env": {
        "ENFUSION_PROJECT_PATH": "C:\\path\\to\\your\\mod"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `api_search` | Search Enfusion/Arma Reforger script API (8,693 classes, methods, inheritance) |
| `wiki_search` | Search tutorial and guide content |
| `project_browse` | List files in a Workbench project directory |
| `project_read` | Read files from the project |
| `project_write` | Write/update files with path traversal protection |
| `mod_create` | Scaffold a complete addon (directories, .gproj, pattern templates) |
| `script_create` | Generate Enforce Script (.c) files (7 script types) |
| `prefab_create` | Generate Entity Template (.et) prefabs (7 prefab types) |
| `config_create` | Generate config (.conf) files (factions, missions, catalogs) |
| `server_config` | Generate dedicated server config for local testing |
| `mod_validate` | Static validation (7 checks) without Workbench |
| `mod_build` | Build addon via Workbench CLI |

Additionally exposes 3 prompts (`create-mod`, `add-script`, `add-prefab`) and 3 resources (`enfusion://class/{name}`, `enfusion://pattern/{name}`, `enfusion://group/{name}`).

## Mod Patterns

10 built-in templates for common mod types:

| Pattern | Description |
|---------|-------------|
| `game-mode` | Custom game mode with scoring and win conditions |
| `custom-faction` | New faction with characters and loadouts |
| `custom-action` | Interactive objects with UserAction |
| `spawn-system` | Custom spawn manager with spawn points |
| `custom-component` | Reusable ScriptComponent |
| `modded-behavior` | Override existing class behavior |
| `admin-tool` | Keybind-triggered admin commands |
| `custom-vehicle` | New vehicle variant |
| `weapon-reskin` | Modded weapon properties |
| `hud-widget` | Custom HUD element |

Example usage with `mod_create`:

```
Create a mod called "ZombieDefense" using the game-mode pattern
```

## API Index

Pre-built index of the Enfusion/Arma Reforger script API, scraped from Doxygen documentation:

- **8,693 classes** — 812 Enfusion engine + 7,881 Arma Reforger
- **157 API groups** — Entities, Components, Replication, etc.
- **7 tutorial pages**
- Full method signatures, parameters, descriptions, and inheritance trees

To rebuild from your local Arma Reforger Tools installation:

```bash
npm run scrape          # Auto-detect source
npm run scrape:local    # Force local zip files
```

## Configuration

Settings are loaded in order (later sources override earlier):

1. **Built-in defaults**
2. **Local config file** — `enfusion-mcp.config.json` next to the package
3. **User config** — `~/.enfusion-mcp/config.json`
4. **Environment variables**

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENFUSION_PROJECT_PATH` | Default mod project directory | *(none)* |
| `ENFUSION_WORKBENCH_PATH` | Path to Arma Reforger Tools | `C:\Program Files (x86)\Steam\steamapps\common\Arma Reforger Tools` |
| `ENFUSION_MCP_DATA_DIR` | Path to scraped API data | `./data` |

### Config File

```json
{
  "workbenchPath": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Arma Reforger Tools",
  "projectPath": "C:\\Users\\you\\Documents\\My Games\\ArmaReforger\\addons\\MyMod",
  "dataDir": "./data",
  "patternsDir": "./data/patterns"
}
```

## Development

```bash
npm run build          # Compile TypeScript
npm test               # Run tests
npm run test:watch     # Watch mode
npm run dev            # Run from source with tsx
```

### Project Structure

```
enfusion-mcp/
  src/
    index.ts              # Entry point (stdio MCP server)
    server.ts             # Tool/prompt/resource registration
    config.ts             # Multi-layer config loading
    formats/              # Enfusion text serialization parser
    templates/            # Code generators (script, prefab, config, etc.)
    tools/                # MCP tool implementations
    prompts/              # MCP prompt definitions
    resources/            # MCP resource templates
    index/                # Search engine + type definitions
    patterns/             # Pattern library loader
    scraper/              # Doxygen HTML scraper
    utils/                # Logger, path validation
  data/
    api/                  # Scraped class data (~44 MB JSON)
    wiki/                 # Tutorial pages
    patterns/             # 10 mod pattern definitions
  tests/                  # Vitest test suite
  scripts/                # CLI scripts (scraper)
```

## Requirements

- **Node.js 20+**
- **Arma Reforger Tools** (Steam) — required for `mod_build` and `scrape:local`. All other tools work without it.

## License

MIT
