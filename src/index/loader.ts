import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../utils/logger.js";
import type { ClassInfo, GroupInfo, HierarchyNode, WikiPage } from "./types.js";

export interface IndexData {
  enfusionClasses: ClassInfo[];
  armaClasses: ClassInfo[];
  hierarchy: HierarchyNode[];
  groups: GroupInfo[];
  wikiPages: WikiPage[];
}

function loadJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    logger.warn(`Index file not found: ${filePath}`);
    return fallback;
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    logger.error(`Failed to parse index file ${filePath}: ${e}`);
    return fallback;
  }
}

export function loadIndex(dataDir: string): IndexData {
  const apiDir = resolve(dataDir, "api");
  const wikiDir = resolve(dataDir, "wiki");

  const data: IndexData = {
    enfusionClasses: loadJson<ClassInfo[]>(
      resolve(apiDir, "enfusion-classes.json"),
      []
    ),
    armaClasses: loadJson<ClassInfo[]>(
      resolve(apiDir, "arma-classes.json"),
      []
    ),
    hierarchy: loadJson<HierarchyNode[]>(
      resolve(apiDir, "hierarchy.json"),
      []
    ),
    groups: loadJson<GroupInfo[]>(resolve(apiDir, "groups.json"), []),
    wikiPages: loadJson<WikiPage[]>(resolve(wikiDir, "pages.json"), []),
  };

  const total = data.enfusionClasses.length + data.armaClasses.length;
  logger.info(
    `Loaded index: ${data.enfusionClasses.length} enfusion + ${data.armaClasses.length} arma classes (${total} total), ${data.groups.length} groups, ${data.wikiPages.length} wiki pages`
  );

  return data;
}
