import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findEngineBlock } from "./et-engine-block.js";

export const VEHICLES_SUBPATH = "Prefabs/Vehicles";

/** Recursively collect addon-relative posix paths of every .et under a directory. */
function collectEtFiles(absDir: string, relPrefix: string, out: string[]): void {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      collectEtFiles(abs, rel, out);
    } else if (entry.isFile() && entry.name.endsWith(".et")) {
      out.push(rel);
    }
  }
}

/**
 * Addon-relative paths of vehicle prefabs that already contain an Engine block.
 * Vehicles without one are omitted: this tool never creates the block structure.
 */
export function listTunableVehicles(addonPath: string): string[] {
  const base = join(addonPath, ...VEHICLES_SUBPATH.split("/"));
  if (!existsSync(base) || !statSync(base).isDirectory()) return [];

  const candidates: string[] = [];
  collectEtFiles(base, VEHICLES_SUBPATH, candidates);

  return candidates
    .filter((rel) => {
      try {
        return findEngineBlock(readFileSync(join(addonPath, ...rel.split("/")), "utf-8")) !== null;
      } catch {
        return false;
      }
    })
    .sort();
}

export function vehicleEtPath(addonPath: string, relPath: string): string {
  return join(addonPath, ...relPath.split("/"));
}

/**
 * Guard for URL-supplied vehicle paths. These legitimately contain "/", so the
 * v1 filename guard does not apply; instead pin the prefix and suffix and reject
 * anything that could escape the addon's vehicles directory.
 */
export function isSafeVehicleRelPath(relPath: string): boolean {
  if (relPath.includes("\\")) return false;
  if (relPath.includes("..")) return false;
  if (relPath.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(relPath)) return false;
  if (!relPath.startsWith(`${VEHICLES_SUBPATH}/`)) return false;
  return relPath.endsWith(".et");
}
