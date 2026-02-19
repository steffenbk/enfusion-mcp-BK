import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import type { Config } from "../config.js";
import type { SearchEngine } from "../index/search-engine.js";
import { parse, getProperty } from "../formats/enfusion-text.js";

interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
}

type CheckName = "structure" | "gproj" | "scripts" | "prefabs" | "configs" | "references" | "naming";

const ALL_CHECKS: CheckName[] = ["structure", "gproj", "scripts", "prefabs", "configs", "references", "naming"];

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const walk = (current: string) => {
    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (extname(entry.name).toLowerCase() === ext) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  };
  walk(dir);
  return results;
}

function checkStructure(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for .gproj file
  const gprojFiles = readdirSync(projectPath).filter(
    (f) => extname(f).toLowerCase() === ".gproj"
  );
  if (gprojFiles.length === 0) {
    issues.push({ level: "error", message: "No .gproj file found in project root" });
  } else if (gprojFiles.length > 1) {
    issues.push({ level: "warning", message: `Multiple .gproj files found: ${gprojFiles.join(", ")}` });
  }

  // Check standard directories
  const expectedDirs = ["Scripts/Game"];
  for (const dir of expectedDirs) {
    if (!existsSync(resolve(projectPath, dir))) {
      issues.push({ level: "warning", message: `Missing expected directory: ${dir}` });
    }
  }

  return issues;
}

