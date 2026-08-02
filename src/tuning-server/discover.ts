import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ENGINE_CONF_SUBPATH = "Prefabs/Vehicles/Core/Configs/Engines";

export function listEngineConfFiles(addonPath: string): string[] {
  const dir = join(addonPath, ...ENGINE_CONF_SUBPATH.split("/"));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".conf"))
    .sort();
}

export function engineConfPath(addonPath: string, file: string): string {
  return join(addonPath, ...ENGINE_CONF_SUBPATH.split("/"), file);
}
