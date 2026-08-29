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
  }

  for (const [name] of mb) {
    if (!ma.has(name)) onlyInB.push({ component: name, detail: `only on ${b.vehicle}` });
  }

  const byComponent = (x: { component: string }, y: { component: string }) =>
    x.component < y.component ? -1 : x.component > y.component ? 1 : 0;

  return {
    sharedComponents: shared.sort(),
    onlyInA: onlyInA.sort(byComponent),
    onlyInB: onlyInB.sort(byComponent),
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
