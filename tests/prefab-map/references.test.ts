import { describe, it, expect } from "vitest";
import { extractReferences, buildBoneSurface } from "../../src/prefab-map/references.js";
import type { ResolvedComponent } from "../../src/prefab-map/types.js";

function comp(typeName: string, props: [string, string][]): ResolvedComponent {
  return {
    typeName,
    introducedBy: "S105_base.et",
    properties: props.map(([path, value]) => ({
      path,
      value,
      setBy: "S105_base.et",
      overrides: [],
    })),
  };
}

describe("extractReferences", () => {
  it("classifies a PivotID as a bone reference", () => {
    const edges = extractReferences([
      comp("SCR_VehicleSoundComponent", [["Wheels.VehicleWheelSound[0].SoundPoint.PivotID", "v_wheel_l01"]]),
    ]);
    expect(edges).toEqual([
      {
        component: "SCR_VehicleSoundComponent",
        propertyPath: "Wheels.VehicleWheelSound[0].SoundPoint.PivotID",
        kind: "bone",
        target: "v_wheel_l01",
        setBy: "S105_base.et",
      },
    ]);
  });

  it("classifies a GUID-prefixed .et value as a prefab reference and strips the GUID", () => {
    const edges = extractReferences([
      comp("SlotManagerComponent", [["Slots.EntitySlotInfo[0].Prefab", "{ABCDEF0123456789}Prefabs/Vehicles/Wheeled/S105/VehParts/Wheels/S105_wheel_01.et"]]),
    ]);
    expect(edges[0].kind).toBe("prefab");
    expect(edges[0].target).toBe("Prefabs/Vehicles/Wheeled/S105/VehParts/Wheels/S105_wheel_01.et");
  });

  it("classifies asset extensions as resource references", () => {
    const edges = extractReferences([
      comp("MeshObject", [["Object", "{1111111111111111}Assets/Vehicles/S105/S105.xob"]]),
      comp("SCR_VehicleSoundComponent", [["Filenames.[value][0]", "{2222222222222222}Sounds/S105.acp"]]),
      comp("VehicleAnimationComponent", [["AnimationGraph", "{3333333333333333}Animation/S105.agf"]]),
    ]);
    expect(edges.map((e) => e.kind)).toEqual(["resource", "resource", "resource"]);
  });

  it("ignores a plain value that references nothing", () => {
    expect(extractReferences([comp("RigidBody", [["Mass", "1200"]])])).toEqual([]);
  });

  it("ignores an empty PivotID rather than emitting an empty bone", () => {
    const edges = extractReferences([comp("SlotManagerComponent", [["Slots.EntitySlotInfo[0].PivotID", ""]])]);
    expect(edges).toEqual([]);
  });

  it("keeps a shipped typo bone name verbatim", () => {
    const edges = extractReferences([
      comp("SCR_BaseCompartmentManagerComponent", [["Compartments.PointInfo[0].PivotID", "passangerL_idle"]]),
    ]);
    expect(edges[0].target).toBe("passangerL_idle");
  });
});

describe("buildBoneSurface", () => {
  it("dedups a bone and lists every referencing site", () => {
    const surface = buildBoneSurface([
      { component: "A", propertyPath: "p1", kind: "bone", target: "v_body", setBy: "Vehicle_Base.et" },
      { component: "B", propertyPath: "p2", kind: "bone", target: "v_body", setBy: "S105_base.et" },
      { component: "C", propertyPath: "p3", kind: "prefab", target: "x.et", setBy: "S105_base.et" },
    ]);
    expect(surface).toEqual([
      {
        bone: "v_body",
        sites: [
          { component: "A", propertyPath: "p1", setBy: "Vehicle_Base.et" },
          { component: "B", propertyPath: "p2", setBy: "S105_base.et" },
        ],
      },
    ]);
  });

  it("sorts bones by name for stable golden output", () => {
    const surface = buildBoneSurface([
      { component: "A", propertyPath: "p", kind: "bone", target: "v_wheel", setBy: "x.et" },
      { component: "A", propertyPath: "q", kind: "bone", target: "v_body", setBy: "x.et" },
    ]);
    expect(surface.map((s) => s.bone)).toEqual(["v_body", "v_wheel"]);
  });
});
