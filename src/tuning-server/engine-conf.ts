export interface EngineFields {
  Inertia: number;
  MaxPower: number;
  MaxTorque: number;
  RpmMaxPower: number;
  RpmMaxTorque: number;
  Steepness: number;
  Friction: number;
  RpmIdle: number;
  RpmMax: number;
}

export const ENGINE_FIELD_KEYS: (keyof EngineFields)[] = [
  "Inertia",
  "MaxPower",
  "MaxTorque",
  "RpmMaxPower",
  "RpmMaxTorque",
  "Steepness",
  "Friction",
  "RpmIdle",
  "RpmMax",
];

// Matches a single "Key Value" line inside an Engine { ... } block, e.g. " MaxPower 53".
const ENGINE_LINE_RE = /^(\s*)([A-Za-z][A-Za-z0-9_]*)\s+(-?\d+(?:\.\d+)?)\s*$/;

export function parseEngineConf(text: string): EngineFields {
  const found: Partial<Record<keyof EngineFields, number>> = {};

  for (const line of text.split(/\r?\n/)) {
    const m = ENGINE_LINE_RE.exec(line);
    if (!m) continue;
    const key = m[2];
    if ((ENGINE_FIELD_KEYS as string[]).includes(key)) {
      found[key as keyof EngineFields] = parseFloat(m[3]);
    }
  }

  const missing = ENGINE_FIELD_KEYS.filter((k) => found[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Engine .conf missing required field(s): ${missing.join(", ")}`);
  }

  return found as EngineFields;
}

export function serializeEngineConf(original: string, values: EngineFields): string {
  const usesCrlf = original.includes("\r\n");
  const lines = original.split(/\r?\n/);

  const out = lines.map((line) => {
    const m = ENGINE_LINE_RE.exec(line);
    if (!m) return line;
    const key = m[2];
    if (!(ENGINE_FIELD_KEYS as string[]).includes(key)) return line;
    const indent = m[1];
    return `${indent}${key} ${values[key as keyof EngineFields]}`;
  });

  return out.join(usesCrlf ? "\r\n" : "\n");
}
