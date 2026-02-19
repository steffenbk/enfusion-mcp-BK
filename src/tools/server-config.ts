import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "../config.js";
import { generateServerConfig } from "../templates/server-config.js";

export function registerServerConfig(
  server: McpServer,
  config: Config
): void {
  server.registerTool(
    "server_config",
    {
      description:
        "Generate a dedicated server config (server.json) for testing an Arma Reforger mod locally. Configures ports, mod list, scenario, and game properties.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe("Server display name (e.g., 'My Mod Test Server')"),
        modName: z
          .string()
          .optional()
          .describe("Addon ID from .gproj (e.g., 'MyCustomMod')"),
        modId: z
          .string()
          .optional()
          .describe("Addon GUID from .gproj"),
        scenarioId: z
          .string()
          .optional()
          .describe(
            "Scenario resource path (e.g., '{GUID}Missions/MissionHeader.conf')"
          ),
        maxPlayers: z
          .number()
          .min(1)
          .max(128)
          .optional()
          .describe("Maximum players (default 32)"),
        port: z
          .number()
          .optional()
          .describe("Game host port (default 2001)"),
        a2sPort: z
          .number()
          .optional()
          .describe("A2S query port (default 17777)"),
        visible: z
          .boolean()
          .optional()
          .describe("Show in server browser (default false for local testing)"),
        password: z
          .string()
          .optional()
          .describe("Server password (empty = no password)"),
        projectPath: z
          .string()
          .optional()
          .describe("Project root to write server.json. Uses configured default if omitted."),
      },
    },
    async ({
      name,
      modName,
      modId,
      scenarioId,
      maxPlayers,
      port,
      a2sPort,
      visible,
      password,
      projectPath,
    }) => {
      const basePath = projectPath || config.projectPath;

      try {
        const content = generateServerConfig({
          name,
          modName,
          modId,
          scenarioId,
          maxPlayers,
          port,
          a2sPort,
          visible,
          password,
        });

        if (basePath) {
          const targetPath = resolve(basePath, "server.json");

          if (existsSync(targetPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File already exists: server.json\n\nGenerated content (not written):\n\n\`\`\`json\n${content}\n\`\`\``,
                },
              ],
            };
          }

          writeFileSync(targetPath, content, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: `Server config created: server.json\n\n\`\`\`json\n${content}\n\`\`\`\n\nLaunch with: ArmaReforgerServer.exe -config server.json`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Generated server config (no project path — not written to disk):\n\n\`\`\`json\n${content}\n\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            { type: "text", text: `Error creating server config: ${msg}` },
          ],
        };
      }
    }
  );
}
