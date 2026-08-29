// src/prefab-map/property-tree.ts
import type { EnfusionNode } from "../formats/enfusion-text.js";
import type { PropertyLeaf } from "./types.js";

/**
 * Flatten a parsed component node into dotted property paths.
 *
 * Repeated sibling blocks of the same type are indexed (`Wheels[0]`, `Wheels[1]`)
 * so two wheels with the same structure stay distinguishable. Standalone quoted
 * values (Enfusion arrays such as `Filenames`) land under `[value][n]`.
 *
 * Values are copied verbatim — shipped assets contain load-bearing typos in bone
 * names and correcting them would break the very lookups this map exists to check.
 */
export function flattenComponent(node: EnfusionNode): PropertyLeaf[] {
  const out: PropertyLeaf[] = [];
  walk(node, "", undefined, out);
  return out;
}

function join(prefix: string, segment: string): string {
  return prefix === "" ? segment : `${prefix}.${segment}`;
}

function walk(
  node: EnfusionNode,
  prefix: string,
  nodeType: string | undefined,
  out: PropertyLeaf[],
): void {
  for (const prop of node.properties) {
    if (typeof prop.value === "string") {
      out.push(leaf(join(prefix, prop.key), prop.value, nodeType));
    } else {
      walk(prop.value, join(prefix, prop.key), prop.value.type || nodeType, out);
    }
  }

  node.values.forEach((v, i) => {
    out.push(leaf(join(prefix, `[value][${i}]`), v, nodeType));
  });

  // Index children by type so repeated siblings get stable distinct paths.
  const seen = new Map<string, number>();
  for (const child of node.children) {
    const type = child.type;
    const idx = seen.get(type) ?? 0;
    seen.set(type, idx + 1);
    walk(child, join(prefix, `${type}[${idx}]`), type, out);
  }
}

function leaf(path: string, value: string, nodeType: string | undefined): PropertyLeaf {
  return nodeType === undefined ? { path, value } : { path, value, nodeType };
}
