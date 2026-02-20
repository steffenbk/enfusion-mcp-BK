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

## STEP 1: BUILD

1. Use **api_search** to find the relevant Enfusion API classes needed.

2. Use **mod_create** to scaffold the addon project. Pick a good name, class prefix, and pattern based on the description.

3. Use **script_create** for each script:
   - Correct scriptType (component, gamemode, action, modded, etc.)
   - Proper method stubs and description comments

4. Use **prefab_create** for any prefabs needed (spawn points, entities, game mode, etc.)

5. Use **layout_create** for any UI layouts (hud, menu, dialog, list, custom).

6. Use **config_create** for config files (factions, mission headers, entity catalogs).

7. Use **server_config** for a test server configuration if this is a multiplayer mod.

8. Use **mod_validate** to check for structural issues.

9. **Workbench Setup** (MANDATORY — do not skip, do not tell the user to do this):
   a. **wb_launch** with \`gprojPath\` set to the addon's .gproj file — this automatically injects the EnfusionMCP handler addon as a temporary dependency, skips the launcher, and opens the project in the World Editor with full NET API access
   b. **wb_reload** (target: "scripts") — Compile all scripts
   c. **wb_resources** (action: "register") — Register every new prefab, config, and layout file
   d. If compilation fails, fix with **project_write** and reload again

10. **wb_play** — Launch the mod in-game to test. Use **wb_stop** to return to editor.

11. **wb_cleanup** with the addon's .gproj path — Remove the temporary EnfusionMCP dependency before the user publishes. NEVER skip this step.

## STEP 2: SUMMARIZE

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
