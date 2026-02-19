import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { logger } from "../utils/logger.js";

export interface PatternScript {
  className: string;
  scriptType: string;
  parentClass: string;
  methods: string[];
  description: string;
}

export interface PatternPrefab {
  name: string;
  prefabType: string;
  parentPrefab: string;
  components: Array<{ type: string; properties?: Record<string, string> }>;
  description: string;
}

export interface PatternConfig {
  name: string;
  content: string;
}

export interface ModPattern {
  name: string;
  description: string;
  tags: string[];
  scripts: PatternScript[];
  prefabs: PatternPrefab[];
  configs: PatternConfig[];
  instructions: string;
}

export class PatternLibrary {
  private patterns: Map<string, ModPattern> = new Map();

  constructor(patternsDir: string) {
    this.load(patternsDir);
  }

  private load(dir: string): void {
    if (!existsSync(dir)) {
      logger.debug(`Patterns directory not found: ${dir}`);
      return;
    }

    try {
      const files = readdirSync(dir).filter((f) => extname(f) === ".json");
      for (const file of files) {
        try {
          const raw = readFileSync(join(dir, file), "utf-8");
          const pattern = JSON.parse(raw) as ModPattern;
          const key = basename(file, ".json");
          this.patterns.set(key, pattern);
        } catch (e) {
          logger.warn(`Failed to load pattern ${file}: ${e}`);
        }
      }
      logger.debug(`Loaded ${this.patterns.size} mod patterns`);
    } catch (e) {
      logger.warn(`Failed to read patterns directory: ${e}`);
    }
  }

  get(name: string): ModPattern | undefined {
    return this.patterns.get(name);
  }

  list(): string[] {
    return [...this.patterns.keys()];
  }

  getAll(): ModPattern[] {
    return [...this.patterns.values()];
  }

  /** Get a summary of all patterns for tool descriptions */
  getSummary(): string {
    if (this.patterns.size === 0) return "No patterns loaded.";
    const lines: string[] = [];
    for (const [key, pattern] of this.patterns) {
      lines.push(`- **${key}**: ${pattern.description}`);
    }
    return lines.join("\n");
  }
}
