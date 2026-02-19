import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchEngine } from "../index/search-engine.js";

export function registerGroupResource(
  server: McpServer,
  searchEngine: SearchEngine
): void {
  server.registerResource(
    "group-info",
    new ResourceTemplate("enfusion://group/{groupName}", {
      list: async () => {
        const groups = searchEngine.getGroups();
        return {
          resources: groups.map((g) => ({
            uri: `enfusion://group/${g.name}`,
            name: g.name,
            description: g.description,
          })),
        };
      },
    }),
    { title: "API Group", mimeType: "application/json" },
    async (uri, { groupName }) => {
      const name = Array.isArray(groupName) ? groupName[0] : groupName;
      const group = searchEngine.getGroup(name);

      if (!group) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: `Group "${name}" not found` }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                name: group.name,
                description: group.description,
                classCount: group.classes.length,
                classes: group.classes,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
