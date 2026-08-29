import { describe, it, expect } from "vitest";
import { buildCitationIndex, UNDOCUMENTED } from "../../src/prefab-map/citations.js";

// Real data/api/arma-classes.json shape: a flat array of class objects, not an
// object keyed by class name. Property list is `properties`, not `members`.
// Both class-level and property-level `description` are frequently "".
const api = [
  {
    name: "SCR_FuelManagerComponent",
    description: "Manages vehicle fuel tanks.",
    properties: [{ name: "MaxFuel", type: "float", description: "Maximum fuel in litres." }],
  },
  {
    name: "VehicleWheeledSimulation",
    description: "",
    properties: [],
  },
  {
    name: "SCR_UndescribedProperty",
    description: "Has a property with no description.",
    properties: [{ name: "SecretField", type: "int", description: "" }],
  },
];

describe("buildCitationIndex", () => {
  const index = buildCitationIndex(api);

  it("cites a documented component", () => {
    expect(index.forComponent("SCR_FuelManagerComponent")).toEqual({
      source: "arma-classes",
      className: "SCR_FuelManagerComponent",
      description: "Manages vehicle fuel tanks.",
    });
  });

  it("cites a documented property by its last path segment", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "MaxFuel")).toEqual({
      source: "arma-classes",
      className: "SCR_FuelManagerComponent",
      memberName: "MaxFuel",
      description: "Maximum fuel in litres.",
    });
  });

  it("matches a nested property path on its final segment", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "Tanks.Tank[0].MaxFuel").memberName).toBe(
      "MaxFuel",
    );
  });

  it("returns a null-source citation for a class present but with an empty description", () => {
    expect(index.forComponent("VehicleWheeledSimulation").source).toBeNull();
  });

  it("returns a null-source citation for a class absent from the dump", () => {
    expect(index.forComponent("BaseVehicleNodeComponent").source).toBeNull();
  });

  it("returns a null-source citation for an undocumented property", () => {
    expect(index.forProperty("SCR_FuelManagerComponent", "OtherField").source).toBeNull();
  });

  it("returns a null-source citation for a property with an empty description", () => {
    expect(index.forProperty("SCR_UndescribedProperty", "SecretField").source).toBeNull();
  });

  it("exports the exact marker string the doc generator must emit", () => {
    expect(UNDOCUMENTED).toBe("UNDOCUMENTED");
  });
});
