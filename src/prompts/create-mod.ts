import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PatternLibrary } from "../patterns/loader.js";

export function registerCreateModPrompt(server: McpServer, patterns: PatternLibrary): void {
  const patternList = patterns.getSummary();

  server.registerPrompt(
    "create-mod",
    {
      title: "Create a new Arma Reforger mod",
      description:
        "Guided workflow to scaffold a complete mod from a description. Creates the addon structure, scripts, and prefabs.",
      argsSchema: {
        description: z
          .string()
          .describe("Describe what the mod should do (e.g., 'A zombie survival game mode with waves of AI enemies')"),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to create an Arma Reforger mod: ${description}

YOU ARE FULLY AUTONOMOUS. You have all the tools to create the mod AND set it up in Workbench. The user should not need to do anything manually. Do not tell them to "open Workbench", "build with Ctrl+F7", or list any "next steps". You do everything.

Follow this workflow — every step is mandatory:

1. Use **api_search** to find the relevant Enfusion API classes needed.

2. Choose the best mod pattern from:
${patternList}

3. Use **mod_create** to scaffold the addon project. Pick a good name and class prefix.

4. Use **script_create** to generate each script the mod needs:
   - Correct scriptType (component, gamemode, action, modded, etc.)
   - Right method stubs and helpful description comments

5. Use **prefab_create** for any prefabs needed (spawn points, entities, game mode, etc.)

6. Use **layout_create** for any UI layouts needed:
   - hud, menu, dialog, list, or custom

7. Use **config_create** for config files (factions, mission headers, entity catalogs).

8. Use **server_config** for a test server configuration if this is a multiplayer mod.

9. Use **mod_validate** to check for structural issues.

10. **Workbench Setup** (MANDATORY — do not skip, do not tell the user to do this):
    a. **wb_launch** — Start Workbench (auto-detects if already running)
    b. **wb_projects** (action: "open") — Load the .gproj
    c. **wb_resources** (action: "register") — Register every new prefab, config, and layout file
    d. **wb_reload** (target: "scripts") — Compile all scripts
    e. If compilation fails, fix with **project_write** and reload again

11. **wb_play** — Launch the mod in-game to test. Use **wb_stop** to return to editor.

12. Summarize what was created and what each file does.

Enfusion rules:
- All scripts go in Scripts/Game/ (other folders are silently ignored)
- Use a consistent class prefix (e.g., ZS_ for Zombie Survival)
- modded classes affect ALL instances globally
- Always call super.MethodName() in overrides unless intentionally replacing
- Prefab files use Enfusion text serialization, not JSON

YOUR FINAL SUMMARY MUST ONLY contain:
- A table/list of files created and what each one does
- A brief explanation of how the mod works
- Any tuning values the user can adjust

YOUR FINAL SUMMARY MUST NEVER contain:
- "Next steps" or "To get started" or any manual instructions
- "Open in Workbench" / "Build with Ctrl+F7" / "Load the project"
- Any instruction telling the user to do something you already did or should have done
- References to manual Workbench operations

If Workbench integration failed (e.g., Workbench not installed), say so explicitly — do not silently fall back to giving manual instructions.`,
          },
        },
      ],
    })
  );
}
