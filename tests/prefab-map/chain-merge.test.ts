import { describe, it, expect } from "vitest";
import { parse } from "../../src/formats/enfusion-text.js";
import { mergeChain, findSelfOverrides } from "../../src/prefab-map/chain-merge.js";
import type { ChainLevelInput, ResolvedComponent } from "../../src/prefab-map/types.js";

function level(path: string, ...comps: string[]): ChainLevelInput {
  return {
    path,
    components: comps.map((src) => {
      const node = parse(src);
      return { typeName: node.type, node };
    }),
  };
}

describe("mergeChain", () => {
  it("keeps the descendant's value and records what it shadowed", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 40 }`),
      level("S105_base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 60 }`),
    ]);
    const maxFuel = merged[0].properties.find((p) => p.path === "MaxFuel");
    expect(maxFuel).toEqual({
      path: "MaxFuel",
      value: "60",
      setBy: "S105_base.et",
      overrides: [{ value: "40", from: "Vehicle_Base.et" }],
    });
  });

  it("marks an untouched inherited property as set by the ancestor", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `SCR_FuelManagerComponent "{1}" { MaxFuel 40 }`),
      level("S105_base.et", `SCR_FuelManagerComponent "{1}" { FuelTankName "t" }`),
    ]);
    const maxFuel = merged[0].properties.find((p) => p.path === "MaxFuel");
    expect(maxFuel?.setBy).toBe("Vehicle_Base.et");
    expect(maxFuel?.overrides).toEqual([]);
  });

  it("records where a component was first introduced", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `MeshObject "{1}" { Object "a.xob" }`),
      level("BRDM2_base.et", `MeshObject "{1}" { Object "b.xob" }`, `SlotManagerComponent "{2}" { Slots {} }`),
    ]);
    const byName = Object.fromEntries(merged.map((c) => [c.typeName, c.introducedBy]));
    expect(byName["MeshObject"]).toBe("Vehicle_Base.et");
    expect(byName["SlotManagerComponent"]).toBe("BRDM2_base.et");
  });

  it("chains three levels of overrides in ancestor order", () => {
    const merged = mergeChain([
      level("Vehicle_Base.et", `RigidBody "{1}" { Mass 1000 }`),
      level("Wheeled_Base.et", `RigidBody "{1}" { Mass 1500 }`),
      level("S105_base.et", `RigidBody "{1}" { Mass 1200 }`),
    ]);
    const mass = merged[0].properties.find((p) => p.path === "Mass");
    expect(mass?.value).toBe("1200");
    expect(mass?.setBy).toBe("S105_base.et");
    expect(mass?.overrides).toEqual([
      { value: "1000", from: "Vehicle_Base.et" },
      { value: "1500", from: "Wheeled_Base.et" },
    ]);
  });

  it("records a same-file collision as an override attributed to that file", () => {
    // Two sibling blocks flattened to the same path within one level (the
    // exact shape of the sibling-collapse parser bug) — mergeChain has no way
    // to tell this apart from a real cross-level override, so it records one.
    // findSelfOverrides exists to catch this class of corruption.
    const merged = mergeChain([
      level("S105_base.et", `X "{1}" { CargoCompartmentSlot Passenger_r01 }`),
      level("S105_base.et", `X "{1}" { CargoCompartmentSlot Passenger_l02 }`),
    ]);
    const slot = merged[0].properties.find((p) => p.path === "CargoCompartmentSlot");
    expect(slot?.setBy).toBe("S105_base.et");
    expect(slot?.overrides).toEqual([{ value: "Passenger_r01", from: "S105_base.et" }]);
  });
});

describe("findSelfOverrides", () => {
  function comp(typeName: string, path: string, setBy: string, overrides: { value: string; from: string }[]): ResolvedComponent {
    return {
      typeName,
      introducedBy: setBy,
      properties: [{ path, value: "x", setBy, overrides }],
    };
  }

  it("finds nothing in a clean cross-level override chain", () => {
    const components = [
      comp("RigidBody", "Mass", "S105_base.et", [
        { value: "1000", from: "Vehicle_Base.et" },
        { value: "1500", from: "Wheeled_Base.et" },
      ]),
    ];
    expect(findSelfOverrides(components)).toEqual([]);
  });

  it("flags an override whose from matches the final setBy", () => {
    const components = [
      comp("X", "CargoCompartmentSlot", "S105_base.et", [
        { value: "Passenger_r01", from: "S105_base.et" },
      ]),
    ];
    expect(findSelfOverrides(components)).toEqual([
      { component: "X", path: "CargoCompartmentSlot", from: "S105_base.et" },
    ]);
  });

  it("flags a collision even when a later genuine override masks it", () => {
    // Two S105_base.et entries collided first (both attributed to
    // S105_base.et), then a later level legitimately overrode the result —
    // the final setBy no longer matches either shadowed entry, but the
    // history still contains "S105_base.et" twice.
    const components = [
      comp("X", "Slot", "Later_base.et", [
        { value: "first", from: "S105_base.et" },
        { value: "second", from: "S105_base.et" },
      ]),
    ];
    expect(findSelfOverrides(components)).toEqual([
      { component: "X", path: "Slot", from: "S105_base.et" },
    ]);
  });

  it("does not flag properties with no overrides", () => {
    const components = [comp("X", "Mass", "Vehicle_Base.et", [])];
    expect(findSelfOverrides(components)).toEqual([]);
  });
});
