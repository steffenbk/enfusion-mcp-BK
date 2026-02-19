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

Please help me create this mod step by step:

1. First, use **api_search** to find the relevant Enfusion API classes I'll need (game modes, components, entities, etc.)

2. Choose the best mod pattern from the available patterns:
${patternList}

3. Use **mod_create** to scaffold the addon project. Pick a good name and class prefix.

4. Use **script_create** to generate each script file the mod needs. Make sure to:
   - Use the correct scriptType (component, gamemode, action, modded, etc.)
   - Include the right method stubs
   - Add helpful description comments

5. Use **prefab_create** for any prefabs the mod needs (spawn points, entities, game mode, etc.)

6. Use **config_create** to generate any needed config files:
   - Faction configs for custom factions
   - Mission headers for scenarios
   - Entity catalogs for categorized content

7. Use **server_config** to generate a test server configuration if this is a multiplayer mod.

8. Summarize everything that was created and explain what each file does.

9. List the next steps to get the mod running in Workbench.

Important Enfusion rules:
- All scripts go in Scripts/Game/ (other folders are silently ignored)
- Use a consistent class prefix (e.g., ZS_ for Zombie Survival)
- modded classes affect ALL instances globally
- Always call super.MethodName() in overrides unless intentionally replacing
- Prefab files use Enfusion text serialization, not JSON`,
          },
        },
      ],
    })
  );
}
