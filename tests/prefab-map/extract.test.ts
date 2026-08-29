import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractVehicle } from "../../src/prefab-map/extract.js";
import type { Config } from "../../src/config.js";

const FIXTURES = resolve(__dirname, "../fixtures/prefab-map");

/** Read fixtures instead of the developer's live extracted directory. */
function fixtureReader(path: string): string | null {
  const full = join(FIXTURES, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

// Config has several required string/number fields this test never reads;
// double-assertion is intentional (tsconfig.json type-checks tests/**/*, and
// a direct `{} as Config` fails strict mode's overlap check).
const config = {} as unknown as Config;

describe("extractVehicle — S105", () => {
  const schema = extractVehicle("Prefabs/Vehicles/Wheeled/S105/S105_base.et", config, {
    readFile: fixtureReader,
  });

  it("resolves the full chain oldest ancestor first", () => {
    expect(schema.chain).toEqual([
      "Prefabs/Vehicles/Core/Vehicle_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Car_Base.et",
      "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
    ]);
  });

  it("parses every file without leaving anything unparsed", () => {
    expect(schema.unparsed).toEqual([]);
  });

  it("attributes an inherited component to the ancestor that introduced it", () => {
    const rigidBody = schema.components.find((c) => c.typeName === "RigidBody");
    expect(rigidBody).toBeDefined();
    expect(rigidBody!.introducedBy).toBe("Prefabs/Vehicles/Core/Vehicle_Base.et");
  });

  it("includes the crew pivot bones with their shipped typos intact", () => {
    const bones = schema.boneSurface.map((b) => b.bone);
    expect(bones).toContain("driver_idle");
    expect(bones).toContain("passangerL_idle");
  });

  it("lists every site that references a shared bone", () => {
    const vBody = schema.boneSurface.find((b) => b.bone === "v_body");
    expect(vBody).toBeDefined();
    expect(vBody!.sites.length).toBeGreaterThan(1);
  });
});

describe("extractVehicle — BRDM2", () => {
  const schema = extractVehicle("Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et", config, {
    readFile: fixtureReader,
  });

  it("resolves the APC chain", () => {
    expect(schema.chain).toEqual([
      "Prefabs/Vehicles/Core/Vehicle_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_Base.et",
      "Prefabs/Vehicles/Core/Wheeled_APC_Base.et",
      "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
    ]);
  });

  it("records the turret prefabs as prefab references", () => {
    const turrets = schema.references.filter(
      (r) => r.kind === "prefab" && r.target.includes("Turrets/"),
    );
    expect(turrets.length).toBeGreaterThan(0);
  });

  it("covers all four road wheels in the bone surface", () => {
    const bones = schema.boneSurface.map((b) => b.bone);
    for (const b of ["v_wheel_L01", "v_wheel_L02", "v_wheel_R01", "v_wheel_R02"]) {
      expect(bones).toContain(b);
    }
  });
});

describe("extractVehicle — failure modes", () => {
  it("throws naming the file when the root prefab cannot be read", () => {
    expect(() =>
      extractVehicle("Prefabs/Vehicles/Wheeled/Nope/Nope.et", config, { readFile: () => null }),
    ).toThrow(/Prefabs\/Vehicles\/Wheeled\/Nope\/Nope\.et/);
  });

  it("throws naming the missing ancestor rather than emitting a partial schema", () => {
    const onlyChild = (p: string) =>
      p.endsWith("S105_base.et") ? fixtureReader(p) : null;
    expect(() =>
      extractVehicle("Prefabs/Vehicles/Wheeled/S105/S105_base.et", config, { readFile: onlyChild }),
    ).toThrow(/Wheeled_Car_Base\.et/);
  });
});
