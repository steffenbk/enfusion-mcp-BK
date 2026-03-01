import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerGameDuplicate(
  server: McpServer,
  config: Config,
  client: WorkbenchClient
): void {
  server.registerTool(
    "game_duplicate",
    {
      description:
        "Duplicate a base game prefab (.et) or config (.conf) into your mod folder for editing. " +
        "Reads the file from game data or .pak archives, writes it to your mod's directory, " +
        "then registers it with Workbench so it gets a new resource GUID. " +
        "Mirrors the Workbench right-click → Duplicate workflow. " +
        "Use asset_search to find the source path (with GUID) first.",
      inputSchema: {
        sourcePath: z
          .string()
          .describe(
            "Source prefab path — either a GUID reference like '{657590C1EC9E27D3}Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et' " +
            "or a bare relative path like 'Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et'"
          ),
        destPath: z
          .string()
          .describe(
            "Destination path within your mod folder, relative to the addon root " +
            "(e.g., 'Prefabs/Groups/MyCustomGroup.et'). Must end in .et"
          ),
        modName: z
          .string()
          .optional()
          .describe(
            "Addon folder name under ENFUSION_PROJECT_PATH (e.g., 'MyMod'). " +
            "If omitted, the first addon found in the project path is used."
          ),
        register: z
          .boolean()
          .default(true)
          .describe(
            "Register the duplicated file with Workbench after writing (assigns a new GUID). " +
            "Requires Workbench to be running. Set false to write the file without registering."
          ),
      },
    },
    async ({ sourcePath, destPath, modName, register }) => {
      // Use Workbench to do the duplication: place entity → createTemplate → delete entity
      // This is the most reliable approach — Workbench assigns the GUID correctly.

      if (!register) {
        return {
          content: [
            {
              type: "text",
              text: "register=false is not supported for the Workbench-based duplicate workflow. " +
                "Workbench must be running to duplicate prefabs. Set register=true (default).",
            },
          ],
        };
      }

      const tempName = `_EMCP_Dup_${Date.now()}`;

      try {
        // Step 1: Place the source prefab in the world temporarily
        const createResp = await client.call<{ status: string; message?: string }>(
          "EMCP_WB_CreateEntity",
          { prefab: sourcePath, name: tempName }
        );

        if (createResp.status !== "ok") {
          return {
            content: [
              {
                type: "text",
                text: `Failed to place source prefab: ${createResp.message ?? JSON.stringify(createResp)}`,
              },
            ],
          };
        }

        // Step 2: Save as template in mod folder
        let templateResp: { status: string; message?: string; path?: string };
        try {
          templateResp = await client.call<{ status: string; message?: string; path?: string }>(
            "EMCP_WB_Prefabs",
            { action: "createTemplate", entityName: tempName, templatePath: destPath }
          );
        } finally {
          // Step 3: Always delete the temp entity, even if createTemplate fails
          try {
            await client.call("EMCP_WB_DeleteEntity", { name: tempName });
          } catch {
            // Best-effort cleanup
          }
        }

        if (templateResp!.status !== "ok") {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create template: ${templateResp!.message ?? JSON.stringify(templateResp)}`,
              },
            ],
          };
        }

        const savedPath = templateResp!.path ?? destPath;
        return {
          content: [
            {
              type: "text",
              text: [
                `**Prefab duplicated successfully**`,
                `- Source: ${sourcePath}`,
                `- Saved to: ${savedPath}`,
                ``,
                `The prefab now has a new resource GUID assigned by Workbench.`,
                `Use wb_resources getInfo or wb_prefabs getGuid to look up the new GUID.`,
                ``,
                `**Next steps:**`,
                `1. Edit the .et file to customize it.`,
                `2. Reference it as {GUID}${destPath} in your prefabs.`,
              ].join("\n"),
            },
          ],
        };
      } catch (e) {
        // Make sure temp entity is cleaned up on unexpected error
        try {
          await client.call("EMCP_WB_DeleteEntity", { name: tempName });
        } catch {
          // Ignore
        }
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error during duplication: ${msg}` }],
        };
      }
    }
  );
}
