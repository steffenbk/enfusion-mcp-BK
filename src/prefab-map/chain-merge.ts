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

/** One property whose recorded "override" was never a real inheritance override. */
export interface SelfOverride {
  component: string;
  path: string;
  /** The `.et` file both the winning value and the shadowed value came from. */
  from: string;
}

/**
 * Find properties whose `overrides` list contains an entry attributed to the
 * SAME file that also set the property's final value.
 *
 * This can never happen from genuine chain inheritance: `mergeChain` only
 * records an override when a later `level.path` replaces an earlier one, so a
 * same-file override means two flattened leaves collided on one path within a
 * single component's own `flattenComponent` output — i.e. two distinct source
 * declarations were merged into one property, and one of them was silently
 * discarded. That is exactly the shape of the parser bug that collapsed three
 * sibling `CargoCompartmentSlot ... : "parent.conf" { ... }` blocks into one:
 * nothing downstream can tell a real collision from a genuine two-value
 * override once it happens, so this exists as a build-time gate that would
 * have caught it (and would catch a future regression of the same shape)
 * before a corrupted schema is ever written.
 */
export function findSelfOverrides(components: ResolvedComponent[]): SelfOverride[] {
  const found: SelfOverride[] = [];
  for (const component of components) {
    for (const prop of component.properties) {
      // A real chain never revisits the same level twice, so the full
      // provenance history (every shadowed value's origin, plus the final
      // winner) must name each `.et` file at most once. Two entries sharing a
      // file — anywhere in that history, not just against the final winner —
      // mean a same-level collision happened at some point, even if a later,
      // genuine override from a different file has since masked it.
      const history = [...prop.overrides.map((o) => o.from), prop.setBy];
      const seen = new Set<string>();
      for (const from of history) {
        if (seen.has(from)) {
          found.push({ component: component.typeName, path: prop.path, from });
        }
        seen.add(from);
      }
    }
  }
  return found;
}
