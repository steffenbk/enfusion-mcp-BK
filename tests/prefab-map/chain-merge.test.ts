import { describe, it, expect } from "vitest";
import { parse } from "../../src/formats/enfusion-text.js";
import { mergeChain } from "../../src/prefab-map/chain-merge.js";
import type { ChainLevelInput } from "../../src/prefab-map/types.js";

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
});
