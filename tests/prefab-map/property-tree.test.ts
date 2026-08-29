import { describe, it, expect } from "vitest";
import { parse } from "../../src/formats/enfusion-text.js";
import { flattenComponent } from "../../src/prefab-map/property-tree.js";

describe("flattenComponent", () => {
  it("flattens a flat component to dotted paths", () => {
    const node = parse(`SCR_FuelManagerComponent "{5622A70CD78A9E2C}" {
 MaxFuel 60
 FuelTankName "tank_main"
}`);
    expect(flattenComponent(node)).toEqual([
      { path: "MaxFuel", value: "60" },
      { path: "FuelTankName", value: "tank_main" },
    ]);
  });

  it("flattens nested blocks with dotted paths", () => {
    const node = parse(`SCR_VehicleSoundComponent "{55C2E66AD4EF2CA6}" {
 SoundPoints {
  SoundPointInfo Engine {
   Offset 0 1.5 -1.1
  }
 }
}`);
    const leaves = flattenComponent(node);
    expect(leaves).toContainEqual({
      path: "SoundPoints[0].SoundPointInfo[0].Offset",
      value: "0 1.5 -1.1",
      nodeType: "SoundPointInfo",
    });
  });

  it("indexes repeated sibling blocks of the same type", () => {
    const node = parse(`Wheels {
 VehicleWheelSound L_01 {
  SoundPoint PointInfo "{58F8DC78283E1FE5}" {
   PivotID "v_wheel_l01"
  }
 }
 VehicleWheelSound R_01 {
  SoundPoint PointInfo "{58F8DC78283E1FFD}" {
   PivotID "v_wheel_r01"
  }
 }
}`);
    const paths = flattenComponent(node).map((l) => l.path);
    expect(paths).toContain("VehicleWheelSound[0].SoundPoint[0].PivotID");
    expect(paths).toContain("VehicleWheelSound[1].SoundPoint[0].PivotID");
  });

  it("preserves a shipped typo in a bone name verbatim", () => {
    const node = parse(`PointInfo "{1}" {
 PivotID "passangerL_idle"
}`);
    expect(flattenComponent(node)[0].value).toBe("passangerL_idle");
  });

  it("records standalone quoted values under a [value] index", () => {
    const node = parse(`Filenames {
 "{994DA84C543C990A}Sounds/A.acp" "{5B2A3941F79B5F0F}Sounds/B.acp"
}`);
    const leaves = flattenComponent(node);
    expect(leaves.map((l) => l.path)).toEqual(["[value][0]", "[value][1]"]);
    expect(leaves[1].value).toBe("{5B2A3941F79B5F0F}Sounds/B.acp");
  });
});
