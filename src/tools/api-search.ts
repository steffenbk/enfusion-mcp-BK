import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  SearchEngine,
  MethodSearchResult,
  EnumSearchResult,
  PropertySearchResult,
} from "../index/search-engine.js";
import type { ClassInfo } from "../index/types.js";

function formatClassResult(cls: ClassInfo, verbose = true): string {
  const lines: string[] = [];
  lines.push(`## ${cls.name}`);
  lines.push(`Source: ${cls.source === "enfusion" ? "Enfusion Engine" : "Arma Reforger"} API`);
  if (cls.group) lines.push(`Group: ${cls.group}`);
  if (cls.parents.length > 0) lines.push(`Inherits from: ${cls.parents.join(", ")}`);
  if (cls.children.length > 0) {
    const shown = cls.children.slice(0, 10);
    const suffix = cls.children.length > 10 ? ` ... and ${cls.children.length - 10} more` : "";
    lines.push(`Direct subclasses: ${shown.join(", ")}${suffix}`);
  }

  if (cls.brief) {
    lines.push("");
    lines.push(cls.brief);
  }

  if (verbose && cls.description && cls.description !== cls.brief) {
    lines.push("");
    lines.push(cls.description);
  }

  // Enums
  const enums = cls.enums || [];
  if (enums.length > 0) {
    lines.push("");
    lines.push(`### Enums (${enums.length})`);
    for (const e of enums) {
      const desc = e.description ? ` -- ${e.description}` : "";
      lines.push(`- **${e.name}**${desc}`);
      if (verbose && e.values.length > 0) {
        const shown = e.values.slice(0, 20);
        for (const v of shown) {
          const valStr = v.value ? ` = ${v.value}` : "";
          const valDesc = v.description ? ` -- ${v.description}` : "";
          lines.push(`  - ${v.name}${valStr}${valDesc}`);
        }
        if (e.values.length > 20) {
          lines.push(`  - ... and ${e.values.length - 20} more values`);
        }
      }
    }
  }

  // Static methods
  const staticMethods = cls.staticMethods || [];
  if (staticMethods.length > 0) {
    const shown = verbose ? staticMethods : staticMethods.slice(0, 10);
    lines.push("");
    lines.push(`### Static Methods (${staticMethods.length})`);
    for (const m of shown) {
      const desc = m.description ? ` -- ${m.description}` : "";
      lines.push(`- ${m.signature}${desc}`);
    }
    if (!verbose && staticMethods.length > 10) {
      lines.push(`  ... and ${staticMethods.length - 10} more`);
    }
  }

  // Public methods
  if (cls.methods.length > 0) {
    const shown = verbose ? cls.methods : cls.methods.slice(0, 10);
    lines.push("");
    lines.push(`### Public Methods (${cls.methods.length})`);
    for (const m of shown) {
      const desc = m.description ? ` -- ${m.description}` : "";
      lines.push(`- ${m.signature}${desc}`);
    }
    if (!verbose && cls.methods.length > 10) {
      lines.push(`  ... and ${cls.methods.length - 10} more`);
    }
  }

  if (verbose && cls.protectedMethods.length > 0) {
    lines.push("");
    lines.push(`### Protected Methods (${cls.protectedMethods.length})`);
    for (const m of cls.protectedMethods) {
      const desc = m.description ? ` -- ${m.description}` : "";
      lines.push(`- ${m.signature}${desc}`);
    }
  }

  // Properties
  const properties = cls.properties || [];
  if (properties.length > 0) {
    const shown = verbose ? properties : properties.slice(0, 10);
    lines.push("");
    lines.push(`### Properties (${properties.length})`);
    for (const p of shown) {
      const desc = p.description ? ` -- ${p.description}` : "";
      lines.push(`- ${p.type} **${p.name}**${desc}`);
    }
    if (!verbose && properties.length > 10) {
      lines.push(`  ... and ${properties.length - 10} more`);
    }
  }

  if (verbose) {
    const protectedProps = cls.protectedProperties || [];
    if (protectedProps.length > 0) {
      lines.push("");
      lines.push(`### Protected Properties (${protectedProps.length})`);
      for (const p of protectedProps) {
        const desc = p.description ? ` -- ${p.description}` : "";
        lines.push(`- ${p.type} **${p.name}**${desc}`);
      }
    }
  }

  if (cls.sourceFile) {
    lines.push("");
    lines.push(`Source file: ${cls.sourceFile}`);
  }
  if (cls.docsUrl) {
    lines.push(`Docs: ${cls.docsUrl}`);
  }

  return lines.join("\n");
}

function formatMethodResult(results: MethodSearchResult[]): string {
  const lines: string[] = [];
  lines.push(`Found ${results.length} method match${results.length !== 1 ? "es" : ""}:\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. ${r.className}.${r.method.signature}`);
    if (r.method.description) {
      lines.push(`   ${r.method.description}`);
    }
    const sourceLabel = r.classSource === "enfusion" ? "Enfusion Engine" : "Arma Reforger";
    lines.push(`   Class: ${r.className} (${sourceLabel}${r.classGroup ? ` > ${r.classGroup}` : ""})`);
    lines.push("");
  }

  return lines.join("\n");
}

