import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";
import { PakVirtualFS } from "../pak/vfs.js";

// ── Parser helpers ────────────────────────────────────────────────────────────

/**
 * Extract all named top-level blocks of a given type from Enfusion text format.
 * Matches: "TypeName Name {" or "TypeName Name{" (handles optional whitespace).
 * Handles nested braces to correctly determine block boundaries.
 */
function extractBlocks(
  text: string,
  typeName: string
): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  // Match the opening line: TypeName followed by optional quoted or unquoted name, then "{"
  const openRe = new RegExp(
    `^[ \\t]*${escapeRegExp(typeName)}[ \\t]+"?([^"\\s{][^{]*?)"?[ \\t]*\\{[ \\t]*$`,
    "gm"
  );

  let match: RegExpExecArray | null;
  while ((match = openRe.exec(text)) !== null) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const openBrace = text.indexOf("{", match.index + match[0].indexOf("{"));
    // Walk forward counting braces to find the matching closing brace
    let depth = 1;
    let i = openBrace + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const body = text.slice(openBrace + 1, i - 1);
    results.push({ name, body });
  }
  return results;
}

/**
 * Extract a simple scalar property value from a block body.
 * Matches: "  PropName value" or "  PropName \"value\""
 * Returns the unquoted value, or null if not found.
 */
function extractProp(body: string, propName: string): string | null {
  const re = new RegExp(
    `^[ \\t]*${escapeRegExp(propName)}[ \\t]+"?([^"\\n\\r]+?)"?[ \\t]*$`,
    "m"
  );
  const m = body.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^"|"$/g, "");
}

/**
 * Extract a string array block of the form:
 *   PropName {
 *     "item1"
 *     "item2"
 *   }
 * Returns array of unquoted string values.
 */
function extractStringArray(body: string, propName: string): string[] {
  // Find the block start
  const startRe = new RegExp(
    `^[ \\t]*${escapeRegExp(propName)}[ \\t]*\\{`,
    "m"
  );
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) return [];

  const openPos = body.indexOf("{", startMatch.index + startMatch[0].lastIndexOf("{") - 1);
  // Find matching closing brace
  let depth = 1;
  let i = openPos + 1;
  while (i < body.length && depth > 0) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") depth--;
    i++;
  }
  const inner = body.slice(openPos + 1, i - 1);
  // Extract quoted strings
  const items: string[] = [];
  const itemRe = /"([^"\\n\\r]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(inner)) !== null) {
    items.push(m[1]);
  }
  return items;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── AGR parser ────────────────────────────────────────────────────────────────

/**
 * Parse an AGR (Animation Graph Resource) file and return a structured summary.
 */
