import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerModifyModPrompt(server: McpServer): void {
  server.registerPrompt(
    "modify-mod",
    {
      title: "Work on an existing Arma Reforger mod",
      description:
        "Guided workflow to modify, extend, or fix an existing mod. Reads the project, understands it, then makes changes.",
      argsSchema: {
        projectPath: z
          .string()
          .describe("Path to the addon root directory (the folder containing the .gproj file)"),
        task: z
          .string()
          .describe("Describe what you want to change (e.g., 'Add a stamina system', 'Fix the damage calculation', 'Add a new vehicle prefab')"),
      },
    },
    ({ projectPath, task }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I have an existing Arma Reforger mod at: ${projectPath}

I want to: ${task}

YOU ARE FULLY AUTONOMOUS. You have all the tools to modify the mod AND set it up in Workbench. The user should not need to do anything manually. Do not tell them to "open Workbench", "build with Ctrl+F7", or list any "next steps". You do everything.

Follow this workflow — every step is mandatory:

1. **Read the plan** — Use **project_read** to check for a \`MODPLAN.md\` file in the project root.
   - If it exists: this is a phased project. Read the plan carefully. It contains the full mod vision, what's been completed, what's pending, architecture notes, class prefixes, and file names. Use this as your primary context. If the user's task matches the next pending phase, execute that phase. If it's a different task, still respect the existing architecture.
   - If it doesn't exist: this is either a simple mod or one created before planning was added. Proceed normally.

2. **Understand the project** — Use **project_browse** and **project_read** to explore:
   - Read the .gproj for addon name and dependencies
   - Read existing scripts, prefabs, configs, and layouts
   - Identify the class prefix convention in use

3. **Research the API** — Use **api_search** to find relevant classes and methods.

4. **Plan the changes** — Determine what to modify, create, or remove. For phased projects, verify your plan aligns with the MODPLAN.

5. **Implement** — Make all modifications:
   - Existing files: **project_read** then **project_write**
   - New scripts: **script_create** (match existing prefix)
   - New prefabs: **prefab_create**
   - New configs: **config_create**
   - New layouts: **layout_create**

6. **Validate** — Use **mod_validate** to check for issues.

7. **Workbench Setup** (MANDATORY — do not skip, do not tell the user to do this):
   a. **wb_launch** — Start Workbench (auto-detects if already running)
   b. **wb_projects** (action: "open") — Load the .gproj if not already loaded
   c. **wb_resources** (action: "register") — Register any new prefabs, configs, or layouts
   d. **wb_reload** (target: "scripts") — Compile all scripts
   e. If compilation fails, fix and reload again

8. **wb_play** — Test the changes in-game. Use **wb_stop** to return to editor.

9. **Update the plan** — If a \`MODPLAN.md\` exists, use **project_read** then **project_write** to update it:
   - Mark completed phases as \`COMPLETE\` with a list of files created/modified
   - Keep pending phases unchanged (unless the user asked to adjust them)
   - Add any new architecture notes or design decisions made during this session
   - If the task was unplanned (not part of any phase), add it to a "Changes Outside Plan" section

10. Summarize what changed and how the mod works now.

Enfusion rules:
- Read existing code BEFORE modifying it. Understand what's there first.
- Match existing code style, class prefix, and naming conventions.
- All scripts go in Scripts/Game/ (other folders are silently ignored)
- modded classes affect ALL instances globally
- Always call super.MethodName() in overrides unless intentionally replacing

YOUR FINAL SUMMARY MUST ONLY contain:
- What files were changed/added and what each change does
- How the mod works now
- Any tuning values the user can adjust
- For phased projects: what phase was completed and what the next phase covers

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
