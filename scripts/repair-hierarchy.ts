/**
 * Repair corrupted parent/child inheritance data in the scraped JSON files.
 *
 * The Doxygen <map><area> heuristic in parseClassPage() frequently reverses
 * parent/child relationships (especially for root classes).  This script:
 *
 * 1. Parses hierarchy.html fixtures (Enfusion) to get ground-truth relationships
 * 2. Overrides parents[] and children[] for classes found in the hierarchy
 * 3. For classes NOT in the hierarchy (Arma), clears known-bad circular refs
 * 4. Also updates hierarchy.json which was empty due to the parser bug
 *
 * Usage:  tsx scripts/repair-hierarchy.ts
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHierarchyPage } from "../src/scraper/doxygen-parser.js";
import type { ClassInfo, HierarchyNode } from "../src/index/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "data");
const fixturesDir = resolve(__dirname, "..", "tests", "fixtures");

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

// --- Step 1: Parse hierarchy fixture ---
const hierarchyPath = resolve(fixturesDir, "sample-hierarchy.html");
if (!existsSync(hierarchyPath)) {
  console.error("No hierarchy fixture found at", hierarchyPath);
  process.exit(1);
}

const hierarchyHtml = readFileSync(hierarchyPath, "utf-8");
const hierarchyNodes = parseHierarchyPage(hierarchyHtml);
console.log(`Parsed ${hierarchyNodes.length} hierarchy nodes from fixture`);

// Build relationship maps from hierarchy
const hChildMap = new Map<string, string[]>();
const hParentMap = new Map<string, string[]>();

for (const node of hierarchyNodes) {
  for (const child of node.children) {
    if (!hChildMap.has(node.name)) hChildMap.set(node.name, []);
    hChildMap.get(node.name)!.push(child);

    if (!hParentMap.has(child)) hParentMap.set(child, []);
    if (!hParentMap.get(child)!.includes(node.name)) {
      hParentMap.get(child)!.push(node.name);
    }
  }
}

const classesInHierarchy = new Set([...hChildMap.keys(), ...hParentMap.keys()]);
console.log(`Hierarchy covers ${classesInHierarchy.size} unique class names`);

// --- Step 2: Load and repair class data ---
const enfPath = resolve(dataDir, "api", "enfusion-classes.json");
const armaPath = resolve(dataDir, "api", "arma-classes.json");
const hierPath = resolve(dataDir, "api", "hierarchy.json");

const enfClasses = loadJson<ClassInfo[]>(enfPath);
const armaClasses = loadJson<ClassInfo[]>(armaPath);

function repairClasses(classes: ClassInfo[], label: string): {
  hierarchyFixed: number;
  circularFixed: number;
  cleared: number;
} {
  const stats = { hierarchyFixed: 0, circularFixed: 0, cleared: 0 };
  const classMap = new Map(classes.map((c) => [c.name, c]));

  for (const cls of classes) {
    if (classesInHierarchy.has(cls.name)) {
      // Override with hierarchy data
      cls.parents = hParentMap.get(cls.name) ?? [];
      cls.children = hChildMap.get(cls.name) ?? [];
      stats.hierarchyFixed++;
    } else {
      // No hierarchy data — fix circular references
      const origParents = [...cls.parents];
      cls.parents = cls.parents.filter((parentName) => {
        const parentCls = classMap.get(parentName);
        if (!parentCls) return true;
        if (parentCls.parents.includes(cls.name)) {
          // Circular reference
          const clsIsScr = cls.name.startsWith("SCR_") && !parentName.startsWith("SCR_");
          if (clsIsScr) return true;
          const parentIsScr = parentName.startsWith("SCR_") && !cls.name.startsWith("SCR_");
          if (parentIsScr) return false;
          return parentCls.children.length >= cls.children.length;
        }
        return true;
      });
      if (cls.parents.length !== origParents.length) {
        stats.circularFixed++;
      }
    }
  }

  console.log(
    `${label}: ${stats.hierarchyFixed} fixed from hierarchy, ` +
    `${stats.circularFixed} circular refs resolved`
  );
  return stats;
}

const enfStats = repairClasses(enfClasses, "Enfusion");
const armaStats = repairClasses(armaClasses, "Arma");

// --- Step 3: Write repaired data ---
writeJson(enfPath, enfClasses);
console.log(`Wrote ${enfPath}`);

writeJson(armaPath, armaClasses);
console.log(`Wrote ${armaPath}`);

// Update hierarchy.json with the parsed data
writeJson(hierPath, hierarchyNodes);
console.log(`Wrote ${hierPath} (${hierarchyNodes.length} nodes)`);

// --- Step 4: Verification ---
const allClasses = [...enfClasses, ...armaClasses];
const byName = new Map(allClasses.map((c) => [c.name, c]));

let circularCount = 0;
for (const cls of allClasses) {
  for (const p of cls.parents) {
    const parentCls = byName.get(p);
    if (parentCls && parentCls.parents.includes(cls.name)) {
      circularCount++;
    }
  }
}

const withParents = allClasses.filter((c) => c.parents.length > 0).length;
const withChildren = allClasses.filter((c) => c.children.length > 0).length;

console.log("\n=== POST-REPAIR VERIFICATION ===");
console.log(`Total classes: ${allClasses.length}`);
console.log(`Classes with parents: ${withParents}`);
console.log(`Classes with children: ${withChildren}`);
console.log(`Remaining circular references: ${circularCount}`);
console.log(`Hierarchy nodes: ${hierarchyNodes.length}`);
