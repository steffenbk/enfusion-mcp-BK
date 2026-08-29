import { describe, it, expect } from "vitest";
import { contrastVehicles } from "../../src/prefab-map/contrast.js";
import type { ResolvedComponent, VehicleSchema } from "../../src/prefab-map/types.js";

function schema(vehicle: string, components: ResolvedComponent[]): VehicleSchema {
  return {
    vehicle,
    rootPath: `${vehicle}.et`,
    chain: [`${vehicle}.et`],
    components,
    references: [],
    boneSurface: [],
    unparsed: [],
  };
}

function comp(typeName: string, props: [string, string][]): ResolvedComponent {
  return {
    typeName,
    introducedBy: "x.et",
    properties: props.map(([path, value]) => ({ path, value, setBy: "x.et", overrides: [] })),
  };
}

describe("contrastVehicles", () => {
  const a = schema("S105", [
    comp("RigidBody", [["Mass", "1200"]]),
    comp("SCR_VehicleSoundComponent", [["Horn", "civ"]]),
  ]);
  const b = schema("BRDM2", [
    comp("RigidBody", [["Mass", "7000"]]),
    comp("SlotManagerComponent", [["Slots.Turret", "t.et"]]),
  ]);

  it("lists components present in both", () => {
    expect(contrastVehicles(a, b).sharedComponents).toEqual(["RigidBody"]);
  });

  it("lists components unique to each side", () => {
    const c = contrastVehicles(a, b);
    expect(c.onlyInA.map((e) => e.component)).toEqual(["SCR_VehicleSoundComponent"]);
    expect(c.onlyInB.map((e) => e.component)).toEqual(["SlotManagerComponent"]);
  });

  it("reports shared properties whose values differ", () => {
    expect(contrastVehicles(a, b).divergentProperties).toEqual([
      { component: "RigidBody", propertyPath: "Mass", valueA: "1200", valueB: "7000" },
    ]);
  });

  it("does not report a shared property with an identical value", () => {
    const same = schema("BRDM2", [comp("RigidBody", [["Mass", "1200"]])]);
    expect(contrastVehicles(a, same).divergentProperties).toEqual([]);
  });

  it("sorts output for stable golden comparison", () => {
    const multi = schema("BRDM2", [
      comp("ZComponent", [["p", "1"]]),
      comp("AComponent", [["p", "1"]]),
    ]);
    expect(contrastVehicles(schema("S105", []), multi).onlyInB.map((e) => e.component)).toEqual([
      "AComponent",
      "ZComponent",
    ]);
  });
});
