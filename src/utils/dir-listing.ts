import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export const FILE_TYPE_MAP: Record<string, string> = {
  ".c": "script",
  ".et": "prefab",
  ".ct": "component",
  ".gproj": "project",
  ".conf": "config",
  ".meta": "meta",
  ".ent": "world",
  ".layer": "layer",
  ".st": "strings",
  ".edds": "texture",
  ".xob": "model",
  ".layout": "ui-layout",
  ".emat": "material",
  ".sounds": "sound",
};

export function getFileType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return FILE_TYPE_MAP[ext] || "";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  type: string;
}

export function listDirectory(dirPath: string, pattern?: string): DirEntry[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const results: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      results.push({ name: entry.name, isDirectory: true, size: 0, type: "" });
    } else {
      if (pattern) {
        const ext = extname(entry.name).toLowerCase();
        const patternExt = pattern.startsWith("*") ? pattern.slice(1) : pattern;
        if (ext !== patternExt.toLowerCase()) continue;
      }

      const fullPath = join(dirPath, entry.name);
      let size = 0;
      try {
        size = statSync(fullPath).size;
      } catch { /* skip */ }

      results.push({
        name: entry.name,
        isDirectory: false,
        size,
        type: getFileType(entry.name),
      });
    }
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}
