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

export interface DiscoveredVehicle {
  /** Addon-relative posix path, e.g. "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et". */
  path: string;
  /**
   * Whether the prefab already overrides Engine. False is normal — a clean prefab
   * inherits everything — but Apply cannot write until the block exists.
   */
  hasEngineBlock: boolean;
}

/**
 * Every vehicle prefab under Prefabs/Vehicles, sorted by path.
 *
 * All .et files are listed, not just the ones carrying an Engine override: a
 * prefab that inherits its engine is still worth opening, because the resolver
 * can show the inherited baseline. `hasEngineBlock` tells the caller which ones
 * are writable as-is.
 */
export function listVehicles(addonPath: string): DiscoveredVehicle[] {
  const base = join(addonPath, ...VEHICLES_SUBPATH.split("/"));
  if (!existsSync(base) || !statSync(base).isDirectory()) return [];

  const candidates: string[] = [];
  collectEtFiles(base, VEHICLES_SUBPATH, candidates);

  return candidates.sort().map((rel) => {
    let hasEngineBlock = false;
    try {
      hasEngineBlock =
        findEngineBlock(readFileSync(join(addonPath, ...rel.split("/")), "utf-8")) !== null;
    } catch {
      hasEngineBlock = false;
    }
    return { path: rel, hasEngineBlock };
  });
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
