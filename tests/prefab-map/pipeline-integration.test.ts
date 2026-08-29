// tests/prefab-map/pipeline-integration.test.ts
// Runs the real pipeline (extract -> diff -> format) against the committed
// fixture corpus, end to end, instead of hand-built synthetic fixtures.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractVehicle } from "../../src/prefab-map/extract.js";
import { diffAgainstRig, formatDiffReport } from "../../src/prefab-map/diff.js";
import type { Config } from "../../src/config.js";

const FIXTURES = resolve(__dirname, "../fixtures/prefab-map");

/** Read fixtures instead of the developer's live extracted directory. */
function fixtureReader(path: string): string | null {
  const full = join(FIXTURES, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

const config = {} as unknown as Config;

describe("pipeline: extract -> diff -> format (real S105 fixture)", () => {
  const schema = extractVehicle("Prefabs/Vehicles/Wheeled/S105/S105_base.et", config, {
    readFile: fixtureReader,
  });

  it("has enough real bones to build a deliberately-incomplete rig list", () => {
    expect(schema.boneSurface.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a real bone omitted from the rig list as dangling, with real sites", () => {
    // Take the first 4 real bones as a stand-in "rig", but deliberately drop
    // one of them so it's genuinely missing from the rig — the dangling case.
    const sample = schema.boneSurface.slice(0, 4);
    const omitted = sample[0];
    const rigBoneNames = sample.slice(1).map((b) => b.bone);

    const report = diffAgainstRig(schema, rigBoneNames, { leafPath: schema.rootPath });

    const dangling = report.danglingBones.find((d) => d.bone === omitted.bone);
    expect(dangling).toBeDefined();
    expect(dangling!.sites.length).toBeGreaterThan(0);
    // Sites must be the real ones from the fixture corpus, not fabricated.
    expect(dangling!.sites).toEqual(omitted.sites);
    for (const site of dangling!.sites) {
      expect(typeof site.component).toBe("string");
      expect(site.component.length).toBeGreaterThan(0);
      expect(typeof site.propertyPath).toBe("string");
      expect(site.propertyPath.length).toBeGreaterThan(0);
    }

    const text = formatDiffReport(report, schema.vehicle);
    expect(text).toContain(omitted.bone);
    expect(text).toContain(dangling!.sites[0].component);
  });

  it("does not flag a bone that IS present in the rig list", () => {
    const sample = schema.boneSurface.slice(0, 4);
    const rigBoneNames = sample.map((b) => b.bone);

    const report = diffAgainstRig(schema, rigBoneNames, { leafPath: schema.rootPath });

    for (const b of sample) {
      expect(report.danglingBones.find((d) => d.bone === b.bone)).toBeUndefined();
    }
  });
});
