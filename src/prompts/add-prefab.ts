import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerAddPrefabPrompt(server: McpServer): void {
  server.registerPrompt(
    "add-prefab",
    {
      title: "Add a prefab to a mod",
      description:
        "Guided workflow to create a new Entity Template (.et) prefab with the right components.",
      argsSchema: {
        description: z
          .string()
          .describe("Describe what the prefab should be (e.g., 'A supply crate that players can interact with')"),
        projectPath: z
          .string()
          .optional()
          .describe("Path to the addon root directory"),
      },
    },
    ({ description, projectPath }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I need a new prefab for my Arma Reforger mod: ${description}
${projectPath ? `\nProject path: ${projectPath}` : ""}

Please help me create this prefab:

1. Use **api_search** to find relevant component classes I should attach to this entity.

2. Determine the correct prefabType:
   - **character**: For a character/soldier (SCR_ChimeraCharacter)
   - **vehicle**: For a vehicle (Vehicle)
   - **weapon**: For a weapon (Weapon_Base)
   - **spawnpoint**: For a player spawn point
   - **gamemode**: For a game mode entity
   - **interactive**: For an object players can interact with (has ActionsManager)
   - **generic**: For any other entity type

3. Use **prefab_create** to generate the prefab with:
   - A descriptive name
   - The correct prefab type
   - Parent prefab inheritance if modifying an existing prefab
   - Appropriate components

4. Explain what each component does and any additional setup needed.

Important rules:
- Prefab files use Enfusion text serialization format
- Components need GUIDs (generated automatically)
- Inherit from existing prefabs with parentPrefab when modifying base game content
- Interactive objects need ActionsManagerComponent for UserActions
- Characters need InventoryStorageManagerComponent for inventory`,
          },
        },
      ],
    })
  );
}
