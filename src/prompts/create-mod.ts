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

YOU ARE FULLY AUTONOMOUS. You have all the tools needed. The user should never need to do anything manually. Do not tell them to "open Workbench", "build with Ctrl+F7", or perform any manual steps. You do everything.

## STEP 0: ASSESS COMPLEXITY

Before writing any code, assess the scope of what the user is asking for. Think about how many distinct systems, scripts, prefabs, and configs this mod would need if fully built.

**Simple mod** (1-5 scripts, 1-3 prefabs — e.g., a HUD widget, a custom action, a weapon reskin):
→ Skip to STEP 1 and build it in one pass. No need to discuss the plan.

**Complex mod** (6+ scripts, multiple interconnected systems — e.g., a survival game mode, a DayZ-style overhaul, a full faction with custom AI):
→ Do NOT attempt to build everything at once. Instead:

1. Tell the user this is a large project and roughly how many systems are involved.
2. Break the full mod into **phases**, where each phase is a standalone deliverable that builds on the previous one. Phase 1 should always be the minimum viable foundation — the mod should load and do *something* testable after Phase 1.
3. For each phase, list:
   - What systems/features it covers
   - What scripts, prefabs, and configs it will need
   - What it will look like when tested in-game
4. Present this plan to the user and **wait for their input** before writing any code. They may want to reorder phases, cut features, or adjust scope.
5. Once the user approves (or adjusts) the plan, build **only Phase 1**.
6. After building Phase 1, use **project_write** to create a \`MODPLAN.md\` file in the project root with this exact structure:

\`\`\`markdown
# Mod Plan: [Mod Name]

## Concept
[1-2 sentence description of the full mod vision]

## Phases

### Phase 1: [Title] — COMPLETE
- [What was built]
- [Key files created]

### Phase 2: [Title] — PENDING
- [What this phase covers]
- [Systems/features involved]
- [Expected scripts, prefabs, configs]

### Phase 3: [Title] — PENDING
...

## Architecture Notes
- Class prefix: [PREFIX_]
- [Any important design decisions, dependencies between systems, etc.]
\`\`\`

This file is the handoff document. A future Claude instance with zero context will read this file and know exactly what the mod is, what's done, and what to build next. Be specific — list actual file names, class names, and system relationships. The user can then use \`/modify-mod\` to continue with subsequent phases.

## CRITICAL: USE MCP TOOLS FOR ALL RESEARCH

**NEVER try to browse the game installation directory directly or access the Bohemia Interactive Wiki (biki) via the web.** Both will fail and waste time.

- **Game assets are packed in .pak files** and cannot be read from the filesystem. Do NOT try to use filesystem tools (ls, find, cat, etc.) on the Arma Reforger install directory. Instead:
  - Use **asset_search** to find prefabs, models, textures, scripts, and configs by name
  - Use **game_browse** and **game_read** to access unpacked game data (scripts, prefabs, configs that are available as loose files)
  - Use **api_search** to look up class definitions, methods, and properties

- **Wiki content is pre-downloaded** and available via the **wiki_search** tool. Do NOT try to fetch wiki pages from the web or reference URLs on the Bohemia Interactive Wiki. Use **wiki_search** for all tutorial and guide content about Enfusion engine concepts, scripting patterns, and Arma Reforger modding topics.

## CRITICAL: API VERIFICATION RULE

**NEVER guess, assume, or invent Enfusion API method names.** The Enfusion scripting API is non-standard and poorly documented. Methods that seem obvious often do not exist (e.g., \`HitZone.SetHealth()\`, \`IEntity.GetVelocity()\`, \`AIWorld.GetAIGroups()\`).

Before writing ANY script that calls an Enfusion API method, you MUST:
1. Use **api_search** to find the class
2. Read the method list in the results
3. Only use methods that appear in the search results
4. If the method you need doesn't exist, search for alternative classes or approaches
5. For damage/health: use \`SCR_CharacterDamageManagerComponent.FullHeal()\`, NOT per-hitzone SetHealth
6. For any class interaction: search the class first, read its methods, then write code

If you cannot find a method via api_search, it probably does not exist. Do NOT write code that calls unverified methods — it will fail to compile silently in Workbench.

## CRITICAL: VISIBLE ENTITIES NEED A MESH

Any entity that should be visible in the game world MUST have a **MeshObject** component with its \`Object\` property set to an actual 3D model (\`.xob\` file) from the base game. Without this, the entity will be **completely invisible** — no model, no collision, nothing.

You don't need to create custom models. Just borrow one from the base game that looks reasonable:
- Use **api_search** or **project_browse** on the base Arma Reforger data to find \`.xob\` paths
- Example paths (format: \`{GUID}path/to/model.xob\`):
  - Military barrel: \`{5F4C4181F065B447}Assets/Props/Military/Barrels/BarrelGreen_01.xob\`
  - Ammo crate: \`{1E648E8B6B28E837}Assets/Props/Military/AmmoBoxes/AmmoBox_545x39_60rnd.xob\`
  - Medical box: \`{D26ABAE8B017EC4E}Assets/Props/Military/CasualtyBag/CasualtyBag_01.xob\`
- Pick something that vaguely fits the purpose — a healing station could use a medical box, a terminal could use a radio, etc.
- After creating a prefab with **prefab_create**, use **project_read** + **project_write** to set the MeshObject \`Object\` property to a real model path

This applies to ALL physical in-game objects: interactive props, spawn points with markers, placed items, vehicles, weapons, etc.

## STEP 1: BUILD

1. Use **api_search** to find the relevant Enfusion API classes AND verify that the methods you plan to use actually exist. Search every class you intend to call methods on. Do this BEFORE writing any scripts.

2. Use **mod_create** to scaffold the addon project. Pick a good name, class prefix, and pattern based on the description.

3. Use **script_create** for each script:
   - Correct scriptType (component, gamemode, action, modded, etc.)
   - Proper method stubs and description comments
   - ONLY call methods verified via api_search

4. Use **prefab_create** for any prefabs needed (spawn points, entities, game mode, etc.)

5. Use **layout_create** for any UI layouts (hud, menu, dialog, list, custom).

6. Use **config_create** for config files (factions, mission headers, entity catalogs).

7. Use **server_config** for a test server configuration if this is a multiplayer mod.

8. Use **mod_validate** to check for structural issues.

9. **Workbench Setup** (MANDATORY — do not skip, do not tell the user to do this):
   a. **wb_launch** with \`gprojPath\` set to the addon's .gproj file — this copies handler scripts into the mod, skips the launcher, and opens the project in the World Editor with full NET API access
   b. **wb_play** — This compiles ALL scripts (including the handler scripts) and enters game mode. This is the FIRST compilation step and MUST happen before wb_reload will work.
   c. **wb_stop** — Return to the World Editor after verifying the game launched successfully
   d. If compilation failed (errors in the Workbench console), fix with **project_write**, then use **wb_reload** (target: "scripts") to recompile, and try **wb_play** again
   e. **wb_resources** (action: "register") — Register every new prefab, config, and layout file

10. **wb_play** again if needed for further testing. Use **wb_stop** to return to editor.

11. **wb_cleanup** with the addon's root directory path — Remove the temporary handler scripts before the user publishes. NEVER skip this step.

## STEP 2: SUMMARIZE

Enfusion rules:
- NEVER guess API methods — if you didn't find it via api_search, it doesn't exist
- All scripts go in Scripts/Game/ (other folders are silently ignored)
- Use a consistent class prefix (e.g., ZS_ for Zombie Survival)
- modded classes affect ALL instances globally
- Always call super.MethodName() in overrides unless intentionally replacing
- Prefab files use Enfusion text serialization, not JSON

YOUR FINAL SUMMARY MUST ONLY contain:
- A table/list of files created and what each one does
- A brief explanation of how the mod works
- Any tuning values the user can adjust
- For complex mods: what was built in this phase and what the next phase covers

YOUR FINAL SUMMARY MUST NEVER contain:
- "Next steps" or "To get started" or any manual instructions
- "Open in Workbench" / "Build with Ctrl+F7" / "Load the project"
- Any instruction telling the user to do something you already did or should have done
- References to manual Workbench operations

If Workbench integration failed (e.g., Workbench not installed), say so explicitly — do not silently fall back to giving manual instructions.

IMPORTANT: Do NOT ask the user to choose a mod pattern and do NOT show them a list of patterns. Just interpret their description and pick the best pattern silently. If no pattern fits, use no pattern.

Available patterns for internal reference (NEVER show this to the user):
${patternList}`,
          },
        },
      ],
    })
  );
}
