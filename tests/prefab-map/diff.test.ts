import { describe, it, expect } from "vitest";
import { diffAgainstRig } from "../../src/prefab-map/diff.js";
import type { VehicleSchema } from "../../src/prefab-map/types.js";

function schema(bones: { bone: string; sites: { component: string; propertyPath: string; setBy: string }[] }[]): VehicleSchema {
  return {
    vehicle: "Opel",
    rootPath: "Opel.et",
    chain: ["Prefabs/Vehicles/Wheeled/S105/S105_base.et", "Opel.et"],
    components: [],
    references: [],
    boneSurface: bones,
    unparsed: [],
  };
}

describe("diffAgainstRig", () => {
  it("reports a bone the rig does not have, with every referencing site", () => {
    const s = schema([
      {
        bone: "v_door_L01_handle",
        sites: [
          { component: "ActionsManagerComponent", propertyPath: "a.PivotID", setBy: "S105_base.et" },
          { component: "SCR_VehicleSoundComponent", propertyPath: "b.PivotID", setBy: "S105_base.et" },
        ],
      },
    ]);
    const report = diffAgainstRig(s, ["v_body"]);
    expect(report.danglingBones).toHaveLength(1);
    expect(report.danglingBones[0].bone).toBe("v_door_L01_handle");
    expect(report.danglingBones[0].sites).toHaveLength(2);
  });

  it("reports nothing dangling when every bone resolves", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["v_body"]).danglingBones).toEqual([]);
  });

  it("flags a dangling bone still attributed to an ancestor as inherited-but-unadjusted", () => {
    const s = schema([
      {
        bone: "v_wheel_l01",
        sites: [{ component: "A", propertyPath: "p", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" }],
      },
    ]);
    const report = diffAgainstRig(s, ["wheel_front_left"], { leafPath: "Opel.et" });
    expect(report.inheritedUnadjusted).toEqual([
      {
        bone: "v_wheel_l01",
        setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et",
        sites: [{ component: "A", propertyPath: "p", setBy: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" }],
      },
    ]);
  });

  it("does not flag a dangling bone the leaf itself set as inherited", () => {
    const s = schema([
      { bone: "typo_bone", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    const report = diffAgainstRig(s, ["v_body"], { leafPath: "Opel.et" });
    expect(report.danglingBones).toHaveLength(1);
    expect(report.inheritedUnadjusted).toEqual([]);
  });

  it("lists rig bones nothing references", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["v_body", "deform_spine"]).unreferencedRigBones).toEqual([
      "deform_spine",
    ]);
  });

  it("refuses an empty rig instead of reporting every bone dangling", () => {
    const s = schema([
      { bone: "v_body", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(() => diffAgainstRig(s, [])).toThrow(/rig bone list is empty/i);
  });

  it("matches bone names case-sensitively and verbatim", () => {
    const s = schema([
      { bone: "passangerL_idle", sites: [{ component: "A", propertyPath: "p", setBy: "Opel.et" }] },
    ]);
    expect(diffAgainstRig(s, ["passengerL_idle"]).danglingBones).toHaveLength(1);
    expect(diffAgainstRig(s, ["passangerL_idle"]).danglingBones).toEqual([]);
  });
});
