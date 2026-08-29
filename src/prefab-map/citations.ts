// src/prefab-map/citations.ts

/** The literal marker the doc generator emits when nothing can be cited. */
export const UNDOCUMENTED = "UNDOCUMENTED";

export interface Citation {
  source: "arma-classes" | null;
  className?: string;
  memberName?: string;
  description?: string;
}

export interface CitationIndex {
  forComponent(typeName: string): Citation;
  forProperty(typeName: string, propertyPath: string): Citation;
}

interface ApiProperty {
  name?: string;
  type?: string;
  description?: string;
}

interface ApiClass {
  name?: string;
  description?: string;
  properties?: ApiProperty[];
}

const NONE: Citation = { source: null };

function lastSegment(path: string): string {
  const dot = path.lastIndexOf(".");
  const seg = dot === -1 ? path : path.slice(dot + 1);
  return seg.replace(/\[\d+\]$/, "");
}

/** A description is only usable when it's a non-empty string. Empty-string
 * descriptions are extremely common in the real dump and must be treated
 * the same as a missing description — never cite blank text. */
function hasText(description: string | undefined): description is string {
  return typeof description === "string" && description.length > 0;
}

/**
 * Build a lookup from the local API class dump.
 *
 * `data/api/arma-classes.json` is a flat array of class objects (not an
 * object keyed by class name), each with a `name` and a `properties` array
 * of `{ name, type, description }`. Both class-level and property-level
 * `description` are frequently empty strings — those are treated as
 * undocumented, not cited with blank text.
 *
 * Coverage is expected to be lopsided: `SCR_*` script classes are more often
 * documented, engine-side components largely are not. A miss returns
 * `{ source: null }` so the doc generator can stamp UNDOCUMENTED. It must
 * never fall back to a plausible description — an invented explanation in
 * this map would be worse than a gap, because it would be trusted.
 */
export function buildCitationIndex(apiClasses: unknown): CitationIndex {
  const list: ApiClass[] = Array.isArray(apiClasses) ? apiClasses : [];
  const classes = new Map<string, ApiClass>();
  for (const entry of list) {
    if (entry && typeof entry.name === "string" && !classes.has(entry.name)) {
      classes.set(entry.name, entry);
    }
  }

  return {
    forComponent(typeName: string): Citation {
      const entry = classes.get(typeName);
      if (!entry || !hasText(entry.description)) return NONE;
      return {
        source: "arma-classes",
        className: typeName,
        description: entry.description,
      };
    },

    forProperty(typeName: string, propertyPath: string): Citation {
      const entry = classes.get(typeName);
      if (!entry?.properties) return NONE;
      const wanted = lastSegment(propertyPath);
      const member = entry.properties.find((m) => m.name === wanted);
      if (!member || !hasText(member.description)) return NONE;
      return {
        source: "arma-classes",
        className: typeName,
        memberName: member.name,
        description: member.description,
      };
    },
  };
}
