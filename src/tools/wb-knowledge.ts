import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { searchKb, getIndexSummary } from "./kb-loader.js";

const KB_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "kb"
);

export function registerWbKnowledge(server: McpServer): void {
  server.registerTool(
    "wb_knowledge",
    {
      description:
        "Search the Arma Reforger modding knowledge base — distilled pattern files covering scripting, " +
        "audio, weapons, vehicles, AI, UI, game modes, animation, and all other modding domains. " +
        "Use this before writing EnforceScript code or setting up any Enfusion modding system. " +
        "Call with query='index' to see all available topics.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Topic to look up (e.g. 'replication', 'weapon suppressor', 'scenario framework', 'audio signals'). Use 'index' to list all topics."
          ),
        max_files: z
          .number()
          .min(1)
          .max(4)
          .default(2)
          .describe("Maximum number of pattern files to return (default 2)"),
      },
    },
    async ({ query, max_files }) => {
      const result = searchKb(KB_DIR, query, max_files);

      if (result.usedIndex || result.files.length === 0) {
        const summary = getIndexSummary(KB_DIR);
        const prefix =
          result.files.length === 0 && !result.usedIndex
            ? `No KB entries matched "${query}". Showing all available topics:\n\n`
            : "";
        return {
          content: [{ type: "text", text: prefix + summary }],
        };
      }

      const parts = result.files.map(
        (f) => `## ${f.title}\n\n${f.content}`
      );

      return {
        content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
      };
    }
  );
}
