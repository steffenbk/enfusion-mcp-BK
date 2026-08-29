// src/prefab-map/references.ts
import type {
  BoneSite,
  BoneSurface,
  ReferenceEdge,
  ResolvedComponent,
} from "./types.js";

/**
 * Property keys confirmed to hold a rig bone name.
 *
 * `PivotID` dominates by a wide margin in the S105 and BRDM2 chains. This list is
 * the audited set for those two vehicles, not a guess at the engine's full surface:
 * Task 4 asserts that no key outside this list holds a value matching a known bone,
 * so the list stays honest as the corpus is walked.
 */
export const BONE_BEARING_KEYS: readonly string[] = ["PivotID"];

const GUID_PREFIX = /^\{[0-9A-Fa-f]{16}\}/;
const RESOURCE_EXTENSIONS = [".xob", ".acp", ".agf", ".agr", ".asi", ".emat", ".ptc", ".txo"];

function lastSegment(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path : path.slice(dot + 1);
}

/**
 * Classify every resolved property value that points outside its component.
 * Values that reference nothing produce no edge.
 */
export function extractReferences(components: ResolvedComponent[]): ReferenceEdge[] {
  const edges: ReferenceEdge[] = [];

  for (const component of components) {
    for (const prop of component.properties) {
      const kindAndTarget = classify(prop.path, prop.value);
      if (!kindAndTarget) continue;
      edges.push({
        component: component.typeName,
        propertyPath: prop.path,
        kind: kindAndTarget.kind,
        target: kindAndTarget.target,
        setBy: prop.setBy,
      });
    }
  }

  return edges;
}

function classify(
  path: string,
  value: string,
): { kind: ReferenceEdge["kind"]; target: string } | null {
  if (value === "") return null;

  const key = lastSegment(path);
  if (BONE_BEARING_KEYS.includes(key)) {
    return { kind: "bone", target: value };
  }

  const stripped = value.replace(GUID_PREFIX, "");
  const lower = stripped.toLowerCase();

  if (lower.endsWith(".et")) return { kind: "prefab", target: stripped };
  if (RESOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { kind: "resource", target: stripped };
  }

  return null;
}

/**
 * Collapse bone edges into the deduplicated set of bones the prefab expects,
 * each carrying every site that references it. A single missing bone therefore
 * shows all the places that will silently misbehave, which is the information the
 * old set-based check threw away.
 */
export function buildBoneSurface(edges: ReferenceEdge[]): BoneSurface[] {
  const byBone = new Map<string, BoneSite[]>();

  for (const edge of edges) {
    if (edge.kind !== "bone") continue;
    const sites = byBone.get(edge.target) ?? [];
    sites.push({
      component: edge.component,
      propertyPath: edge.propertyPath,
      setBy: edge.setBy,
    });
    byBone.set(edge.target, sites);
  }

  return Array.from(byBone.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bone, sites]) => ({ bone, sites }));
}
