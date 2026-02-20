import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchEngine } from "../index/search-engine.js";

export function registerWikiSearch(server: McpServer, searchEngine: SearchEngine): void {
  server.registerTool(
    "wiki_search",
    {
      description:
        "Search tutorial and guide content about Enfusion engine concepts, scripting patterns, and Arma Reforger modding topics.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Topic to search for (e.g., 'replication', 'event system', 'world systems')"
          ),
        limit: z
          .number()
          .min(1)
          .max(10)
          .default(5)
          .describe("Maximum results to return"),
      },
    },
    async ({ query, limit }) => {
      const results = searchEngine.searchWiki(query, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No wiki/tutorial pages found matching "${query}". Try broader terms like "replication", "entities", "scripting", or "components".`,
            },
          ],
        };
      }

      const parts = results.map((page) => {
        const lines: string[] = [];
        lines.push(`## ${page.title}`);
        const sourceLabel =
          page.source === "bistudio-wiki"
            ? "BI Community Wiki"
            : page.source === "enfusion"
              ? "Enfusion Engine docs"
              : "Arma Reforger docs";
        lines.push(`Source: ${sourceLabel}${page.url ? ` — ${page.url}` : ""}`);
        lines.push("");

        // For short pages show everything, for long ones show a truncated excerpt
        const MAX_LENGTH = 2000;
        if (page.content.length <= MAX_LENGTH) {
          lines.push(page.content);
        } else {
          lines.push(page.content.slice(0, MAX_LENGTH));
          lines.push(`\n... (truncated, ${page.content.length} chars total)`);
        }

        return lines.join("\n");
      });

      return {
        content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
      };
    }
  );
}
