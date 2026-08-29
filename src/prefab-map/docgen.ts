// src/prefab-map/docgen.ts
import { UNDOCUMENTED, type CitationIndex } from "./citations.js";
import type { VehicleSchema } from "./types.js";

export type ObservationKey = string;
export type Observations = Record<ObservationKey, string>;

const HEADER =
  "<!-- GENERATED FILE — do not edit by hand.\n" +
  "     Regenerate with: npm run build:prefab-map (scripts/build-prefab-map.ts).\n" +
  "     Hand-written in-engine findings belong in data/schema/observations.json,\n" +
  "     which is merged in at generation time and never overwritten. -->";

/**
 * Render one vehicle's derived map as KB markdown.
 *
 * Every entry is labeled with how it is known. Tier 1 is derived from the corpus,
 * tier 2 is cited to the API dump, tier 3 comes from the hand-maintained sidecar.
 * Anything with neither a citation nor an observation is stamped UNDOCUMENTED
 * rather than described from inference.
 */
export function generateVehicleDoc(
  schema: VehicleSchema,
  citations: CitationIndex,
  observations: Observations,
): string {
  const out: string[] = [];

  out.push(HEADER, "");
  out.push(`# ${schema.vehicle} Prefab Component Map`, "");
  out.push(`Root: \`${schema.rootPath}\``, "");
  out.push("Inheritance chain, oldest ancestor first:", "");
  for (const level of schema.chain) out.push(`1. \`${level}\``);
  out.push("");
  out.push(
    `${schema.components.length} components, ${schema.boneSurface.length} distinct bones referenced.`,
    "",
  );
  out.push(
    "Tier 1 entries are derived from the prefab files. Tier 2 entries cite the local " +
      "API dump. Tier 3 entries are in-engine observations. " +
      `Entries with neither a citation nor an observation are marked ${UNDOCUMENTED}.`,
    "",
  );

  out.push("## Components", "");
  for (const component of [...schema.components].sort((a, b) =>
    a.typeName < b.typeName ? -1 : 1,
  )) {
    out.push(`### ${component.typeName}`, "");
    out.push(`Introduced by \`${component.introducedBy}\`. (tier 1)`, "");

    const cite = citations.forComponent(component.typeName);
    const note = observations[component.typeName];
    if (cite.source !== null) out.push(`${cite.description} (tier 2, arma-classes)`, "");
    if (note !== undefined) out.push(`${note} (tier 3, observed)`, "");
    if (cite.source === null && note === undefined) out.push(`${UNDOCUMENTED}`, "");

    out.push("| Property | Value | Set by | Notes |", "|---|---|---|---|");
    for (const prop of [...component.properties].sort((a, b) => (a.path < b.path ? -1 : 1))) {
      const notes: string[] = [];
      if (prop.overrides.length > 0) {
        notes.push(`overrides ${prop.overrides.map((o) => o.value).join(", ")}`);
      }
      const pc = citations.forProperty(component.typeName, prop.path);
      if (pc.source !== null) notes.push(`${pc.description} (tier 2)`);
      const pn = observations[`${component.typeName}#${prop.path}`];
      if (pn !== undefined) notes.push(`${pn} (tier 3)`);
      if (notes.length === 0) notes.push(UNDOCUMENTED);
      out.push(
        `| \`${prop.path}\` | \`${prop.value}\` | \`${short(prop.setBy)}\` | ${notes.join("; ")} |`,
      );
    }
    out.push("");
  }

  out.push("## Bone surface", "");
  out.push("| Bone | Referenced from |", "|---|---|");
  for (const entry of schema.boneSurface) {
    const sites = entry.sites
      .map((s) => `${s.component} \`${s.propertyPath}\` (${short(s.setBy)})`)
      .join("<br>");
    out.push(`| \`${entry.bone}\` | ${sites} |`);
  }
  out.push("");

  return out.join("\n");
}

function short(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}
