// src/prefab-map/contrast.ts
import type { ResolvedComponent, VehicleSchema } from "./types.js";

export interface ContrastEntry {
  component: string;
  propertyPath?: string;
  detail: string;
}

export interface Contrast {
  sharedComponents: string[];
  onlyInA: ContrastEntry[];
  onlyInB: ContrastEntry[];
  divergentProperties: {
    component: string;
    propertyPath: string;
    valueA: string;
    valueB: string;
  }[];
}

/**
 * Contrast two vehicles. With only two samples, frequency counts say nothing;
 * what a plain car and a turreted armored car share is the ground-vehicle core,
 * and what only one has is that vehicle's character. That split is the analysis.
 */
export function contrastVehicles(a: VehicleSchema, b: VehicleSchema): Contrast {
  const byName = (s: VehicleSchema) =>
    new Map(s.components.map((c) => [c.typeName, c] as const));
  const ma = byName(a);
  const mb = byName(b);

  const shared: string[] = [];
  const onlyInA: ContrastEntry[] = [];
  const onlyInB: ContrastEntry[] = [];
  const divergent: Contrast["divergentProperties"] = [];

  for (const [name, ca] of ma) {
    const cb = mb.get(name);
    if (!cb) {
      onlyInA.push({ component: name, detail: `only on ${a.vehicle}` });
      continue;
    }
    shared.push(name);
    divergent.push(...diffProperties(name, ca, cb));
    const { onlyInA: propOnlyA, onlyInB: propOnlyB } = diffPropertyPresence(
      name,
      ca,
      cb,
      a.vehicle,
      b.vehicle,
    );
    onlyInA.push(...propOnlyA);
    onlyInB.push(...propOnlyB);
  }

  for (const [name] of mb) {
    if (!ma.has(name)) onlyInB.push({ component: name, detail: `only on ${b.vehicle}` });
  }

  const byComponent = (x: { component: string }, y: { component: string }) =>
    x.component < y.component ? -1 : x.component > y.component ? 1 : 0;

  // Component-level entries (no propertyPath) sort before property-level entries
  // for the same component.
  const byEntry = (x: ContrastEntry, y: ContrastEntry) => {
    const c = byComponent(x, y);
    if (c !== 0) return c;
    if (x.propertyPath === undefined && y.propertyPath === undefined) return 0;
    if (x.propertyPath === undefined) return -1;
    if (y.propertyPath === undefined) return 1;
    return x.propertyPath < y.propertyPath ? -1 : x.propertyPath > y.propertyPath ? 1 : 0;
  };

  return {
    sharedComponents: shared.sort(),
    onlyInA: onlyInA.sort(byEntry),
    onlyInB: onlyInB.sort(byEntry),
    divergentProperties: divergent.sort(
      (x, y) => byComponent(x, y) || (x.propertyPath < y.propertyPath ? -1 : 1),
    ),
  };
}

function diffProperties(
  component: string,
  ca: ResolvedComponent,
  cb: ResolvedComponent,
): Contrast["divergentProperties"] {
  const pb = new Map(cb.properties.map((p) => [p.path, p.value] as const));
  const out: Contrast["divergentProperties"] = [];
  for (const pa of ca.properties) {
    const other = pb.get(pa.path);
    if (other !== undefined && other !== pa.value) {
      out.push({ component, propertyPath: pa.path, valueA: pa.value, valueB: other });
    }
  }
  return out;
}

/**
 * For a shared component, find properties present on only one side: a path
 * that exists in A's copy of the component but not in B's, and vice versa.
 */
function diffPropertyPresence(
  component: string,
  ca: ResolvedComponent,
  cb: ResolvedComponent,
  vehicleA: string,
  vehicleB: string,
): { onlyInA: ContrastEntry[]; onlyInB: ContrastEntry[] } {
  const pathsA = new Set(ca.properties.map((p) => p.path));
  const pathsB = new Set(cb.properties.map((p) => p.path));

  const onlyInA: ContrastEntry[] = [];
  const onlyInB: ContrastEntry[] = [];

  for (const pa of ca.properties) {
    if (!pathsB.has(pa.path)) {
      onlyInA.push({
        component,
        propertyPath: pa.path,
        detail: `only on ${vehicleA}'s ${component}`,
      });
    }
  }
  for (const pb of cb.properties) {
    if (!pathsA.has(pb.path)) {
      onlyInB.push({
        component,
        propertyPath: pb.path,
        detail: `only on ${vehicleB}'s ${component}`,
      });
    }
  }

  return { onlyInA, onlyInB };
}
