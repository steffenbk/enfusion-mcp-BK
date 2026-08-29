// src/prefab-map/chain-merge.ts
import { flattenComponent } from "./property-tree.js";
import type { ChainLevelInput, ResolvedComponent, ResolvedProperty } from "./types.js";

interface Accum {
  introducedBy: string;
  props: Map<string, ResolvedProperty>;
}

/**
 * Merge components down an inheritance chain, oldest ancestor first.
 *
 * Provenance is tracked per property, not per component: a descendant that changes
 * one field of a large component leaves every other field attributed to the
 * ancestor that set it. That granularity is the whole point — a bone name still
 * pointing at a donor rig is exactly a property whose `setBy` is an ancestor when
 * it should have been overridden.
 */
export function mergeChain(levels: ChainLevelInput[]): ResolvedComponent[] {
  const acc = new Map<string, Accum>();

  for (const level of levels) {
    for (const { typeName, node } of level.components) {
      let entry = acc.get(typeName);
      if (!entry) {
        entry = { introducedBy: level.path, props: new Map() };
        acc.set(typeName, entry);
      }

      for (const leaf of flattenComponent(node)) {
        const existing = entry.props.get(leaf.path);
        if (!existing) {
          entry.props.set(leaf.path, {
            path: leaf.path,
            value: leaf.value,
            ...(leaf.nodeType === undefined ? {} : { nodeType: leaf.nodeType }),
            setBy: level.path,
            overrides: [],
          });
          continue;
        }
        if (existing.value === leaf.value) {
          // Restated identically; the older attribution stays correct.
          continue;
        }
        existing.overrides.push({ value: existing.value, from: existing.setBy });
        existing.value = leaf.value;
        existing.setBy = level.path;
        if (leaf.nodeType !== undefined) existing.nodeType = leaf.nodeType;
      }
    }
  }

  return Array.from(acc.entries()).map(([typeName, entry]) => ({
    typeName,
    introducedBy: entry.introducedBy,
    properties: Array.from(entry.props.values()),
  }));
}