function parseAgr(content: string): string {
  const lines: string[] = [];

  lines.push("=== AGR Summary ===\n");

  // Variables — Float, Int, Bool
  const varTypes: Record<string, string> = {
    AnimSrcGCTVarFloat: "Float",
    AnimSrcGCTVarInt: "Int",
    AnimSrcGCTVarBool: "Bool",
  };

  const varsByType: Record<string, string[]> = { Float: [], Int: [], Bool: [] };

  for (const [typeName, label] of Object.entries(varTypes)) {
    const blocks = extractBlocks(content, typeName);
    for (const { name, body } of blocks) {
      const min = extractProp(body, "Min") ?? "?";
      const max = extractProp(body, "Max") ?? "?";
      const def = extractProp(body, "Default") ?? extractProp(body, "DefaultValue") ?? "?";
      varsByType[label].push(`  ${name} (${label}) [${min}..${max}] default=${def}`);
    }
  }

  const totalVars =
    varsByType.Float.length + varsByType.Int.length + varsByType.Bool.length;
  lines.push(`Variables (${totalVars}):`);
  for (const label of ["Float", "Int", "Bool"]) {
    if (varsByType[label].length > 0) {
      lines.push(`  -- ${label} --`);
      for (const v of varsByType[label]) lines.push(v);
    }
  }
  if (totalVars === 0) lines.push("  (none)");
  lines.push("");

  // Commands
  const cmdBlocks = extractBlocks(content, "AnimSrcGCTCmd");
  lines.push(`Commands (${cmdBlocks.length}):`);
  if (cmdBlocks.length > 0) {
    for (const { name } of cmdBlocks) lines.push(`  ${name}`);
  } else {
    lines.push("  (none)");
  }
  lines.push("");

  // IK Chains
  const ikBlocks = extractBlocks(content, "AnimSrcGCTIkChain");
  lines.push(`IK Chains (${ikBlocks.length}):`);
  if (ikBlocks.length > 0) {
    for (const { name, body } of ikBlocks) {
      const jointCount = extractProp(body, "JointCount") ?? "?";
      const midJoint = extractProp(body, "MiddleJoint");
      const chainAxis = extractProp(body, "ChainAxis");
      let detail = `  ${name} — joints: ${jointCount}`;
      if (midJoint) detail += `, MiddleJoint: ${midJoint}`;
      if (chainAxis) detail += `, ChainAxis: ${chainAxis}`;
      lines.push(detail);
    }
  } else {
    lines.push("  (none)");
  }
  lines.push("");

  // Bone Masks
  const maskBlocks = extractBlocks(content, "AnimSrcGCTBoneMask");
  lines.push(`Bone Masks (${maskBlocks.length}):`);
  if (maskBlocks.length > 0) {
    for (const { name, body } of maskBlocks) {
      const bones = extractStringArray(body, "BoneNames");
      const boneCount = bones.length;
      lines.push(`  ${name} — ${boneCount} bone(s)`);
    }
  } else {
    lines.push("  (none)");
  }
  lines.push("");

  // GlobalTags
  const globalTags = extractStringArray(content, "GlobalTags");
  lines.push(`GlobalTags (${globalTags.length}):`);
  if (globalTags.length > 0) {
    for (const t of globalTags) lines.push(`  ${t}`);
  } else {
    lines.push("  (none)");
  }
  lines.push("");

  // DefaultRunNode
  const defaultRunNode = extractProp(content, "DefaultRunNode");
  lines.push(`DefaultRunNode: ${defaultRunNode ?? "(not set)"}`);
  lines.push("");

  // AGF References
  const agfRefs = extractStringArray(content, "GraphFilesResourceNames");
  lines.push(`AGF References (${agfRefs.length}):`);
  if (agfRefs.length > 0) {
    for (const ref of agfRefs) lines.push(`  ${ref}`);
  } else {
    lines.push("  (none)");
  }

  return lines.join("\n");
}

// ── AGF parser ────────────────────────────────────────────────────────────────

/**
 * Parse an AGF (Animation Graph File) and return a structured summary.
 */
function parseAgf(content: string): string {
  const lines: string[] = [];

  lines.push("=== AGF Summary ===\n");

  const sheetBlocks = extractBlocks(content, "AnimSrcGraphSheet");
  lines.push(`Sheets (${sheetBlocks.length}):`);

  if (sheetBlocks.length === 0) {
    lines.push("  (none)");
  }

  for (const { name: sheetName, body: sheetBody } of sheetBlocks) {
    lines.push(`\n  Sheet: ${sheetName}`);

    // Find all AnimSrcNode* type blocks within this sheet body
    // The type names all start with "AnimSrcNode"
    const nodeRe =
      /^[ \t]*(AnimSrcNode\S+)[ \t]+"?([^"\n\r{][^{\n\r]*?)"?[ \t]*\{/gm;
    let nodeMatch: RegExpExecArray | null;
    let nodeCount = 0;
    while ((nodeMatch = nodeRe.exec(sheetBody)) !== null) {
      nodeCount++;
      const nodeType = nodeMatch[1];
      const nodeName = nodeMatch[2].trim().replace(/^"|"$/g, "");

      // Find body of this node to look for Child reference
      const openPos = sheetBody.indexOf(
        "{",
        nodeMatch.index + nodeMatch[0].lastIndexOf("{") - 1
      );
      let depth = 1;
      let i = openPos + 1;
      while (i < sheetBody.length && depth > 0) {
        if (sheetBody[i] === "{") depth++;
        else if (sheetBody[i] === "}") depth--;
        i++;
      }
      const nodeBody = sheetBody.slice(openPos + 1, i - 1);
      const child = extractProp(nodeBody, "Child");

      let entry = `    [${nodeType}] ${nodeName}`;
      if (child) entry += ` -> Child: ${child}`;
      lines.push(entry);
    }

    if (nodeCount === 0) {
      lines.push("    (no nodes found)");
    }
  }

  return lines.join("\n");
}

