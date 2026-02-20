import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbProjects(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_projects",
    {
      description:
        "Query project information from the Workbench. List all loaded addon projects, locate a specific project by name, or open a .gproj to load it into Workbench.",
      inputSchema: {
        action: z
          .enum(["list", "locate", "open"])
          .describe("Action: list (all loaded projects), locate (find specific project path), or open (load a .gproj into Workbench)"),
        name: z
          .string()
          .optional()
          .describe("Project/addon name to locate (required for locate action), or .gproj file path (required for open action)"),
      },
    },
    async ({ action, name }) => {
      try {
        if (action === "open") {
          if (!name) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: `name` is required for the open action. Provide the .gproj file path or addon name.",
                },
              ],
            };
          }

          const result = await client.call<Record<string, unknown>>("EMCP_WB_EditorControl", {
            action: "openResource",
            path: name,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `**Project Opened**\n\nLoaded: ${name}${result.message ? `\n${result.message}` : ""}`,
              },
            ],
          };
        }

        if (action === "locate") {
          if (!name) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: `name` is required for the locate action.",
                },
              ],
            };
          }

          const result = await client.call<Record<string, unknown>>("LocateProject", {
            name,
          });

          const path = result.path || result.projectPath || "(not found)";
          return {
            content: [
              {
                type: "text" as const,
                text: `**Project Located**\n\n- **Name:** ${name}\n- **Path:** ${path}${result.guid ? `\n- **GUID:** ${result.guid}` : ""}`,
              },
            ],
          };
        }

        // list
        const result = await client.call<Record<string, unknown>>("GetLoadedProjects");

        const projects = Array.isArray(result.projects)
          ? result.projects
          : Array.isArray(result.addons)
            ? result.addons
            : [];

        if (projects.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "**No projects loaded** in Workbench." },
            ],
          };
        }

        const lines = [`**Loaded Projects** (${projects.length})\n`];
        for (const proj of projects) {
          if (typeof proj === "string") {
            lines.push(`- ${proj}`);
          } else {
            const p = proj as Record<string, unknown>;
            const pName = p.name || p.id || "(unnamed)";
            const pPath = p.path ? ` - ${p.path}` : "";
            const pGuid = p.guid ? ` (${p.guid})` : "";
            lines.push(`- **${pName}**${pPath}${pGuid}`);
          }
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error querying projects (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
