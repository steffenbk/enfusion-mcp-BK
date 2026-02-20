import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbComponent(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_component",
    {
      description:
        "Manage components on an entity in the World Editor. Add, remove, or list components attached to an entity.",
      inputSchema: {
        entityName: z.string().describe("Name of the target entity"),
        action: z
          .enum(["add", "remove", "list"])
          .describe("Action to perform: add a new component, remove an existing one, or list all components"),
        componentClass: z
          .string()
          .optional()
          .describe("Component class name (required for add/remove, e.g., 'RigidBody', 'MeshObject')"),
        componentIndex: z
          .number()
          .optional()
          .describe("Component index for removal when multiple components of the same class exist"),
      },
    },
    async ({ entityName, action, componentClass, componentIndex }) => {
      try {
        if ((action === "add" || action === "remove") && !componentClass) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`componentClass\` is required for the "${action}" action.`,
              },
            ],
          };
        }

        const params: Record<string, unknown> = { entityName, action };
        if (componentClass) params.componentClass = componentClass;
        if (componentIndex !== undefined) params.componentIndex = componentIndex;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Components", params);

        if (action === "list") {
          const components = Array.isArray(result.components) ? result.components : [];
          if (components.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `**${entityName}** has no components.`,
                },
              ],
            };
          }

          const lines = [`**Components on ${entityName}** (${components.length})\n`];
          for (let i = 0; i < components.length; i++) {
            const comp = components[i] as Record<string, unknown>;
            const className = comp.className || comp.type || "Unknown";
            const props = comp.propertyCount ? ` (${comp.propertyCount} properties)` : "";
            lines.push(`${i}. **${className}**${props}`);
          }
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        const actionLabel = action === "add" ? "Added" : "Removed";
        return {
          content: [
            {
              type: "text" as const,
              text: `**Component ${actionLabel}**\n\n- **Entity:** ${entityName}\n- **Component:** ${componentClass}${result.message ? `\n- **Note:** ${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error managing component on "${entityName}": ${msg}`,
            },
          ],
        };
      }
    }
  );
}