// ── AST parser ────────────────────────────────────────────────────────────────

/**
 * Parse an AST (Animation Set Template) file and return a structured summary.
 */
function parseAst(content: string): string {
  const lines: string[] = [];

  lines.push("=== AST Summary ===\n");

  const groupBlocks = extractBlocks(
    content,
    "AnimSetTemplateSource_AnimationGroup"
  );

  lines.push(`Animation Groups (${groupBlocks.length}):`);

  if (groupBlocks.length === 0) {
    lines.push("  (none)");
  }

  for (const { name: groupName, body } of groupBlocks) {
    const animNames = extractStringArray(body, "AnimationNames");
    const columnNames = extractStringArray(body, "ColumnNames");

    lines.push(`\n  Group: ${groupName}`);
    lines.push(
      `    Animations (${animNames.length}): ${
        animNames.length > 0 ? animNames.join(", ") : "(none)"
      }`
    );
    lines.push(
      `    Columns (${columnNames.length}): ${
        columnNames.length > 0 ? columnNames.join(", ") : "(none)"
      }`
    );
  }

  return lines.join("\n");
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerAnimationGraphInspect(
  server: McpServer,
  config: Config
): void {
  server.registerTool(
    "animation_graph_inspect",
    {
      description:
        "Read and summarize an Arma Reforger animation graph file (.agr, .agf, or .ast). " +
        "Returns structured info: variables with ranges, IK chains, bone masks, commands, node types. " +
        "Use to audit an existing vehicle animation graph before modifying it. " +
        "Trigger phrases: 'what variables does X use', 'inspect animation graph', 'read AGR/AGF/AST', " +
        "'what nodes are in the graph', 'what IK chains does this vehicle have'.",
      inputSchema: {
        path: z.string().describe(
          "File path to .agr, .agf, or .ast. Relative to mod project (source=mod) or game data root (source=game). " +
            "Example: 'Assets/Vehicles/MyTruck/workspaces/MyTruck.agr'"
        ),
        source: z
          .enum(["mod", "game"])
          .default("mod")
          .describe(
            "Read from the mod project directory (mod) or base game data (game)."
          ),
        projectPath: z
          .string()
          .optional()
          .describe(
            "Mod project root path. Uses ENFUSION_PROJECT_PATH default if omitted."
          ),
      },
    },
    async ({ path: filePath, source, projectPath }) => {
      const ext = extname(filePath).toLowerCase();
      if (![".agr", ".agf", ".ast"].includes(ext)) {
        return {
          content: [
            {
              type: "text",
              text: `Unsupported file type: ${ext}. Supported: .agr, .agf, .ast`,
            },
          ],
        };
      }

      let content: string;

      try {
        if (source === "mod") {
          const basePath = projectPath || config.projectPath;
          if (!basePath) {
            return {
              content: [
                {
                  type: "text",
                  text: "No project path configured. Set ENFUSION_PROJECT_PATH or provide projectPath.",
                },
              ],
            };
          }
          const fullPath = validateProjectPath(basePath, filePath);
          if (!existsSync(fullPath)) {
            return {
              content: [{ type: "text", text: `File not found: ${filePath}` }],
            };
          }
          content = readFileSync(fullPath, "utf-8");
        } else {
          // source === "game" — try loose files then pak
          const dataPath = join(config.gamePath, "addons", "data");
          const loosePath = resolve(dataPath, filePath);
          if (existsSync(loosePath)) {
            content = readFileSync(loosePath, "utf-8");
          } else {
            const pakVfs = PakVirtualFS.get(config.gamePath);
            if (pakVfs && pakVfs.exists(filePath)) {
              const buf = pakVfs.readFile(filePath);
              content = buf.toString("utf-8");
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: `File not found in game data: ${filePath}`,
                  },
                ],
              };
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [
            { type: "text", text: `Error reading file: ${msg}` },
          ],
        };
      }

      let summary: string;
      if (ext === ".agr") summary = parseAgr(content);
      else if (ext === ".agf") summary = parseAgf(content);
      else summary = parseAst(content);

      return { content: [{ type: "text", text: summary }] };
    }
  );
}
