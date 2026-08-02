// src/tuning-server/resolve-engine.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ENGINE_FIELD_KEYS, parseEngineConfPartial, type EngineFields } from "./engine-conf.js";
import { findEngineBlock, readEngineFieldsFromBlock } from "./et-engine-block.js";

export type FieldSource = "overridden" | "inherited" | "unresolved";

export interface ResolvedField {
  value: number | null;
  source: FieldSource;
}

export type ResolvedEngine = Record<keyof EngineFields, ResolvedField>;

function defaultReadFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Strip a leading `{GUID}` from an Enfusion resource reference. */
function stripGuid(ref: string): string {
  return ref.replace(/^\{[0-9A-Fa-f]+\}/, "");
}

/**
 * Fill all 9 engine fields for a vehicle:
 *   1. written in the mod's own .et Engine block  -> "overridden"
 *   2. from the .conf that block references       -> "inherited"
 *   3. from the same-path vanilla .et in the mirror (its inline values, or the
 *      .conf that IT references)                  -> "inherited"
 *   4. otherwise                                  -> "unresolved"
 */
export function resolveEngineFields(args: {
  modText: string;
  relPath: string;
  extractedPath?: string;
  readFile?: (path: string) => string | null;
}): ResolvedEngine {
  const read = args.readFile ?? defaultReadFile;
  const overridden: Partial<EngineFields> = {};
  const inherited: Partial<EngineFields> = {};

  const modLoc = findEngineBlock(args.modText);
  if (modLoc) {
    Object.assign(overridden, readEngineFieldsFromBlock(args.modText, modLoc));
  }

  const mirror = args.extractedPath;
  const confFromRef = (ref: string | undefined): void => {
    if (!ref || !mirror) return;
    const text = read(join(mirror, ...stripGuid(ref).split("/")));
    if (text) Object.assign(inherited, parseEngineConfPartial(text));
  };

  if (modLoc?.inheritance) {
    confFromRef(modLoc.inheritance);
  } else if (mirror) {
    const vanillaText = read(join(mirror, ...args.relPath.split("/")));
    if (vanillaText) {
      const vLoc = findEngineBlock(vanillaText);
      if (vLoc) {
        const vInline = readEngineFieldsFromBlock(vanillaText, vLoc);
        // Read the referenced conf first as the baseline (if any), then let
        // the vanilla block's own inline fields override it — the vanilla
        // block can both reference a conf AND override a field inline.
        confFromRef(vLoc.inheritance);
        Object.assign(inherited, vInline);
      }
    }
  }

  const out = {} as ResolvedEngine;
  for (const key of ENGINE_FIELD_KEYS) {
    if (overridden[key] !== undefined) {
      out[key] = { value: overridden[key]!, source: "overridden" };
    } else if (inherited[key] !== undefined) {
      out[key] = { value: inherited[key]!, source: "inherited" };
    } else {
      out[key] = { value: null, source: "unresolved" };
    }
  }
  return out;
}
