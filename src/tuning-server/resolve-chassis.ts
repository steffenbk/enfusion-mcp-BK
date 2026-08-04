import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  findBlockByPath,
  findChildBlocks,
  blockReference,
  readNumericFields,
  collectFromConfChain,
  toResolved,
  type ResolvedGroup,
} from "./config-chain.js";

const SIM_PATH = ["components", "VehicleWheeledSimulation", "Simulation"];

export const LONGITUDINAL_KEYS = ["b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","b10"] as const;
export const LATERAL_KEYS =
  ["a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","a10","a11","a12","a13","a14"] as const;
export const SUSPENSION_KEYS =
  ["SpringRate","CompressionDamper","RelaxationDamper","MaxTravelUp","MaxTravelDown","MaxSteeringAngle"] as const;

export interface ChassisResolveOptions {
  modText: string;
  /** Addon-relative path, used to find the same-path vanilla prefab. */
  relPath: string;
  addonPath?: string;
  extractedPath?: string;
  readFile?: (path: string) => string | null;
}

export interface AxleSuspension {
  index: number;
  fields: ResolvedGroup;
}

export interface ResolvedChassis {
  longitudinal: ResolvedGroup;
  lateral: ResolvedGroup;
  axles: AxleSuspension[];
}

function defaultReadFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Raw values a single prefab contributes, before overridden/inherited is decided. */
interface RawChassis {
  lon: Record<string, number>;
  lat: Record<string, number>;
  axles: Record<string, number>[];
}

function readFromPrefab(text: string, roots: string[], readFile?: (p: string) => string | null): RawChassis {
  const base = { roots, readFile };

  // --- Pacejka. The block can write coefficients inline AND reference a conf;
  // inline wins and the conf chain fills the rest.
  const lon: Record<string, number> = {};
  const lat: Record<string, number> = {};
  const pac = findBlockByPath(text, [...SIM_PATH, "Pacejka"]);
  if (pac) {
    const lonSub = findBlockByPath(text, [...SIM_PATH, "Pacejka", "Longitudinal"]);
    const latSub = findBlockByPath(text, [...SIM_PATH, "Pacejka", "Lateral"]);
    if (lonSub) Object.assign(lon, readNumericFields(text, lonSub, LONGITUDINAL_KEYS));
    if (latSub) Object.assign(lat, readNumericFields(text, latSub, LATERAL_KEYS));
    const ref = blockReference(text, pac);
    const cLon = collectFromConfChain(ref, { ...base, subBlock: "Longitudinal", keys: LONGITUDINAL_KEYS });
    const cLat = collectFromConfChain(ref, { ...base, subBlock: "Lateral", keys: LATERAL_KEYS });
    for (const k of LONGITUDINAL_KEYS) if (lon[k] === undefined && cLon[k] !== undefined) lon[k] = cLon[k];
    for (const k of LATERAL_KEYS) if (lat[k] === undefined && cLat[k] !== undefined) lat[k] = cLat[k];
  }

  // --- Suspension, per axle. Front and rear genuinely differ (the M998 runs
  // MaxTravelUp 0.165 front against a softer rear), so they are never merged.
  const axles: Record<string, number>[] = [];
  const axleParent = findBlockByPath(text, [...SIM_PATH, "Axles"]);
  if (axleParent) {
    for (const axle of findChildBlocks(text, axleParent, "Axle")) {
      const vals: Record<string, number> = {};
      const susp = findChildBlocks(text, axle, "Suspension")[0];
      if (susp) {
        Object.assign(vals, readNumericFields(text, susp, SUSPENSION_KEYS));
        const chain = collectFromConfChain(blockReference(text, susp), { ...base, keys: SUSPENSION_KEYS });
        for (const k of SUSPENSION_KEYS) if (vals[k] === undefined && chain[k] !== undefined) vals[k] = chain[k];
      }
      axles.push(vals);
    }
  }
  return { lon, lat, axles };
}

/**
 * Tyre (Pacejka) and suspension values for a vehicle.
 *
 * A mod prefab commonly shadows a vanilla one of the same path while defining
 * none of this itself — every RoadForger vehicle does — so anything the mod
 * prefab does not carry is taken from the vanilla file at the same path and
 * reported as inherited.
 */
export function resolveChassis(args: ChassisResolveOptions): ResolvedChassis {
  const read = args.readFile ?? defaultReadFile;
  const roots = [args.addonPath, args.extractedPath].filter(Boolean) as string[];

  const own = readFromPrefab(args.modText, roots, args.readFile);

  let inheritedRaw: RawChassis = { lon: {}, lat: {}, axles: [] };
  if (args.extractedPath) {
    const vanilla = read(join(args.extractedPath, ...args.relPath.split("/")));
    if (vanilla) inheritedRaw = readFromPrefab(vanilla, roots, args.readFile);
  }

  const axleCount = Math.max(own.axles.length, inheritedRaw.axles.length);
  const axles: AxleSuspension[] = [];
  for (let i = 0; i < axleCount; i++) {
    axles.push({
      index: i,
      fields: toResolved(SUSPENSION_KEYS, own.axles[i] ?? {}, inheritedRaw.axles[i] ?? {}),
    });
  }

  return {
    longitudinal: toResolved(LONGITUDINAL_KEYS, own.lon, inheritedRaw.lon),
    lateral: toResolved(LATERAL_KEYS, own.lat, inheritedRaw.lat),
    axles,
  };
}
