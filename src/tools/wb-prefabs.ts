import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbPrefabs(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_prefabs",
    {
      description:
        "Prefab operations in the Workbench. Create entity templates, save prefab changes, look up prefab GUIDs, or locate prefabs by path.",
      inputSchema: {
        action: z
          .enum(["createTemplate", "save", "getGuid", "locate"])
          .describe(
            "Action: createTemplate (create .et from entity), save (save prefab changes), getGuid (look up GUID), locate (find prefabs in path)"
          ),
        entityName: z
          .string()
          .optional()
          .describe("Entity name (required for createTemplate and save)"),
        templatePath: z
          .string()
          .optional()
          .describe("Output path for createTemplate (e.g., 'Prefabs/Custom/MyEntity.et')"),
        searchPath: z
          .string()
          .optional()
          .describe("Directory path for locate (e.g., 'Prefabs/Weapons')"),
      },
    },
    async ({ action, entityName, templatePath, searchPath }) => {
      try {
        if (action === "getGuid") {
          if (!templatePath && !searchPath) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: Provide `templatePath` (prefab resource path) for getGuid.",
                },
              ],
            };
          }

          const result = await client.call<Record<string, unknown>>("GetPrefabGUID", {
            path: templatePath || searchPath,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `**Prefab GUID**\n\n- **Path:** ${templatePath || searchPath}\n- **GUID:** ${result.guid || result.GUID || "(not found)"}`,
              },
            ],
          };
        }

        if (action === "locate") {
          if (!searchPath) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: Provide `searchPath` for the locate action.",
                },
              ],
            };
          }

          const result = await client.call<Record<string, unknown>>("LocatePrefabsFromPath", {
            path: searchPath,
          });

          const prefabs = Array.isArray(result.prefabs) ? result.prefabs : [];
          if (prefabs.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `**No prefabs found** in: ${searchPath}`,
                },
              ],
            };
          }

          const lines = [`**Prefabs in ${searchPath}** (${prefabs.length})\n`];
          for (const p of prefabs) {
            if (typeof p === "string") {
              lines.push(`- ${p}`);
            } else {
              const pObj = p as Record<string, unknown>;
              lines.push(`- ${pObj.path || pObj.name || JSON.stringify(pObj)}`);
            }
          }
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        // createTemplate and save use EMCP_WB_Prefabs
        if ((action === "createTemplate" || action === "save") && !entityName) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`entityName\` is required for the "${action}" action.`,
              },
            ],
          };
        }

        const params: Record<string, unknown> = { action, entityName };
        if (templatePath) params.templatePath = templatePath;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Prefabs", params);

        if (action === "createTemplate") {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Template Created**\n\n- **Entity:** ${entityName}\n- **Path:** ${templatePath || result.path || "(auto)"}${result.guid ? `\n- **GUID:** ${result.guid}` : ""}`,
              },
            ],
          };
        }

        // save
        return {
          content: [
            {
              type: "text" as const,
              text: `**Prefab Saved**\n\n- **Entity:** ${entityName}${result.message ? `\n- **Note:** ${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error with prefab operation (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
