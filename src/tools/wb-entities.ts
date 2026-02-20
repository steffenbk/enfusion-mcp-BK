import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

function formatEntityDetails(data: Record<string, unknown>): string {
  const lines: string[] = [];

  if (data.name) lines.push(`- **Name:** ${data.name}`);
  if (data.prefab) lines.push(`- **Prefab:** ${data.prefab}`);
  if (data.className) lines.push(`- **Class:** ${data.className}`);
  if (data.position) lines.push(`- **Position:** ${data.position}`);
  if (data.rotation) lines.push(`- **Rotation:** ${data.rotation}`);
  if (data.layerPath) lines.push(`- **Layer:** ${data.layerPath}`);
  if (data.parentName) lines.push(`- **Parent:** ${data.parentName}`);

  if (Array.isArray(data.components) && data.components.length > 0) {
    lines.push(`\n### Components (${data.components.length})`);
    for (let i = 0; i < data.components.length; i++) {
      const comp = data.components[i] as Record<string, unknown>;
      lines.push(`${i}. ${comp.className || comp.type || "Unknown"}`);
    }
  }

  if (Array.isArray(data.children) && data.children.length > 0) {
    lines.push(`\n### Children (${data.children.length})`);
    for (const child of data.children) {
      const c = child as Record<string, unknown>;
      lines.push(`- ${c.name || "unnamed"}`);
    }
  }

  return lines.join("\n");
}

function formatEntityList(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const total = typeof data.total === "number" ? data.total : entities.length;
  const offset = typeof data.offset === "number" ? data.offset : 0;

  lines.push(`**Entities** (showing ${entities.length} of ${total}, offset ${offset})\n`);

  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i] as Record<string, unknown>;
    const name = ent.name || "(unnamed)";
    const prefab = ent.prefab ? ` [${ent.prefab}]` : "";
    const pos = ent.position ? ` at ${ent.position}` : "";
    lines.push(`${offset + i + 1}. **${name}**${prefab}${pos}`);
  }

  if (total > offset + entities.length) {
    lines.push(`\n*${total - offset - entities.length} more entities not shown. Use offset/limit to paginate.*`);
  }

  return lines.join("\n");
}

