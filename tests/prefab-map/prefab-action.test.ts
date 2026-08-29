import { describe, it, expect } from "vitest";
import { formatDiffReport } from "../../src/prefab-map/diff.js";
import type { DiffReport } from "../../src/prefab-map/diff.js";

describe("formatDiffReport", () => {
  it("reports a clean result plainly", () => {
    const report: DiffReport = {
      danglingBones: [],
      inheritedUnadjusted: [],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("no dangling bone references");
  });

  it("lists each dangling bone with all its referencing sites", () => {
    const report: DiffReport = {
      danglingBones: [
        {
          bone: "v_door_L01_handle",
          sites: [
            { component: "ActionsManagerComponent", propertyPath: "a.PivotID", setBy: "S105_base.et" },
            { component: "SCR_VehicleSoundComponent", propertyPath: "b.PivotID", setBy: "S105_base.et" },
          ],
        },
      ],
      inheritedUnadjusted: [],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("v_door_L01_handle");
    expect(text).toContain("ActionsManagerComponent");
    expect(text).toContain("SCR_VehicleSoundComponent");
    expect(text).toContain("2 site");
  });

  it("calls out inherited-but-unadjusted bones as the donor-rig case", () => {
    const report: DiffReport = {
      danglingBones: [
        { bone: "v_wheel_l01", sites: [{ component: "A", propertyPath: "p", setBy: "S105_base.et" }] },
      ],
      inheritedUnadjusted: [
        {
          bone: "v_wheel_l01",
          setBy: "S105_base.et",
          sites: [{ component: "A", propertyPath: "p", setBy: "S105_base.et" }],
        },
      ],
      unreferencedRigBones: [],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toMatch(/inherited/i);
    expect(text).toContain("S105_base.et");
  });

  it("reports unreferenced rig bones as informational", () => {
    const report: DiffReport = {
      danglingBones: [],
      inheritedUnadjusted: [],
      unreferencedRigBones: ["deform_spine"],
    };
    const text = formatDiffReport(report, "Opel");
    expect(text).toContain("deform_spine");
    expect(text).toMatch(/informational|may be legitimate/i);
  });
});
