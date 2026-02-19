export interface StringTableEntry {
  /** String key e.g. "STR_MyMod_FactionName" */
  key: string;
  /** English (original) text */
  original: string;
}

export interface StringTableOptions {
  /** Mod/package name */
  modName: string;
  /** String entries */
  entries: StringTableEntry[];
}

/**
 * Generate an Enfusion .st string table file (XML format).
 */
export function generateStringTable(opts: StringTableOptions): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<StringTable>");
  lines.push(`\t<Package Name="${escapeXml(opts.modName)}">`);

  for (const entry of opts.entries) {
    lines.push(`\t\t<Key Id="${escapeXml(entry.key)}">`);
    lines.push(`\t\t\t<Original>${escapeXml(entry.original)}</Original>`);
    lines.push("\t\t</Key>");
  }

  lines.push("\t</Package>");
  lines.push("</StringTable>");
  lines.push("");

  return lines.join("\n");
}

/**
 * Derive a string table key from mod name, context, and label.
 * e.g. deriveStringKey("MyMod", "Faction", "Name") => "STR_MyMod_Faction_Name"
 */
export function deriveStringKey(
  modName: string,
  context: string,
  label: string
): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "");
  return `STR_${clean(modName)}_${clean(context)}_${clean(label)}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