export function registerWbEntityTools(server: McpServer, client: WorkbenchClient): void {
  // wb_entity_create
  server.registerTool(
    "wb_entity_create",
    {
      description:
        "Create a new entity in the World Editor from a prefab. Optionally set position, rotation, name, and target layer.",
      inputSchema: {
        prefab: z
          .string()
          .describe("Prefab resource path (e.g., '{GUID}Prefabs/Characters/SoldierUS.et')"),
        position: z
          .string()
          .optional()
          .describe("World position as 'x y z' (e.g., '100 0 200'). Defaults to origin."),
        rotation: z
          .string()
          .optional()
          .describe("Rotation as 'pitch yaw roll' in degrees (e.g., '0 90 0')"),
        name: z
          .string()
          .optional()
          .describe("Entity display name. Auto-generated if omitted."),
        layerPath: z
          .string()
          .optional()
          .describe("Target layer path (e.g., 'default/MyLayer'). Uses active layer if omitted."),
      },
    },
    async ({ prefab, position, rotation, name, layerPath }) => {
      try {
        const params: Record<string, unknown> = { prefab };
        if (position) params.position = position;
        if (rotation) params.rotation = rotation;
        if (name) params.name = name;
        if (layerPath) params.layerPath = layerPath;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_CreateEntity", params);

        const lines: string[] = ["**Entity Created**\n"];
        if (result.name) lines.push(`- **Name:** ${result.name}`);
        lines.push(`- **Prefab:** ${prefab}`);
        if (position) lines.push(`- **Position:** ${position}`);
        if (rotation) lines.push(`- **Rotation:** ${rotation}`);
        if (layerPath) lines.push(`- **Layer:** ${layerPath}`);
        if (result.id) lines.push(`- **ID:** ${result.id}`);

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error creating entity: ${msg}` }],
        };
      }
    }
  );

  // wb_entity_delete
  server.registerTool(
    "wb_entity_delete",
    {
      description: "Delete an entity from the World Editor by name.",
      inputSchema: {
        name: z.string().describe("Name of the entity to delete"),
      },
    },
    async ({ name }) => {
      try {
        await client.call("EMCP_WB_DeleteEntity", { name });

        return {
          content: [
            {
              type: "text" as const,
              text: `**Entity Deleted**\n\nRemoved entity: ${name}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error deleting entity "${name}": ${msg}` }],
        };
      }
    }
  );

  // wb_entity_list
  server.registerTool(
    "wb_entity_list",
    {
      description:
        "List entities in the current world. Supports pagination and optional name filtering.",
      inputSchema: {
        offset: z
          .number()
          .default(0)
          .describe("Starting offset for pagination (default 0)"),
        limit: z
          .number()
          .default(50)
          .describe("Maximum number of entities to return (default 50)"),
        nameFilter: z
          .string()
          .optional()
          .describe("Filter entities by name substring (case-insensitive)"),
      },
    },
    async ({ offset, limit, nameFilter }) => {
      try {
        const params: Record<string, unknown> = { offset, limit };
        if (nameFilter) params.nameFilter = nameFilter;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_ListEntities", params);

        return {
          content: [{ type: "text" as const, text: formatEntityList(result) }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error listing entities: ${msg}` }],
        };
      }
    }
  );

  // wb_entity_inspect
  server.registerTool(
    "wb_entity_inspect",
    {
      description:
        "Get detailed information about a specific entity, including its components, properties, position, and children. Identify by name or index.",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe("Entity name to inspect"),
        index: z
          .number()
          .optional()
          .describe("Entity index (from wb_entity_list) to inspect"),
      },
    },
    async ({ name, index }) => {
      try {
        const params: Record<string, unknown> = {};
        if (name) params.name = name;
        if (index !== undefined) params.index = index;

        if (!name && index === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide either `name` or `index` to identify the entity.",
              },
            ],
          };
        }

        const result = await client.call<Record<string, unknown>>("EMCP_WB_GetEntity", params);

        const label = name || `index ${index}`;
        return {
          content: [
            {
              type: "text" as const,
              text: `**Entity: ${result.name || label}**\n\n${formatEntityDetails(result)}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error inspecting entity: ${msg}` }],
        };
      }
    }
  );

  // wb_entity_modify
  server.registerTool(
    "wb_entity_modify",
    {
      description:
        "Modify an entity in the World Editor. Supports moving, rotating, renaming, reparenting, and setting or clearing component properties.",
      inputSchema: {
        name: z.string().describe("Name of the entity to modify"),
        action: z
          .enum(["move", "rotate", "rename", "reparent", "setProperty", "clearProperty"])
          .describe(
            "Modification action: move (set position), rotate (set rotation), rename, reparent (change parent entity), setProperty (set a component property), clearProperty (reset to default)"
          ),
        value: z
          .string()
          .describe(
            "Value for the action: coordinates 'x y z' for move/rotate, new name for rename, parent name for reparent, property value for setProperty (ignored for clearProperty)"
          ),
        propertyPath: z
          .string()
          .optional()
          .describe("Component property path for setProperty/clearProperty (e.g., 'MeshObject.Object')"),
        propertyKey: z
          .string()
          .optional()
          .describe("Property key name for setProperty/clearProperty"),
      },
    },
    async ({ name, action, value, propertyPath, propertyKey }) => {
      try {
        const params: Record<string, unknown> = { name, action, value };
        if (propertyPath) params.propertyPath = propertyPath;
        if (propertyKey) params.propertyKey = propertyKey;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_ModifyEntity", params);

        const actionLabels: Record<string, string> = {
          move: `Moved to ${value}`,
          rotate: `Rotated to ${value}`,
          rename: `Renamed to "${value}"`,
          reparent: `Reparented to "${value}"`,
          setProperty: `Set ${propertyPath || propertyKey || "property"} = ${value}`,
          clearProperty: `Cleared ${propertyPath || propertyKey || "property"}`,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `**Entity Modified**\n\n- **Entity:** ${name}\n- **Action:** ${actionLabels[action] || action}${result.message ? `\n- **Note:** ${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error modifying entity "${name}": ${msg}`,
            },
          ],
        };
      }
    }
  );

  // wb_entity_select
  server.registerTool(
    "wb_entity_select",
    {
      description:
        "Manage entity selection in the World Editor. Select, deselect, clear selection, or get the current selection.",
      inputSchema: {
        action: z
          .enum(["select", "deselect", "clear", "getSelected"])
          .describe("Selection action to perform"),
        name: z
          .string()
          .optional()
          .describe("Entity name (required for select/deselect, ignored for clear/getSelected)"),
      },
    },
    async ({ action, name }) => {
      try {
        if ((action === "select" || action === "deselect") && !name) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`name\` is required for the "${action}" action.`,
              },
            ],
          };
        }

        const params: Record<string, unknown> = { action };
        if (name) params.name = name;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_SelectEntity", params);

        if (action === "getSelected") {
          const selected = Array.isArray(result.selected) ? result.selected : [];
          if (selected.length === 0) {
            return {
              content: [{ type: "text" as const, text: "**No entities selected.**" }],
            };
          }
          const lines = ["**Selected Entities**\n"];
          for (const ent of selected) {
            const e = ent as Record<string, unknown>;
            lines.push(`- ${e.name || "(unnamed)"}`);
          }
          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        const labels: Record<string, string> = {
          select: `Selected: ${name}`,
          deselect: `Deselected: ${name}`,
          clear: "Selection cleared",
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `**${labels[action]}**${result.message ? `\n\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            { type: "text" as const, text: `Error with selection (${action}): ${msg}` },
          ],
        };
      }
    }
  );
}
