// src/prefab-map/extract.ts
import { basename } from "node:path";
import { parse } from "../formats/enfusion-text.js";
import { parseTopLevelComponents, readEtFile, stripGuid } from "../utils/prefab-ancestry.js";
import type { Config } from "../config.js";
import { mergeChain } from "./chain-merge.js";
import { buildBoneSurface, extractReferences } from "./references.js";
import type { ChainLevelInput, VehicleSchema } from "./types.js";

export interface ExtractOptions {
  /**
   * Corpus reader override. Tests pass a fixture reader so the suite never depends
   * on the developer's live extracted directory.
   */
  readFile?: (path: string) => string | null;
  projectPath?: string;
}

/**
 * Build the complete derived map for one vehicle.
 *
 * Walks the inheritance chain by hand rather than through `walkChain()` because
 * this needs each level's raw content re-parsed into `EnfusionNode`s for
 * property-level flattening, where `walkChain` keeps components as raw strings.
 * Chain traversal order and cycle handling mirror `walkChain` deliberately.
 */
export function extractVehicle(
  rootPath: string,
  config: Config,
  opts: ExtractOptions = {},
): VehicleSchema {
  const read =
    opts.readFile ?? ((p: string) => readEtFile(p, config, opts.projectPath));

  const levels: ChainLevelInput[] = [];
  const unparsed: { path: string; reason: string }[] = [];
  const visited = new Set<string>();

  // Walk leaf -> ancestor, collecting content, then reverse so oldest is first.
  const stack: string[] = [];
  let current: string | null = stripGuid(rootPath);

  while (current !== null) {
    const key = current.toLowerCase();
    if (visited.has(key)) {
      throw new Error(`Inheritance cycle at ${current}`);
    }
    visited.add(key);

    const content = read(current);
    if (content === null) {
      throw new Error(
        `Could not read prefab: ${current}. ` +
          `Check config.extractedPath points at the extracted game data directory.`,
      );
    }

    stack.push(current);
    const node = parse(content);
    const comps = parseTopLevelComponents(content);

    const components: ChainLevelInput["components"] = [];
    for (const [, comp] of comps) {
      try {
        components.push({
          typeName: comp.typeName,
          node: parse(`${comp.typeName} "{${comp.guid}}" {${comp.rawBody}}`),
        });
      } catch (err) {
        unparsed.push({
          path: `${current}#${comp.typeName}`,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    levels.push({ path: current, components });
    current = node.inheritance === undefined ? null : stripGuid(node.inheritance);
  }

  levels.reverse();
  stack.reverse();

  const components = mergeChain(levels);
  const references = extractReferences(components);

  return {
    vehicle: basename(stripGuid(rootPath), ".et").replace(/_base$/i, ""),
    rootPath: stripGuid(rootPath),
    chain: stack,
    components,
    references,
    boneSurface: buildBoneSurface(references),
    unparsed,
  };
}
