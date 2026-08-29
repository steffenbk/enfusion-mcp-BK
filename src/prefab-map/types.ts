// src/prefab-map/types.ts
// Shared types for the vehicle prefab component map.
// See docs/superpowers/specs/2026-08-29-vehicle-prefab-component-map-design.md

/** Dotted property path within a component. Repeated sibling blocks are indexed. */
export type PropertyPath = string;

/** A single leaf value inside a component's property tree. */
export interface PropertyLeaf {
  path: PropertyPath;
  value: string;
  /** Block type name, when the leaf sits inside a typed sub-block. */
  nodeType?: string;
}
