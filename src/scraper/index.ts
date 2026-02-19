import { readHtmlFromZip, readFileFromZip } from "./source-local.js";
import {
  parseAnnotatedPage,
  parseClassPage,
  parseHierarchyPage,
  parseGroupPage,
  parseTutorialPage,
} from "./doxygen-parser.js";
import { writeOutput, type ScrapeOutput } from "./writer.js";
import { logger } from "../utils/logger.js";
import type { ClassInfo, GroupInfo, HierarchyNode, WikiPage } from "../index/types.js";

export interface ScrapeOptions {
  source: "local" | "remote";
  workbenchPath: string;
  dataDir: string;
}

function scrapeLocalSource(
  workbenchPath: string,
  source: "enfusion" | "arma"
): {
  classes: ClassInfo[];
  groups: GroupInfo[];
  hierarchy: HierarchyNode[];
  wikiPages: WikiPage[];
} {
  const classes: ClassInfo[] = [];
  const groups: GroupInfo[] = [];
  let hierarchy: HierarchyNode[] = [];
  const wikiPages: WikiPage[] = [];

  // 1. Parse annotated.html for the class list
  const annotatedHtml = readFileFromZip(workbenchPath, source, "annotated.html");
  if (!annotatedHtml) {
    logger.error(`Could not read annotated.html from ${source} zip`);
    return { classes, groups, hierarchy, wikiPages };
  }

  const classList = parseAnnotatedPage(annotatedHtml);
  logger.info(`Found ${classList.length} classes in ${source} annotated.html`);

  // 2. Parse hierarchy.html
  const hierarchyHtml = readFileFromZip(workbenchPath, source, "hierarchy.html");
  if (hierarchyHtml) {
    hierarchy = parseHierarchyPage(hierarchyHtml);
    logger.info(`Parsed ${hierarchy.length} hierarchy nodes from ${source}`);
  }

  // 3. Parse each class page
  let processed = 0;
  for (const entry of readHtmlFromZip(
    workbenchPath,
    source,
    /^interface[A-Z].*\.html$/
  )) {
    // Skip -members.html files
    if (entry.filename.includes("-members")) continue;

    try {
      const classInfo = parseClassPage(entry.html, source, entry.filename);
      if (classInfo.name) {
        classes.push(classInfo);
      }
    } catch (e) {
      logger.warn(`Failed to parse ${entry.filename}: ${e}`);
    }

    processed++;
    if (processed % 200 === 0) {
      logger.info(`  Parsed ${processed} class pages from ${source}...`);
    }
  }
  logger.info(`Parsed ${classes.length} classes from ${source}`);

  // 4. Parse group pages
  for (const entry of readHtmlFromZip(
    workbenchPath,
    source,
    /^group__.*\.html$/
  )) {
    try {
      const group = parseGroupPage(entry.html);
      if (group.name) {
        groups.push(group);
      }
    } catch (e) {
      logger.warn(`Failed to parse group ${entry.filename}: ${e}`);
    }
  }
  logger.info(`Parsed ${groups.length} groups from ${source}`);

  // 5. Parse tutorial pages (Page_*.html)
  for (const entry of readHtmlFromZip(
    workbenchPath,
    source,
    /^Page_.*\.html$/
  )) {
    try {
      const page = parseTutorialPage(entry.html, source, entry.filename);
      if (page.title) {
        wikiPages.push(page);
      }
    } catch (e) {
      logger.warn(`Failed to parse tutorial ${entry.filename}: ${e}`);
    }
  }
  logger.info(`Parsed ${wikiPages.length} tutorial pages from ${source}`);

  // 6. Cross-reference hierarchy with classes to populate children arrays
  // The hierarchy parsed from hierarchy.html gives us parent-child relationships
  const childMap = new Map<string, string[]>();
  for (const node of hierarchy) {
    for (const child of node.children) {
      if (!childMap.has(node.name)) {
        childMap.set(node.name, []);
      }
      childMap.get(node.name)!.push(child);
    }
  }

  // Update classes that have no children from the diagram but have them in hierarchy
  for (const cls of classes) {
    const hierarchyChildren = childMap.get(cls.name);
    if (hierarchyChildren && cls.children.length === 0) {
      cls.children = hierarchyChildren;
    }
  }

  return { classes, groups, hierarchy, wikiPages };
}

export async function scrape(options: ScrapeOptions): Promise<void> {
  logger.info(`Starting scrape (source: ${options.source})`);

  if (options.source === "remote") {
    logger.error("Remote scraping not yet implemented in Phase 0. Use --source local.");
    process.exit(1);
  }

  // Scrape both API sources from local zips
  logger.info("=== Scraping Enfusion Engine API ===");
  const enfusion = scrapeLocalSource(options.workbenchPath, "enfusion");

  logger.info("=== Scraping Arma Reforger API ===");
  const arma = scrapeLocalSource(options.workbenchPath, "arma");

  const output: ScrapeOutput = {
    enfusionClasses: enfusion.classes,
    armaClasses: arma.classes,
    hierarchy: [...enfusion.hierarchy, ...arma.hierarchy],
    groups: [...enfusion.groups, ...arma.groups],
    wikiPages: [...enfusion.wikiPages, ...arma.wikiPages],
  };

  writeOutput(options.dataDir, output);
}
