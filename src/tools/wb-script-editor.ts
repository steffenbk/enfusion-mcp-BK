import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

export function registerWbScriptEditor(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "wb_script_editor",
    {
      description:
        "Interact with the Workbench Script Editor. Get the current file, read/write individual lines, insert new lines, remove lines, or get the total line count.",
      inputSchema: {
        action: z
          .enum(["getCurrentFile", "getLine", "setLine", "insertLine", "removeLine", "getLinesCount", "openFile"])
          .describe(
            "Action: getCurrentFile (path of open file), getLine (read line N), setLine (overwrite line N), insertLine (insert before line N), removeLine (delete line N), getLinesCount (total lines), openFile (open file by path)"
          ),
        line: z
          .number()
          .optional()
          .describe("Line number (1-based). Required for getLine, setLine, insertLine, removeLine."),
        text: z
          .string()
          .optional()
          .describe("Text content for setLine and insertLine"),
        path: z
          .string()
          .optional()
          .describe("File path for openFile action (e.g., 'Scripts/Game/MyScript.c')"),
      },
    },
    async ({ action, line, text, path }) => {
      try {
        // Validate required params per action
        if (
          (action === "getLine" || action === "setLine" || action === "insertLine" || action === "removeLine") &&
          line === undefined
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`line\` number is required for the "${action}" action.`,
              },
            ],
          };
        }

        if ((action === "setLine" || action === "insertLine") && text === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`text\` is required for the "${action}" action.`,
              },
            ],
          };
        }

        if (action === "openFile" && !path) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: \`path\` is required for the "openFile" action.`,
              },
            ],
          };
        }

        const params: Record<string, unknown> = { action };
        if (line !== undefined) params.line = line;
        if (text !== undefined) params.text = text;
        if (path !== undefined) params.path = path;

        const result = await client.call<Record<string, unknown>>("EMCP_WB_ScriptEditor", params);

        if (action === "getCurrentFile") {
          const filePath = result.path || result.file || "(no file open)";
          return {
            content: [
              {
                type: "text" as const,
                text: `**Current Script File:** ${filePath}`,
              },
            ],
          };
        }

        if (action === "getLine") {
          const lineText = result.text ?? result.content ?? "";
          return {
            content: [
              {
                type: "text" as const,
                text: `**Line ${line}:**\n\`\`\`\n${lineText}\n\`\`\``,
              },
            ],
          };
        }

        if (action === "getLinesCount") {
          const count = result.count ?? result.lineCount ?? result.lines ?? result.linesCount ?? "unknown";
          return {
            content: [
              {
                type: "text" as const,
                text: `**Line Count:** ${count}`,
              },
            ],
          };
        }

        if (action === "setLine") {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Line ${line} Updated**\n\nNew content:\n\`\`\`\n${text}\n\`\`\``,
              },
            ],
          };
        }

        if (action === "insertLine") {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Line Inserted** at position ${line}\n\nContent:\n\`\`\`\n${text}\n\`\`\``,
              },
            ],
          };
        }

        if (action === "removeLine") {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Line ${line} Removed**${result.text ? `\n\nRemoved content:\n\`\`\`\n${result.text}\n\`\`\`` : ""}`,
              },
            ],
          };
        }

        if (action === "openFile") {
          return {
            content: [
              {
                type: "text" as const,
                text: `**Opened:** ${path}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error in script editor (${action}): ${msg}`,
            },
          ],
        };
      }
    }
  );
}
