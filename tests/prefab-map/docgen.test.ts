import { describe, it, expect } from "vitest";
import { generateVehicleDoc } from "../../src/prefab-map/docgen.js";
import { buildCitationIndex, UNDOCUMENTED } from "../../src/prefab-map/citations.js";
import type { VehicleSchema } from "../../src/prefab-map/types.js";

const schema: VehicleSchema = {
  vehicle: "S105",
  rootPath: "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
  chain: ["Prefabs/Vehicles/Core/Vehicle_Base.et", "Prefabs/Vehicles/Wheeled/S105/S105_base.et"],
  components: [
    {
      typeName: "SCR_FuelManagerComponent",
      introducedBy: "Prefabs/Vehicles/Core/Vehicle_Base.et",
      properties: [
        { path: "MaxFuel", value: "60", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et", overrides: [{ value: "40", from: "Prefabs/Vehicles/Core/Vehicle_Base.et" }] },
      ],
    },
    {
      typeName: "VehicleWheeledSimulation",
      introducedBy: "Prefabs/Vehicles/Core/Vehicle_Base.et",
      properties: [
        { path: "Wheels.Wheel[0].PivotID", value: "v_wheel_l01", setBy: "Prefabs/Vehicles/Core/Vehicle_Base.et", overrides: [] },
      ],
    },
  ],
  references: [],
  boneSurface: [
    { bone: "v_wheel_l01", sites: [{ component: "VehicleWheeledSimulation", propertyPath: "Wheels.Wheel[0].PivotID", setBy: "Prefabs/Vehicles/Core/Vehicle_Base.et" }] },
  ],
  unparsed: [],
};

// buildCitationIndex (Task 7) consumes the real arma-classes.json shape: a flat
// array of class objects with a `properties` array, not an object keyed by class
// name with `members`.
const citations = buildCitationIndex([
  {
    name: "SCR_FuelManagerComponent",
    description: "Manages vehicle fuel tanks.",
    properties: [{ name: "MaxFuel", description: "Maximum fuel in litres." }],
  },
]);

describe("generateVehicleDoc", () => {
  it("marks the file as generated and names its generator", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("<!-- GENERATED FILE — do not edit by hand.");
    expect(doc).toContain("scripts/build-prefab-map.ts");
  });

  it("stamps UNDOCUMENTED on a component with no citation", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    const section = doc.slice(doc.indexOf("### VehicleWheeledSimulation"));
    expect(section).toContain(UNDOCUMENTED);
  });

  it("does not stamp UNDOCUMENTED on a cited component", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    const section = doc.slice(
      doc.indexOf("### SCR_FuelManagerComponent"),
      doc.indexOf("### VehicleWheeledSimulation"),
    );
    expect(section).toContain("Manages vehicle fuel tanks.");
    expect(section).not.toContain(UNDOCUMENTED);
  });

  it("shows which chain level set an overridden property and what it shadowed", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("S105_base.et");
    expect(doc).toContain("overrides 40");
  });

  it("merges a tier-3 observation into the matching property", () => {
    const doc = generateVehicleDoc(schema, citations, {
      "VehicleWheeledSimulation#Wheels.Wheel[0].PivotID":
        "Wrong value here leaves the wheel un-animated with no error.",
    });
    expect(doc).toContain("Wrong value here leaves the wheel un-animated with no error.");
  });

  it("merges a component-level observation", () => {
    const doc = generateVehicleDoc(schema, citations, {
      VehicleWheeledSimulation: "Engine-side; not scriptable.",
    });
    expect(doc).toContain("Engine-side; not scriptable.");
  });

  it("ignores the sidecar README key", () => {
    const doc = generateVehicleDoc(schema, citations, { _README: "housekeeping note" });
    expect(doc).not.toContain("housekeeping note");
  });

  it("lists the bone surface with every referencing site", () => {
    const doc = generateVehicleDoc(schema, citations, {});
    expect(doc).toContain("v_wheel_l01");
    expect(doc).toContain("Wheels.Wheel[0].PivotID");
  });

  it("is deterministic across runs", () => {
    expect(generateVehicleDoc(schema, citations, {})).toBe(
      generateVehicleDoc(schema, citations, {}),
    );
  });

  it("stamps UNDOCUMENTED on an overridden property with no citation or observation", () => {
    // Regression: the override note must not suppress the UNDOCUMENTED stamp.
    // A property can have overrides AND be undocumented at the same time — both
    // facts are real and must both appear.
    const overriddenUncitedSchema: VehicleSchema = {
      ...schema,
      components: [
        {
          typeName: "VehicleWheeledSimulation",
          introducedBy: "Prefabs/Vehicles/Core/Vehicle_Base.et",
          properties: [
            {
              path: "SomeEngineOnlyField",
              value: "1",
              setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
              overrides: [{ value: "0", from: "Prefabs/Vehicles/Core/Vehicle_Base.et" }],
            },
          ],
        },
      ],
    };
    const doc = generateVehicleDoc(overriddenUncitedSchema, citations, {});
    const row = doc
      .split("\n")
      .find((line) => line.includes("SomeEngineOnlyField"));
    expect(row).toBeDefined();
    expect(row).toContain("overrides 0");
    expect(row).toContain(UNDOCUMENTED);
  });
});
