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

  describe("property-level onlyInA/onlyInB", () => {
    const withExtraA = schema("S105", [
      comp("RigidBody", [
        ["Mass", "1200"],
        ["OnlyOnA", "civ"],
      ]),
    ]);
    const withExtraB = schema("BRDM2", [
      comp("RigidBody", [
        ["Mass", "1200"],
        ["OnlyOnB", "mil"],
      ]),
    ]);

    it("lists a property present on A's shared component but absent from B's as onlyInA", () => {
      const c = contrastVehicles(withExtraA, withExtraB);
      expect(c.onlyInA).toContainEqual(
        expect.objectContaining({ component: "RigidBody", propertyPath: "OnlyOnA" }),
      );
    });

    it("lists a property present on B's shared component but absent from A's as onlyInB", () => {
      const c = contrastVehicles(withExtraA, withExtraB);
      expect(c.onlyInB).toContainEqual(
        expect.objectContaining({ component: "RigidBody", propertyPath: "OnlyOnB" }),
      );
    });

    it("does not report a shared property with an identical value in onlyInA/onlyInB", () => {
      const c = contrastVehicles(withExtraA, withExtraB);
      const allEntries = [...c.onlyInA, ...c.onlyInB];
      expect(allEntries.find((e) => e.propertyPath === "Mass")).toBeUndefined();
    });

    it("keeps component-level entries (no propertyPath) distinct from property-level ones", () => {
      const c = contrastVehicles(a, b);
      // SCR_VehicleSoundComponent only exists on A entirely (no shared component) —
      // its onlyInA entry is component-level, not property-level.
      const componentLevel = c.onlyInA.find((e) => e.component === "SCR_VehicleSoundComponent");
      expect(componentLevel).toBeDefined();
      expect(componentLevel!.propertyPath).toBeUndefined();
    });
  });
});
