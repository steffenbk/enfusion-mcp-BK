import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../utils/logger.js";

export interface KbEntry {
  path: string;
  title: string;
  description: string;
  keywords: string[];
}

let cachedKbIndex: KbEntry[] | null = null;
let cachedKbDir: string | null = null;

function loadIndex(kbDir: string): KbEntry[] {
  if (cachedKbIndex && cachedKbDir === kbDir) return cachedKbIndex;

  const indexPath = resolve(kbDir, "index.json");
  if (!existsSync(indexPath)) {
    logger.warn(`KB index not found: ${indexPath}`);
    return [];
  }
  try {
    const raw = readFileSync(indexPath, "utf-8");
    cachedKbIndex = JSON.parse(raw) as KbEntry[];
    cachedKbDir = kbDir;
    return cachedKbIndex;
  } catch (e) {
    logger.error(`Failed to load KB index: ${e}`);
    return [];
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s\-_/.,;:!?()[\]{}]+/).filter(Boolean);
}

function scoreEntry(entry: KbEntry, tokens: string[]): number {
  let score = 0;
  const titleTokens = tokenize(entry.title);
  const descTokens = tokenize(entry.description);
  for (const token of tokens) {
    if (entry.keywords.includes(token)) score += 2;
    if (titleTokens.includes(token)) score += 1;
    if (descTokens.includes(token)) score += 1;
  }
  return score;
}

export function searchKb(
  kbDir: string,
  query: string,
  maxFiles: number
): { files: Array<{ title: string; content: string }>; usedIndex: boolean } {
  const index = loadIndex(kbDir);

  // Empty query or "index"/"list" → return index summary
  const q = query.trim().toLowerCase();
  if (!q || q === "index" || q === "list") {
    return { files: [], usedIndex: true };
  }

  const tokens = tokenize(query);
  const scored = index
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  if (scored.length === 0) {
    return { files: [], usedIndex: true };
  }

  const patternsDir = resolve(kbDir, "patterns");
  const files: Array<{ title: string; content: string }> = [];
  for (const { entry } of scored) {
    const filePath = resolve(patternsDir, entry.path);
    if (!existsSync(filePath)) {
      logger.warn(`KB file not found: ${filePath}`);
      continue;
    }
    try {
      const content = readFileSync(filePath, "utf-8");
      files.push({ title: entry.title, content });
    } catch (e) {
      logger.warn(`Failed to read KB file ${filePath}: ${e}`);
    }
  }

  return { files, usedIndex: false };
}

export function getIndexSummary(kbDir: string): string {
  const index = loadIndex(kbDir);
  if (index.length === 0) return "No KB entries found.";
  const lines = index.map((e) => `- **${e.title}**: ${e.description}`);
  return `# Arma Reforger KB — Available Topics\n\n${lines.join("\n")}`;
}
