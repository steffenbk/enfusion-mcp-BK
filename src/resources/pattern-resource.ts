import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PatternLibrary } from "../patterns/loader.js";

export function registerPatternResource(
  server: McpServer,
  patterns: PatternLibrary
): void {
  server.registerResource(
    "pattern-info",
    new ResourceTemplate("enfusion://pattern/{patternName}", {
      list: async () => {
        const names = patterns.list();
        return {
          resources: names.map((name) => ({
            uri: `enfusion://pattern/${name}`,
            name,
          })),
        };
      },
    }),
    { title: "Mod Pattern", mimeType: "application/json" },
    async (uri, { patternName }) => {
      const name = Array.isArray(patternName) ? patternName[0] : patternName;
      const pattern = patterns.get(name);

      if (!pattern) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: `Pattern "${name}" not found` }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(pattern, null, 2),
          },
        ],
      };
    }
  );
}
