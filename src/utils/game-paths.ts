import { readdirSync, existsSync } from "node:fs";
import { resolve, join, sep } from "node:path";

/**
 * Resolve the game data directory (loose/extracted files).
 * Tries gamePath/addons/data first (standard Steam install), then gamePath/addons.
 */
export function resolveGameDataPath(gamePath: string): string | null {
  const dataPath = join(gamePath, "addons", "data");
  if (existsSync(dataPath)) return dataPath;
  const addonsPath = join(gamePath, "addons");
  if (existsSync(addonsPath)) return addonsPath;
  return null;
}

/**
 * Find a loose file in the game data directory.
 * Handles paths with DataXXX prefix ("Data006/Prefabs/...") and bare paths ("Prefabs/...").
 */
export function findLooseFile(gameDataPath: string, relativePath: string): string | null {
  const direct = join(gameDataPath, relativePath);
  if (existsSync(direct)) return direct;

  if (!relativePath.startsWith("Data")) {
    try {
      const entries = readdirSync(gameDataPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("Data")) continue;
        const candidate = join(gameDataPath, entry.name, relativePath);
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Find the addon directory: by modName (folder name) or first addon with a .gproj. */
export function resolveAddonDir(projectPath: string, modName?: string): string | null {
  if (modName) {
    const base = resolve(projectPath);
    const dir = resolve(base, modName);
    // Prevent path traversal — modName must not escape projectPath
    if (dir !== base && !dir.startsWith(base + sep)) return null;
    return existsSync(dir) ? dir : null;
  }
  try {
    const entries = readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(projectPath, entry.name);
      if (findGproj(dir)) return dir;
    }
  } catch {
    // ignore
  }
  return null;
}

const WORKBENCH_EXE_NAME = "ArmaReforgerWorkbenchSteamDiag.exe";
const WORKBENCH_SUBDIR = "Workbench";

/**
 * Find the Workbench executable given the tools installation path.
 * Checks the Workbench subdirectory first (standard Steam layout),
 * then the root in case the config points directly to Workbench/.
 */
export function findWorkbenchExe(workbenchPath: string): string | null {
  const subPath = join(workbenchPath, WORKBENCH_SUBDIR, WORKBENCH_EXE_NAME);
  if (existsSync(subPath)) return subPath;

  const rootPath = join(workbenchPath, WORKBENCH_EXE_NAME);
  if (existsSync(rootPath)) return rootPath;

  return null;
}

/** Find the first .gproj file in a directory. */
export function findGproj(dir: string): string | null {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() && e.name.endsWith(".gproj")) {
        return join(dir, e.name);
      }
    }
  } catch {
    // ignore
  }
  return null;
}
