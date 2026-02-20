import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbLocalization(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_localization",
    {
      description:
        "Manage localization entries in the Workbench Localization Editor. Insert, delete, or modify string table entries, or get the full localization table.",
      inputSchema: {
        action: z
          .enum(["insert", "delete", "modify", "getTable"])
          .describe(
            "Action: insert (add new entry), delete (remove entry), modify (update entry), getTable (list all entries)"
          ),
        itemId: z
          .string()
          .optional()
          .describe("Localization item ID / key (required for insert, delete, modify)"),
        property: z
          .string()
          .optional()
          .describe("Property to modify (e.g., 'en_us', 'target', 'comment')"),
        value: z
          .string()
          .optional()
          .describe("Value to set for insert/modify"),
      },
    },
    async ({ action, itemId, property, value }) => {
      try {
        if ((action === "insert" || action === "delete" || action === "modify") && !itemId) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`itemId\` is required for the "${action}" action.`,
              },
            ],
          };
        }

        if (action === "modify" && !property) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: `property` is required for the modify action.",
              },
            ],
          };
        }

        const params: Record<string, unknown> = { action };
        if (itemId) params.itemId = itemId;
        if (property) params.property = property;
        if (value !== undefined) params.value = value;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_Localization", params);

        if (action === "getTable") {
          const entries = Array.isArray(result.entries) ? result.entries : [];
          if (entries.length === 0) {
            return {
              content: [
                { type: "text" as const, text: "**Localization Table:** Empty (no entries)" },
              ],
            };
          }

          const lines = [`**Localization Table** (${entries.length} entries)\n`];
          lines.push("| ID | en_us | Target |");
          lines.push("|---|---|---|");
          for (const entry of entries) {
            const e = entry as Record<string, unknown>;
            const id = e.id || e.itemId || "?";
            const enUs = e.en_us || e.source || "";
            const target = e.target || "";
            lines.push(`| ${id} | ${enUs} | ${target} |`);
          }

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        }

        const actionLabels: Record<string, string> = {
          insert: `Inserted localization entry: **${itemId}**`,
          delete: `Deleted localization entry: **${itemId}**`,
          modify: `Modified **${itemId}**.${property} = "${value || ""}"`,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `**Localization Updated**\n\n${actionLabels[action]}${result.message ? `\n${result.message}` : ""}`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error in localization (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
