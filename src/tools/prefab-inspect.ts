import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import {
  walkChain,
  mergeAncestryComponents,
  type AncestorLevel,
} from "../utils/prefab-ancestry.js";

// ── Output ────────────────────────────────────────────────────────────────────

function formatReport(
  levels: AncestorLevel[],
  warnings: string[],
  includeRaw: boolean
): string {
  const lines: string[] = [];

  lines.push("=== Prefab Inheritance Chain ===");
  for (const level of levels) {
    const tag = level.depth === levels.length - 1 ? "  ← this file" : "";
    lines.push(`  [${level.depth}] ${level.path}  [${level.entityClass}]${tag}`);
  }

  if (warnings.length > 0) {
    lines.push("");
    for (const w of warnings) lines.push(`  WARNING: ${w}`);
  }

  const merged = mergeAncestryComponents(levels);

  lines.push("");
  lines.push("=== Merged Components ===");

  if (merged.size === 0) {
    lines.push("  (no components found in chain)");
  }

  for (const [, { comp, source }] of merged) {
    const isLeaf = source.depth === levels.length - 1;
    const srcTag = isLeaf ? "← this file" : `inherited from [${source.depth}]: ${source.path}`;
    lines.push("");
    lines.push(`[${comp.typeName} {${comp.guid}}]  ${srcTag}`);
    for (const bl of comp.rawBody.split("\n")) {
      if (bl.trim()) lines.push(`  ${bl}`);
    }
  }

  if (includeRaw) {
    lines.push("");
    lines.push("=== Raw File Contents ===");
    for (const level of levels) {
      lines.push(`\n--- [${level.depth}] ${level.path} ---\n${level.rawContent}`);
    }
  }

  return lines.join("\n");
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerPrefabInspect(server: McpServer, config: Config): void {
  server.registerTool(
    "prefab_inspect",
    {
      description:
        "Inspect an Arma Reforger prefab (.et file) and its full inheritance chain. " +
        "Reads each ancestor prefab, parses all components, and returns a fully merged view " +
        "showing which ancestor each component comes from. " +
        "Child values override parent values (matched by component GUID). " +
        "Use this to understand the complete component set of a prefab, including all " +
        "inherited values not visible in the prefab file itself.",
      inputSchema: {
        path: z.string().describe(
          "Relative prefab path, e.g. 'Prefabs/Weapons/Handguns/M9/Handgun_M9.et'. " +
          "A leading {GUID} prefix is accepted and stripped automatically."
        ),
        include_raw: z.boolean().default(false).describe(
          "Include the full raw .et text for each ancestor at the bottom of the report."
        ),
        projectPath: z.string().optional().describe(
          "Mod project root to search first. Uses ENFUSION_PROJECT_PATH if omitted."
        ),
      },
    },
    async ({ path: inputPath, include_raw, projectPath }) => {
      try {
        const { levels, warnings } = walkChain(inputPath, config, projectPath);

        if (levels.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Could not read prefab: ${inputPath}\n` +
                (warnings.length > 0 ? warnings.join("\n") : "File not found."),
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text",
            text: formatReport(levels, warnings, include_raw ?? false),
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