function formatEnumResult(results: EnumSearchResult[]): string {
  const lines: string[] = [];
  lines.push(`Found ${results.length} enum match${results.length !== 1 ? "es" : ""}:\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const sourceLabel = r.classSource === "enfusion" ? "Enfusion Engine" : "Arma Reforger";
    lines.push(`${i + 1}. **${r.enumInfo.name}** (in ${r.className})`);
    if (r.enumInfo.description) {
      lines.push(`   ${r.enumInfo.description}`);
    }
    lines.push(`   Source: ${sourceLabel}${r.classGroup ? ` > ${r.classGroup}` : ""}`);
    if (r.enumInfo.values.length > 0) {
      lines.push(`   Values:`);
      const shown = r.enumInfo.values.slice(0, 20);
      for (const v of shown) {
        const valStr = v.value ? ` = ${v.value}` : "";
        const valDesc = v.description ? ` -- ${v.description}` : "";
        lines.push(`   - ${v.name}${valStr}${valDesc}`);
      }
      if (r.enumInfo.values.length > 20) {
        lines.push(`   - ... and ${r.enumInfo.values.length - 20} more values`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatPropertyResult(results: PropertySearchResult[]): string {
  const lines: string[] = [];
  lines.push(`Found ${results.length} property match${results.length !== 1 ? "es" : ""}:\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const sourceLabel = r.classSource === "enfusion" ? "Enfusion Engine" : "Arma Reforger";
    lines.push(`${i + 1}. ${r.className}.${r.property.name} : ${r.property.type}`);
    if (r.property.description) {
      lines.push(`   ${r.property.description}`);
    }
    lines.push(`   Class: ${r.className} (${sourceLabel}${r.classGroup ? ` > ${r.classGroup}` : ""})`);
    lines.push("");
  }

  return lines.join("\n");
}

export function registerApiSearch(server: McpServer, searchEngine: SearchEngine): void {
  server.registerTool(
    "api_search",
    {
      description:
        "Search the Enfusion / Arma Reforger script API by class name, method name, or keyword. Use this to look up classes, methods, inheritance, and component types.",
      inputSchema: {
        query: z
          .string()
          .describe("Class name, method name, or keyword to search for"),
        type: z
          .enum(["class", "method", "enum", "property", "any"])
          .default("any")
          .describe("Narrow search to classes, methods, enums, or properties"),
        source: z
          .enum(["enfusion", "arma", "all"])
          .default("all")
          .describe("Search enfusion engine API, arma reforger API, or both"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum results to return"),
      },
    },
    async ({ query, type, source, limit }) => {
      let text: string;

      if (type === "class") {
        const results = searchEngine.searchClasses(query, source, limit);
        if (results.length === 0) {
          text = `No classes found matching "${query}".`;
        } else if (results.length === 1) {
          text = formatClassResult(results[0], true);
        } else {
          text = results.map((cls) => formatClassResult(cls, false)).join("\n\n---\n\n");
        }
      } else if (type === "method") {
        const results = searchEngine.searchMethods(query, source, limit);
        if (results.length === 0) {
          text = `No methods found matching "${query}".`;
        } else {
          text = formatMethodResult(results);
        }
      } else if (type === "enum") {
        const results = searchEngine.searchEnums(query, source, limit);
        if (results.length === 0) {
          text = `No enums found matching "${query}".`;
        } else {
          text = formatEnumResult(results);
        }
      } else if (type === "property") {
        const results = searchEngine.searchProperties(query, source, limit);
        if (results.length === 0) {
          text = `No properties found matching "${query}".`;
        } else {
          text = formatPropertyResult(results);
        }
      } else {
        const results = searchEngine.searchAny(query, source, limit);
        if (results.length === 0) {
          text = `No results found for "${query}".`;
        } else {
          const parts: string[] = [];
          for (const r of results) {
            if (r.type === "class" && r.classInfo) {
              parts.push(formatClassResult(r.classInfo, results.length === 1));
            } else if (r.type === "method" && r.methodResult) {
              const mr = r.methodResult;
              const sourceLabel = mr.classSource === "enfusion" ? "Enfusion" : "Arma Reforger";
              parts.push(
                `**Method:** ${mr.className}.${mr.method.signature}\n${mr.method.description || ""}\n(${sourceLabel}${mr.classGroup ? ` > ${mr.classGroup}` : ""})`
              );
            } else if (r.type === "enum" && r.enumResult) {
              const er = r.enumResult;
              const sourceLabel = er.classSource === "enfusion" ? "Enfusion" : "Arma Reforger";
              const valList = er.enumInfo.values.slice(0, 5).map((v) => v.name).join(", ");
              const suffix = er.enumInfo.values.length > 5 ? ", ..." : "";
              parts.push(
                `**Enum:** ${er.className}.${er.enumInfo.name} { ${valList}${suffix} }\n${er.enumInfo.description || ""}\n(${sourceLabel}${er.classGroup ? ` > ${er.classGroup}` : ""})`
              );
            } else if (r.type === "property" && r.propertyResult) {
              const pr = r.propertyResult;
              const sourceLabel = pr.classSource === "enfusion" ? "Enfusion" : "Arma Reforger";
              parts.push(
                `**Property:** ${pr.className}.${pr.property.name} : ${pr.property.type}\n${pr.property.description || ""}\n(${sourceLabel}${pr.classGroup ? ` > ${pr.classGroup}` : ""})`
              );
            }
          }
          text = parts.join("\n\n---\n\n");
        }
      }

      return { content: [{ type: "text", text }] };
    }
  );
}
