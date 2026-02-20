import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbClipboard(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_clipboard",
    {
      description:
        "Clipboard operations in the World Editor. Copy, cut, paste, paste at cursor, duplicate selected entities, or check if clipboard has content.",
      inputSchema: {
        action: z
          .enum(["copy", "cut", "paste", "pasteAtCursor", "duplicate", "hasCopied"])
          .describe(
            "Clipboard action: copy/cut (selected entities to clipboard), paste (at original position), pasteAtCursor (at cursor position), duplicate (copy+paste in place), hasCopied (check clipboard)"
          ),
      },
    },
    async ({ action }) => {
      try {
        const result = await client.call<Record<string, unknown>>("EMCP_WB_Clipboard", {
          action,
        });

        if (action === "hasCopied") {
          const hasCopied = result.hasCopied ?? result.result ?? false;
          return {
            content: [
              {
                type: "text" as const,
                text: `**Clipboard:** ${hasCopied ? "Has content" : "Empty"}`,
              },
            ],
          };
        }

        const actionLabels: Record<string, string> = {
          copy: "Copied to clipboard",
          cut: "Cut to clipboard",
          paste: "Pasted from clipboard",
          pasteAtCursor: "Pasted at cursor position",
          duplicate: "Duplicated selection",
        };

        const lines = [`**${actionLabels[action] || action}**`];
        if (result.count !== undefined) lines.push(`\nEntities affected: ${result.count}`);
        if (result.message) lines.push(`\n${result.message}`);

        return { content: [{ type: "text" as const, text: lines.join("") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error with clipboard (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
