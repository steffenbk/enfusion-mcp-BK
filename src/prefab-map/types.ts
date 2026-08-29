// src/prefab-map/types.ts
// Shared types for the vehicle prefab component map.
// See docs/superpowers/specs/2026-08-29-vehicle-prefab-component-map-design.md

import type { EnfusionNode } from "../formats/enfusion-text.js";

/** Dotted property path within a component. Repeated sibling blocks are indexed. */
export type PropertyPath = string;

/** A single leaf value inside a component's property tree. */
export interface PropertyLeaf {
  path: PropertyPath;
  value: string;
  /** Block type name, when the leaf sits inside a typed sub-block. */
  nodeType?: string;
}

/** A property value after chain resolution, with provenance. */
export interface ResolvedProperty {
  path: PropertyPath;
  value: string;
  nodeType?: string;
  /** The `.et` file whose value won. */
  setBy: string;
  /** Values this one shadowed, oldest ancestor first. */
  overrides: { value: string; from: string }[];
}

/** A component after chain resolution. */
export interface ResolvedComponent {
  typeName: string;
  properties: ResolvedProperty[];
  /** The `.et` file that first declared this component. */
  introducedBy: string;
}

/** One level of an inheritance chain, oldest ancestor first. */
export interface ChainLevelInput {
  path: string;
  components: { typeName: string; node: EnfusionNode }[];
}

export type ReferenceKind = "bone" | "prefab" | "resource";

/** A property value that points outside the component. */
export interface ReferenceEdge {
  component: string;
  propertyPath: PropertyPath;
  kind: ReferenceKind;
  target: string;
  setBy: string;
}

/** One place a bone name is referenced from. */
export interface BoneSite {
  component: string;
  propertyPath: PropertyPath;
  setBy: string;
}

/** Every bone the prefab expects, with all sites referencing it. */
export interface BoneSurface {
  bone: string;
  sites: BoneSite[];
}

/** The complete derived map for one vehicle. */
export interface VehicleSchema {
  /** Short name, e.g. "S105". */
  vehicle: string;
  /** Corpus-relative path of the leaf prefab. */
  rootPath: string;
  /** Inheritance chain, oldest ancestor first, leaf last. */
  chain: string[];
  components: ResolvedComponent[];
  references: ReferenceEdge[];
  boneSurface: BoneSurface[];
  /** Content the parser could not turn into properties. Must be empty. */
  unparsed: { path: string; reason: string }[];
}
