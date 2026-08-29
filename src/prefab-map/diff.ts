// src/prefab-map/diff.ts
import type { BoneSite, VehicleSchema } from "./types.js";

export interface DanglingBone {
  bone: string;
  sites: BoneSite[];
}

export interface InheritedUnadjusted {
  bone: string;
  setBy: string;
  sites: BoneSite[];
}

export interface DiffReport {
  danglingBones: DanglingBone[];
  inheritedUnadjusted: InheritedUnadjusted[];
  unreferencedRigBones: string[];
}

export interface DiffOptions {
  /** The leaf prefab's own path, used to tell inherited values from local ones. */
  leafPath?: string;
}

/**
 * Check a prefab's bone surface against the bones its rig actually has.
 *
 * Bone names are compared verbatim and case-sensitively. The engine does not
 * fuzzy-match, and neither does this: `passanger` and `passenger` are different
 * bones, and a check that quietly accepted both would hide the exact defect this
 * exists to find.
 */
export function diffAgainstRig(
  schema: VehicleSchema,
  boneNames: string[],
  opts: DiffOptions = {},
): DiffReport {
  if (boneNames.length === 0) {
    throw new Error(
      "Refusing to diff: the rig bone list is empty. Every reference would be " +
        "reported dangling. Check the mesh's .txo is readable (loadMeshContract).",
    );
  }

  const rig = new Set(boneNames);
  const referenced = new Set(schema.boneSurface.map((b) => b.bone));
  const leaf = opts.leafPath;

  const danglingBones: DanglingBone[] = [];
  const inheritedUnadjusted: InheritedUnadjusted[] = [];

  for (const entry of schema.boneSurface) {
    if (rig.has(entry.bone)) continue;
    danglingBones.push({ bone: entry.bone, sites: entry.sites });

    if (leaf === undefined) continue;
    // A dangling bone whose value came from an ancestor is the donor-rig case:
    // the prefab was duplicated and this reference was never repointed.
    const inheritedSites = entry.sites.filter((s) => s.setBy !== leaf);
    if (inheritedSites.length === entry.sites.length && inheritedSites.length > 0) {
      inheritedUnadjusted.push({
        bone: entry.bone,
        setBy: inheritedSites[0].setBy,
        sites: entry.sites,
      });
    }
  }

  return {
    danglingBones,
    inheritedUnadjusted,
    unreferencedRigBones: boneNames.filter((b) => !referenced.has(b)),
  };
}

/** Render a diff report as the text an MCP client shows the user. */
export function formatDiffReport(report: DiffReport, vehicle: string): string {
  const lines: string[] = [`Bone reference check: ${vehicle}`, ""];

  if (report.danglingBones.length === 0) {
    lines.push("OK — no dangling bone references. Every referenced bone exists on the rig.");
  } else {
    lines.push(
      `${report.danglingBones.length} dangling bone reference(s) — these name bones the rig ` +
        `does not have. The engine will not error; the affected feature silently does nothing.`,
      "",
    );
    for (const d of report.danglingBones) {
      lines.push(`  ${d.bone} — ${d.sites.length} site(s):`);
      for (const s of d.sites) {
        lines.push(`    ${s.component} ${s.propertyPath} (set by ${s.setBy})`);
      }
    }
  }

  if (report.inheritedUnadjusted.length > 0) {
    lines.push(
      "",
      `${report.inheritedUnadjusted.length} of those are inherited and never repointed — ` +
        `the donor's value survived the duplication:`,
      "",
    );
    for (const i of report.inheritedUnadjusted) {
      lines.push(`  ${i.bone} — still set by ${i.setBy}`);
    }
  }

  if (report.unreferencedRigBones.length > 0) {
    lines.push(
      "",
      `${report.unreferencedRigBones.length} rig bone(s) nothing references (informational — ` +
        `deform-only bones are legitimately unreferenced):`,
      `  ${report.unreferencedRigBones.join(", ")}`,
    );
  }

  return lines.join("\n");
}
