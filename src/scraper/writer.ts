import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { logger } from "../utils/logger.js";
import type {
  ClassInfo,
  GroupInfo,
  HierarchyNode,
  WikiPage,
} from "../index/types.js";

export interface ScrapeOutput {
  enfusionClasses: ClassInfo[];
  armaClasses: ClassInfo[];
  hierarchy: HierarchyNode[];
  groups: GroupInfo[];
  wikiPages: WikiPage[];
}

function writeJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  logger.info(`Wrote ${filePath}`);
}

export function writeOutput(dataDir: string, output: ScrapeOutput): void {
  const apiDir = resolve(dataDir, "api");
  const wikiDir = resolve(dataDir, "wiki");

  writeJson(
    resolve(apiDir, "enfusion-classes.json"),
    output.enfusionClasses
  );
  writeJson(
    resolve(apiDir, "arma-classes.json"),
    output.armaClasses
  );
  writeJson(resolve(apiDir, "hierarchy.json"), output.hierarchy);
  writeJson(resolve(apiDir, "groups.json"), output.groups);
  // Merge wiki pages: preserve existing BI wiki pages, replace only Doxygen-sourced pages
  const pagesPath = resolve(wikiDir, "pages.json");
  let existingPages: WikiPage[] = [];
  if (existsSync(pagesPath)) {
    try {
      existingPages = JSON.parse(readFileSync(pagesPath, "utf-8")) as WikiPage[];
    } catch {
      // Corrupted file — will be overwritten
    }
  }
  // Keep pages from sources NOT in the current scrape output
  const scrapedSources = new Set(output.wikiPages.map((p) => p.source));
  const preservedPages = existingPages.filter((p) => !scrapedSources.has(p.source));
  const mergedPages = [...preservedPages, ...output.wikiPages];
  writeJson(pagesPath, mergedPages);

  logger.info(
    `Scrape complete: ${output.enfusionClasses.length} enfusion classes, ${output.armaClasses.length} arma classes, ${output.hierarchy.length} hierarchy nodes, ${output.groups.length} groups, ${mergedPages.length} wiki pages (${output.wikiPages.length} from Doxygen + ${preservedPages.length} preserved)`
  );
}