function checkGproj(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const gprojFiles = readdirSync(projectPath).filter(
    (f) => extname(f).toLowerCase() === ".gproj"
  );
  if (gprojFiles.length === 0) return issues;

  for (const filename of gprojFiles) {
    const filepath = resolve(projectPath, filename);
    try {
      const content = readFileSync(filepath, "utf-8");
      const node = parse(content);

      if (node.type !== "GameProject") {
        issues.push({ level: "error", message: `${filename}: Root node is "${node.type}", expected "GameProject"` });
      }

      const id = getProperty(node, "ID");
      if (!id) {
        issues.push({ level: "error", message: `${filename}: Missing ID field` });
      }

      const guid = getProperty(node, "GUID");
      if (!guid) {
        issues.push({ level: "error", message: `${filename}: Missing GUID field` });
      } else if (typeof guid === "string" && !/^[0-9A-Fa-f]{16}$/.test(guid)) {
        issues.push({ level: "warning", message: `${filename}: GUID "${guid}" is not a valid 16-char hex string` });
      }

      const deps = node.children.find((c) => c.type === "Dependencies");
      if (!deps) {
        issues.push({ level: "error", message: `${filename}: Missing Dependencies block — mod won't load` });
      } else if (!deps.values.includes("58D0FB3206B6F859")) {
        issues.push({ level: "error", message: `${filename}: Missing base game dependency (58D0FB3206B6F859)` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push({ level: "error", message: `${filename}: Failed to parse — ${msg}` });
    }
  }

  return issues;
}

function checkScripts(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Find all .c files in the project
  const allScripts = findFiles(projectPath, ".c");

  for (const scriptPath of allScripts) {
    const rel = relative(projectPath, scriptPath).replace(/\\/g, "/");

    // Check if script is in a valid module folder
    if (!rel.startsWith("Scripts/Game/") && !rel.startsWith("Scripts/GameLib/") && !rel.startsWith("Scripts/WorkbenchGame/")) {
      issues.push({
        level: "error",
        message: `${rel}: Script is outside a valid module folder (Scripts/Game/, Scripts/GameLib/, Scripts/WorkbenchGame/) — it will be silently ignored`,
      });
      continue;
    }

    // Basic syntax check: look for class declaration
    try {
      const content = readFileSync(scriptPath, "utf-8");
      const hasClass = /\b(class|modded\s+class)\s+\w+/.test(content);
      if (!hasClass) {
        issues.push({
          level: "warning",
          message: `${rel}: No class declaration found`,
        });
      }
    } catch {
      issues.push({
        level: "warning",
        message: `${rel}: Could not read file`,
      });
    }
  }

  return issues;
}

function checkPrefabs(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const allPrefabs = findFiles(projectPath, ".et");

  for (const prefabPath of allPrefabs) {
    const rel = relative(projectPath, prefabPath).replace(/\\/g, "/");

    try {
      const content = readFileSync(prefabPath, "utf-8");
      parse(content); // Just verify it parses
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push({
        level: "error",
        message: `${rel}: Invalid prefab format — ${msg}`,
      });
    }
  }

  return issues;
}

function checkConfigs(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allConfigs = findFiles(projectPath, ".conf");

  for (const configPath of allConfigs) {
    const rel = relative(projectPath, configPath).replace(/\\/g, "/");
    try {
      const content = readFileSync(configPath, "utf-8");
      parse(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      issues.push({
        level: "error",
        message: `${rel}: Invalid config format — ${msg}`,
      });
    }
  }

  return issues;
}

function checkReferences(projectPath: string, searchEngine: SearchEngine): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const allScripts = findFiles(projectPath, ".c");

  for (const scriptPath of allScripts) {
    const rel = relative(projectPath, scriptPath).replace(/\\/g, "/");

    try {
      const content = readFileSync(scriptPath, "utf-8");

      // Extract parent class from class declarations
      const classMatch = content.match(/(?:modded\s+)?class\s+\w+\s*:\s*(\w+)/);
      if (classMatch) {
        const parentClass = classMatch[1];
        if (!searchEngine.hasClass(parentClass)) {
          issues.push({
            level: "warning",
            message: `${rel}: Extends "${parentClass}" which is not in the API index (may be from another mod)`,
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return issues;
}

function checkNaming(projectPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const allScripts = findFiles(projectPath, ".c");
  const prefixes: Map<string, number> = new Map();

  for (const scriptPath of allScripts) {
    try {
      const content = readFileSync(scriptPath, "utf-8");
      const classMatch = content.match(/(?:modded\s+)?class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        // Extract prefix (part before first underscore)
        const prefixMatch = className.match(/^([A-Z]+)_/);
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
        }
      }
    } catch {
      // Skip
    }
  }

  // Find the most common prefix
  if (prefixes.size > 1) {
    let maxPrefix = "";
    let maxCount = 0;
    for (const [prefix, count] of prefixes) {
      if (count > maxCount) {
        maxPrefix = prefix;
        maxCount = count;
      }
    }

    for (const [prefix, count] of prefixes) {
      if (prefix !== maxPrefix) {
        issues.push({
          level: "info",
          message: `${count} class(es) use prefix "${prefix}_" instead of the most common prefix "${maxPrefix}_"`,
        });
      }
    }
  }

  return issues;
}

export function registerModValidate(
  server: McpServer,
  config: Config,
  searchEngine: SearchEngine
): void {
  server.registerTool(
    "mod_validate",
    {
      description:
        "Validate an Arma Reforger addon without building. Checks directory structure, .gproj format, script locations, prefab format, class references, and naming conventions.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Addon root directory. Uses configured default if omitted."),
        checks: z
          .array(z.enum(["structure", "gproj", "scripts", "prefabs", "configs", "references", "naming"]))
          .optional()
          .describe("Specific checks to run. Runs all checks if omitted."),
      },
    },
    async ({ projectPath, checks }) => {
      const basePath = projectPath || config.projectPath;

      if (!basePath) {
        return {
          content: [
            {
              type: "text",
              text: "No project path configured. Set ENFUSION_PROJECT_PATH environment variable or provide projectPath parameter.",
            },
          ],
        };
      }

      if (!existsSync(basePath)) {
        return {
          content: [
            { type: "text", text: `Project directory not found: ${basePath}` },
          ],
        };
      }

      const enabledChecks = (checks as CheckName[] | undefined) ?? ALL_CHECKS;
      const allIssues: ValidationIssue[] = [];

      const checkMap: Record<CheckName, () => ValidationIssue[]> = {
        structure: () => checkStructure(basePath),
        gproj: () => checkGproj(basePath),
        scripts: () => checkScripts(basePath),
        prefabs: () => checkPrefabs(basePath),
        configs: () => checkConfigs(basePath),
        references: () => checkReferences(basePath, searchEngine),
        naming: () => checkNaming(basePath),
      };

      const passedChecks: string[] = [];

      for (const check of enabledChecks) {
        const issues = checkMap[check]();
        if (issues.length === 0) {
          passedChecks.push(check);
        }
        allIssues.push(...issues);
      }

      // Format report
      const errors = allIssues.filter((i) => i.level === "error");
      const warnings = allIssues.filter((i) => i.level === "warning");
      const infos = allIssues.filter((i) => i.level === "info");

      const lines: string[] = [];
      const dirName = basePath.split(/[\\/]/).pop() || basePath;
      lines.push(`## Validation Report: ${dirName}`);
      lines.push("");

      if (errors.length > 0) {
        lines.push(`### Errors (${errors.length})`);
        for (const e of errors) lines.push(`- ${e.message}`);
        lines.push("");
      }

      if (warnings.length > 0) {
        lines.push(`### Warnings (${warnings.length})`);
        for (const w of warnings) lines.push(`- ${w.message}`);
        lines.push("");
      }

      if (infos.length > 0) {
        lines.push(`### Info (${infos.length})`);
        for (const i of infos) lines.push(`- ${i.message}`);
        lines.push("");
      }

      if (passedChecks.length > 0) {
        lines.push(`### Passed (${passedChecks.length})`);
        for (const c of passedChecks) lines.push(`- ${c}`);
        lines.push("");
      }

      if (errors.length === 0 && warnings.length === 0) {
        lines.push("All checks passed!");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
