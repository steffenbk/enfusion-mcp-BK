import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { searchKb, getIndexSummary } from "./kb-loader.js";

/**
 * Per-file ceiling on returned KB content. Sized so the worst case (max_files: 4)
 * stays around 120 K chars rather than the ~180 K an uncapped answer could reach.
 */
const MAX_FILE_CHARS = 30_000;

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

      // Cap each file. The KB's largest entries are ~57 KB and max_files allows 4,
      // so an uncapped answer could return ~180 KB in a single call — and this is
      // the most-called KB tool, since its own description tells the model to reach
      // for it before writing EnforceScript. wiki_read already truncates at 100 K
      // and wiki_search at 2–8 K; this was the one KB path with no ceiling.
      const parts = result.files.map((f) => {
        const body =
          f.content.length <= MAX_FILE_CHARS
            ? f.content
            : `${f.content.slice(0, MAX_FILE_CHARS)}\n\n... (truncated at ${MAX_FILE_CHARS.toLocaleString()} of ${f.content.length.toLocaleString()} chars — narrow the query to see the rest)`;
        return `## ${f.title}\n\n${body}`;
      });

      return {
        content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
      };
    }
  );
}
