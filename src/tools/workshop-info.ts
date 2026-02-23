import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import { parse, type EnfusionNode } from "../formats/enfusion-text.js";

export function registerWorkshopInfo(server: McpServer, config: Config): void {
  server.registerTool(
    "workshop_info",
    {
      description:
        "Read Workshop metadata from a mod's .gproj file. Shows mod ID, GUID, title, " +
        "dependencies, and configurations. Useful for checking publish state before releasing.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe(
            "Absolute path to the mod directory (containing the .gproj). Uses configured default if omitted."
          ),
        modName: z
          .string()
          .optional()
          .describe(
            "Mod/addon name to look up. Used to find the .gproj if projectPath points to the addons directory."
          ),
      },
    },
    async ({ projectPath, modName }) => {
      try {
        const basePath = projectPath || config.projectPath;
        let gprojPath: string | null = null;

        if (modName) {
          gprojPath = resolve(basePath, modName, `${modName}.gproj`);
        } else {
          const candidates = findGprojFiles(basePath);
          gprojPath = candidates[0] || null;
        }

        if (!gprojPath || !existsSync(gprojPath)) {
          return {
            content: [
              {
                type: "text",
                text: `No .gproj found. ${gprojPath ? `Checked: ${gprojPath}` : "Provide projectPath or modName."}`,
              },
            ],
          };
        }

        const raw = readFileSync(gprojPath, "utf-8");
        const root = parse(raw);

        const id = getProperty(root, "ID") || "(unknown)";
        const guid = getProperty(root, "GUID") || "(unknown)";
        const title = getProperty(root, "TITLE") || id;

        // Extract dependencies
        const deps: string[] = [];
        const depNode = findChild(root, "Dependencies");
        if (depNode) {
          for (const val of depNode.values) {
            deps.push(String(val));
          }
        }

        // Extract configurations
        const configs: string[] = [];
        const configsNode = findChild(root, "Configurations");
        if (configsNode) {
          for (const child of configsNode.children) {
            const name = child.id || getProperty(child, "name") || child.type;
            if (name) configs.push(name);
          }
        }

        const lines: string[] = [];
        lines.push("**Workshop Info**\n");
        lines.push(`- **ID:** ${id}`);
        lines.push(`- **GUID:** ${guid}`);
        lines.push(`- **Title:** ${title}`);
        lines.push(`- **File:** ${gprojPath}`);

        if (deps.length > 0) {
          lines.push(`\n### Dependencies (${deps.length})`);
          for (const dep of deps) {
            const label = dep === "58D0FB3206B6F859" ? " (Arma Reforger)" : "";
            lines.push(`- ${dep}${label}`);
          }
        }

        if (configs.length > 0) {
          lines.push(`\n### Configurations`);
          for (const cfg of configs) {
            lines.push(`- ${cfg}`);
          }
        }

        lines.push("\n### Publishing");
        lines.push(
          "To publish this mod to the Steam Workshop:\n" +
          "1. Open the mod in Workbench (wb_launch with the .gproj path)\n" +
          "2. Go to **File > Addon Publishing**\n" +
          "3. Fill in the Workshop details (description, tags, preview image)\n" +
          "4. Click **Publish**\n\n" +
          "Note: First-time publishing requires Steam Workshop agreement acceptance."
        );

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error reading workshop info: ${msg}` }],
        };
      }
    }
  );
}

function findGprojFiles(dirPath: string): string[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() && entry.name.endsWith(".gproj")) {
        results.push(join(dirPath, entry.name));
      }
    }
    return results;
  } catch {
    return [];
  }
}

function getProperty(node: EnfusionNode, key: string): string {
  for (const prop of node.properties) {
    if (prop.key === key) return String(prop.value ?? "");
  }
  return "";
}

function findChild(node: EnfusionNode, type: string): EnfusionNode | null {
  return node.children.find((c) => c.type === type) || null;
}
