import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchEngine } from "../index/search-engine.js";

export function registerWikiRead(server: McpServer, searchEngine: SearchEngine): void {
  server.registerTool(
    "wiki_read",
    {
      description:
        "Read the full content of a specific wiki page by title. Use wiki_search first to find page titles, " +
        "then use this tool to retrieve the complete text including code examples and tutorials. " +
        "Returns the full page without truncation (up to 100,000 characters).",
      inputSchema: {
        title: z
          .string()
          .describe(
            "Exact title of the wiki page to read (from wiki_search results)"
          ),
      },
    },
    async ({ title }) => {
      const page = searchEngine.getWikiPage(title);

      if (!page) {
        // Fuzzy fallback: search for similar titles
        const suggestions = searchEngine.searchWiki(title, 3);
        if (suggestions.length > 0) {
          const titles = suggestions.map((p) => `"${p.title}"`).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `No wiki page found with title "${title}". Did you mean: ${titles}?`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `No wiki page found with title "${title}". Use wiki_search to find available pages.`,
            },
          ],
        };
      }

      const MAX_FULL_LENGTH = 100_000;
      const sourceLabel =
        page.source === "bistudio-wiki"
          ? "BI Community Wiki"
          : page.source === "enfusion"
            ? "Enfusion Engine docs"
            : "Arma Reforger docs";

      const lines: string[] = [];
      lines.push(`## ${page.title}`);
      lines.push(`Source: ${sourceLabel}${page.url ? ` — ${page.url}` : ""}`);
      lines.push("");

      if (page.content.length <= MAX_FULL_LENGTH) {
        lines.push(page.content);
      } else {
        lines.push(page.content.slice(0, MAX_FULL_LENGTH));
        lines.push(
          `\n... (truncated at ${MAX_FULL_LENGTH.toLocaleString()} chars, ${page.content.length.toLocaleString()} chars total)`
        );
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );
}
