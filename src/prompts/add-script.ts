import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerAddScriptPrompt(server: McpServer): void {
  server.registerPrompt(
    "add-script",
    {
      title: "Add a script to a mod",
      description:
        "Guided workflow to create a new Enforce Script (.c) file with the correct structure and methods.",
      argsSchema: {
        description: z
          .string()
          .describe("Describe what the script should do (e.g., 'A component that tracks player kills')"),
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
            text: `I need a new Enforce Script for my Arma Reforger mod: ${description}
${projectPath ? `\nProject path: ${projectPath}` : ""}

Please help me create this script:

1. Use **api_search** to find the right parent class and relevant API methods for this functionality.

2. Determine the correct scriptType:
   - **modded**: To override an existing class (e.g., modify damage calculation)
   - **component**: For a ScriptComponent attached to entities (most common)
   - **gamemode**: For a custom game mode (extends SCR_BaseGameMode)
   - **action**: For an interactive UserAction (doors, switches, pickups)
   - **entity**: For a standalone entity (extends GenericEntity)
   - **manager**: For a singleton/static utility class
   - **basic**: For a plain class with no special base

3. Use **script_create** to generate the script with:
   - A descriptive class name with a consistent prefix
   - The correct parent class
   - Appropriate method stubs

4. Explain what each method does and how to implement the logic.

Important rules:
- Scripts MUST be in Scripts/Game/ (other folders are silently ignored)
- Class names should use a prefix (e.g., TAG_MyComponent)
- Always call super.Method() in overrides unless intentionally replacing
- Use [Attribute()] to expose configurable values in Workbench`,
          },
        },
      ],
    })
  );
}
