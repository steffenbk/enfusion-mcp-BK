import { describe, it, expect } from "vitest";
import { parseEngineConf, serializeEngineConf, ENGINE_FIELD_KEYS } from "../../src/tuning-server/engine-conf.js";

const M151_CONF = `Engine {
 Inertia 0.3
 MaxPower 53
 MaxTorque 176
 RpmMaxPower 4000
 RpmMaxTorque 1800
 Steepness 15
 Friction 53
 RpmIdle 840
 RpmRedline 4200
 RpmMax 6000
}
`;

describe("parseEngineConf", () => {
  it("extracts all 9 known fields from a real Engine_M151.conf", () => {
    const fields = parseEngineConf(M151_CONF);
    expect(fields).toEqual({
      Inertia: 0.3,
      MaxPower: 53,
      MaxTorque: 176,
      RpmMaxPower: 4000,
      RpmMaxTorque: 1800,
      Steepness: 15,
      Friction: 53,
      RpmIdle: 840,
      RpmMax: 6000,
    });
  });

  it("throws listing missing fields when the file is incomplete", () => {
    const incomplete = "Engine {\n MaxPower 53\n}\n";
    expect(() => parseEngineConf(incomplete)).toThrow(/MaxTorque/);
    expect(() => parseEngineConf(incomplete)).toThrow(/RpmMax\b/);
  });
});

describe("serializeEngineConf", () => {
  it("round-trips: parse -> serialize -> parse yields the same values", () => {
    const fields = parseEngineConf(M151_CONF);
    const rewritten = serializeEngineConf(M151_CONF, fields);
    expect(parseEngineConf(rewritten)).toEqual(fields);
  });

  it("changes only the targeted values, leaving unknown keys and formatting untouched", () => {
    const fields = parseEngineConf(M151_CONF);
    const changed = { ...fields, MaxPower: 99, Steepness: 20 };
    const rewritten = serializeEngineConf(M151_CONF, changed);
    expect(rewritten).toContain("RpmRedline 4200"); // unknown key survives untouched
    expect(rewritten).toContain("MaxPower 99");
    expect(rewritten).toContain("Steepness 20");
    expect(rewritten).toContain("MaxTorque 176"); // untouched field survives
    expect(rewritten.split(/\r?\n/).length).toBe(M151_CONF.split(/\r?\n/).length); // no lines added/removed
  });

  it("ENGINE_FIELD_KEYS has exactly the 9 confirmed field names", () => {
    expect(ENGINE_FIELD_KEYS.sort()).toEqual(
      ["Inertia", "MaxPower", "MaxTorque", "RpmMaxPower", "RpmMaxTorque", "Steepness", "Friction", "RpmIdle", "RpmMax"].sort()
    );
  });
});
