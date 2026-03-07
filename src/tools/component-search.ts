import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchEngine, ComponentSearchResult } from "../index/search-engine.js";

function formatComponentResult(result: ComponentSearchResult, verbose: boolean): string {
  const { component: cls, categories, eventHandlers } = result;
  const lines: string[] = [];

  lines.push(`## ${cls.name}`);
  lines.push(`Source: ${cls.source === "enfusion" ? "Enfusion Engine" : "Arma Reforger"} API`);
  lines.push(`Category: ${categories.join(", ")}`);
  if (cls.parents.length > 0) lines.push(`Extends: ${cls.parents.join(", ")}`);
  if (cls.group) lines.push(`Group: ${cls.group}`);

  if (cls.brief) {
    lines.push("");
    lines.push(cls.brief);
  }

  if (verbose && cls.description && cls.description !== cls.brief) {
    lines.push("");
    lines.push(cls.description);
  }

  // Event handlers
  if (eventHandlers.length > 0) {
    lines.push("");
    lines.push(`### Event Handlers (${eventHandlers.length})`);
    for (const handler of eventHandlers) {
      // Find the full signature for this handler
      const allMethods = [...(cls.methods || []), ...(cls.protectedMethods || [])];
      const method = allMethods.find((m) => m.name === handler);
      if (method) {
        const desc = method.description ? ` -- ${method.description}` : "";
        lines.push(`- ${method.signature}${desc}`);
      } else {
        lines.push(`- ${handler}()`);
      }
    }
  }

  if (verbose) {
    // Non-event public methods
    const nonEventMethods = (cls.methods || []).filter((m) => !/^(EOn|On)[A-Z]/.test(m.name));
    if (nonEventMethods.length > 0) {
      const shown = nonEventMethods.slice(0, 10);
      lines.push("");
      lines.push(`### Public Methods (${nonEventMethods.length})`);
      for (const m of shown) {
        const desc = m.description ? ` -- ${m.description}` : "";
        lines.push(`- ${m.signature}${desc}`);
      }
      if (nonEventMethods.length > 10) {
        lines.push(`  ... and ${nonEventMethods.length - 10} more`);
      }
    }

    // Protected methods (non-event)
    const nonEventProtected = (cls.protectedMethods || []).filter((m) => !/^(EOn|On)[A-Z]/.test(m.name));
    if (nonEventProtected.length > 0) {
      const shown = nonEventProtected.slice(0, 10);
      lines.push("");
      lines.push(`### Protected Methods (${nonEventProtected.length})`);
      for (const m of shown) {
        const desc = m.description ? ` -- ${m.description}` : "";
        lines.push(`- ${m.signature}${desc}`);
      }
      if (nonEventProtected.length > 10) {
        lines.push(`  ... and ${nonEventProtected.length - 10} more`);
      }
    }

    // Properties
    const properties = cls.properties || [];
    if (properties.length > 0) {
      const shown = properties.slice(0, 10);
      lines.push("");
      lines.push(`### Properties (${properties.length})`);
      for (const p of shown) {
        const desc = p.description ? ` -- ${p.description}` : "";
        lines.push(`- ${p.type} **${p.name}**${desc}`);
      }
      if (properties.length > 10) {
        lines.push(`  ... and ${properties.length - 10} more`);
      }
    }

    // Children
    if (cls.children.length > 0) {
      const shown = cls.children.slice(0, 10);
      const suffix = cls.children.length > 10 ? ` ... and ${cls.children.length - 10} more` : "";
      lines.push("");
      lines.push(`Direct subclasses: ${shown.join(", ")}${suffix}`);
    }
  }

  if (cls.docsUrl) {
    lines.push("");
    lines.push(`Docs: ${cls.docsUrl}`);
  }

  return lines.join("\n");
}

export function registerComponentSearch(server: McpServer, searchEngine: SearchEngine): void {
  server.registerTool(
    "component_search",
    {
      description:
        "Search for Enfusion ScriptComponent descendants — the building blocks you attach to entities in prefabs. Filter by category (character, vehicle, weapon, damage, inventory, ai, ui, editor, camera, sound, general) and/or by event handler name (e.g., 'OnPlayerConnected', 'EOnFrame', 'OnDamage'). Use this when you need to find what component to attach to an entity to achieve specific functionality.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Component name or keyword to search for"),
        category: z
          .enum([
            "character",
            "vehicle",
            "weapon",
            "damage",
            "inventory",
            "ai",
            "ui",
            "editor",
            "camera",
            "sound",
            "general",
            "any",
          ])
          .default("any")
          .describe("Filter by target entity type or functional area"),
        event: z
          .string()
          .optional()
          .describe(
            "Filter by event handler name (e.g., 'EOnFrame', 'OnPlayerConnected', 'OnDamage')"
          ),
        source: z
          .enum(["enfusion", "arma", "all"])
          .default("all")
          .describe("Search enfusion engine API, arma reforger API, or both"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum results to return"),
      },
    },
    async ({ query, category, event, source, limit }) => {
      const results = searchEngine.searchComponents({
        query,
        category,
        event,
        source,
        limit,
      });

      if (results.length === 0) {
        const filters: string[] = [];
        if (query) filters.push(`query "${query}"`);
        if (category !== "any") filters.push(`category "${category}"`);
        if (event) filters.push(`event "${event}"`);
        const filterDesc = filters.length > 0 ? ` matching ${filters.join(", ")}` : "";
        return {
          content: [
            {
              type: "text",
              text: `No components found${filterDesc}. Try broadening your search — use a shorter query, remove the category filter, or search without an event filter.`,
            },
          ],
        };
      }

      const verbose = results.length === 1;
      const header = `Found ${results.length} component${results.length !== 1 ? "s" : ""}:\n`;
      const formatted = results
        .map((r) => formatComponentResult(r, verbose))
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text", text: header + formatted }],
      };
    }
  );
}
