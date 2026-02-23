import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  ClassInfo,
  MethodInfo,
  ParamInfo,
  EnumInfo,
  EnumValue,
  PropertyInfo,
  GroupInfo,
  HierarchyNode,
  WikiPage,
} from "../index/types.js";

/**
 * Parse the annotated.html (class list) page.
 * Returns an array of {name, url, brief} for each class.
 */
export function parseAnnotatedPage(
  html: string
): Array<{ name: string; url: string; brief: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ name: string; url: string; brief: string }> = [];

  $("table.directory tr").each((_i, row) => {
    const $row = $(row);
    const link = $row.find("td.entry a.el");
    if (!link.length) return;

    const name = link.text().trim();
    const url = link.attr("href") || "";
    const brief = $row.find("td.desc").text().trim();

    if (name && url) {
      results.push({ name, url, brief });
    }
  });

  return results;
}

/**
 * Parse a single class/interface detail page (interface[Name].html).
 */
export function parseClassPage(
  html: string,
  source: "enfusion" | "arma",
  filename: string
): ClassInfo {
  const $ = cheerio.load(html);

  // Extract class name from title (remove child elements like ingroups first)
  const titleDiv = $("div.headertitle div.title").first().clone();
  titleDiv.children().remove();
  const titleText = titleDiv.text().trim();
  const name = titleText
    .replace(/\s*Interface Reference\s*$/, "")
    .replace(/\s*Class Reference\s*$/, "")
    .trim();

  // Extract group from ingroups div
  const group = $("div.ingroups a.el").first().text().trim();

  // Extract brief description - the first paragraph after the content div
  const brief = $("div.contents > p").first().text().trim();

  // Extract detailed description
  const detailSection = $("div.textblock");
  const description = detailSection.length
    ? detailSection
        .map((_i, el) => $(el).text().trim())
        .get()
        .join("\n\n")
    : "";

  // Extract inheritance from the image map
  const parents: string[] = [];
  const children: string[] = [];

  try {
  // Doxygen inheritance diagrams use (x, y) coords in the image map.
  // The subject class is NOT in the map. Items above it (lower y) with
  // the same x-position are ancestors. Items below with the same or
  // adjacent x-position are direct children. Items at higher x are
  // grandchildren.
  //
  // Strategy: collect all areas with their coords, find the y-gap
  // where the subject class sits, then classify above=parents, below=children.
  // Only include items at x=0 column as direct relationships; deeper-x items
  // are indirect descendants we skip.
  const mapAreas = $("map area");
  if (mapAreas.length > 0) {
    const entries: Array<{ alt: string; x1: number; y1: number }> = [];
    mapAreas.each((_i, area) => {
      const alt = $(area).attr("alt") || "";
      const coords = $(area).attr("coords") || "";
      if (!alt || alt === name) return;
      const parts = coords.split(",").map(Number);
      if (parts.length >= 4) {
        entries.push({ alt, x1: parts[0], y1: parts[1] });
      }
    });

    if (entries.length > 0) {
      // Sort by y position
      entries.sort((a, b) => a.y1 - b.y1);

      // Find the y-gap: the subject class is NOT in the map. All areas
      // are either ancestors (above) or descendants (below). We find
      // the largest y-gap between consecutive entries to locate the split.
      let gapY = -1;

      if (entries.length === 1) {
        // Single entry: if y is 0, it's a parent. Otherwise child.
        if (entries[0].y1 === 0) {
          parents.push(entries[0].alt);
        } else {
          children.push(entries[0].alt);
        }
      } else {
        // Find the largest gap between consecutive entries
        let maxGap = 0;
        let splitIdx = 0;
        for (let i = 1; i < entries.length; i++) {
          const gap = entries[i].y1 - entries[i - 1].y1;
          if (gap > maxGap) {
            maxGap = gap;
            splitIdx = i;
          }
        }

        // The gap is between entries[splitIdx-1] and entries[splitIdx]
        gapY = (entries[splitIdx - 1].y1 + entries[splitIdx].y1) / 2;

        // Find the minimum x-position among entries below the gap
        const belowEntries = entries.filter((e) => e.y1 > gapY);
        const minChildX = belowEntries.length > 0
          ? Math.min(...belowEntries.map((e) => e.x1))
          : 0;

        for (const entry of entries) {
          if (entry.y1 < gapY) {
            parents.push(entry.alt);
          } else {
            // Only include direct children (same x-column)
            if (entry.x1 <= minChildX + 10) {
              children.push(entry.alt);
            }
          }
        }
      }
    }
  }
  } catch {
    // Inheritance diagram parsing is best-effort; some classes have
    // unusual map structures that don't conform to the expected pattern.
  }

  // Parse public member functions
  const methods = parseMemberTable($, "pub-methods");

  // Parse protected member functions
  const protectedMethods = parseMemberTable($, "pro-methods");

  // Parse static member functions
  const staticMethods = parseMemberTable($, "pub-static-methods");

  // Parse public member variables (attributes)
  const properties = parsePropertyTable($, "pub-attribs");

  // Parse protected member variables
  const protectedProperties = parsePropertyTable($, "pro-attribs");

  // Parse static public attributes (constants, enum values in Enfusion)
  const staticAttribs = parsePropertyTable($, "pub-static-attribs");
  // Merge static attribs into properties
  properties.push(...staticAttribs);

  // Parse enum types (standard Doxygen pub-types — rare in Enfusion)
  const enums = parseEnumSection($);

  // Enhance method descriptions with detailed docs
  enrichMethodDescriptions($, methods);
  enrichMethodDescriptions($, protectedMethods);
  enrichMethodDescriptions($, staticMethods);

  // Extract source file if available
  const sourceFile = extractSourceFile($);

  // Build docs URL
  const docsUrl = `https://community.bistudio.com/wikidata/external-data/arma-reforger/${
    source === "enfusion"
      ? "EnfusionScriptAPIPublic"
      : "ArmaReforgerScriptAPIPublic"
  }/${filename}`;

  return {
    name,
    source,
    brief,
    description,
    parents,
    children,
    group,
    sourceFile,
    methods,
    protectedMethods,
    staticMethods,
    enums,
    properties,
    protectedProperties,
    docsUrl,
  };
}

function parseMemberTable(
  $: cheerio.CheerioAPI,
  sectionId: string
): MethodInfo[] {
  const methods: MethodInfo[] = [];

  // Find the heading row for this section
  const headingAnchor = $(`a#${sectionId}`);
  if (!headingAnchor.length) return methods;

  // Walk through sibling rows after the heading
  const table = headingAnchor.closest("table.memberdecls");
  if (!table.length) return methods;

  let inSection = false;

  table.find("tr").each((_i, row) => {
    const $row = $(row);
    const rowClass = $row.attr("class") || "";

    // Detect section start
    if (rowClass === "heading") {
      const anchor = $row.find(`a#${sectionId}`);
      if (anchor.length) {
        inSection = true;
        return;
      }
      // Different heading = new section, stop
      if (inSection) {
        inSection = false;
        return false; // break
      }
      return;
    }

    if (!inSection) return;

    // Parse memitem rows
    if (rowClass.startsWith("memitem:")) {
      const returnType = $row.find("td.memItemLeft").text().trim();
      const rightCell = $row.find("td.memItemRight");
      const nameLink = rightCell.find("a.el");
      const methodName = nameLink.text().trim();

      if (!methodName) return;

      // Get full text including params from the right cell
      const fullRight = rightCell.text().trim();
      const signature = `${returnType} ${fullRight}`.replace(/\s+/g, " ").trim();

      // Parse params from the signature text
      const params = parseParamsFromSignature(fullRight);

      // Get description from next memdesc row
      const hash = rowClass.split(":")[1];
      const descRow = table.find(`tr.memdesc\\:${hash}`);
      const desc = descRow.find("td.mdescRight").text().trim();

      methods.push({
        name: methodName,
        returnType,
        signature,
        params,
        description: desc,
      });
    }
  });

  return methods;
}

function parseParamsFromSignature(
  sigText: string
): ParamInfo[] {
  const params: ParamInfo[] = [];

  // Extract content between parentheses
  const parenMatch = sigText.match(/\(([^)]*)\)/);
  if (!parenMatch || !parenMatch[1].trim()) return params;

  const paramStr = parenMatch[1].trim();
  if (!paramStr) return params;

  // Split by commas (simple split — doesn't handle nested generics)
  const parts = paramStr.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Handle default values (e.g., "EAddChildFlags flags = EAddChildFlags.AUTO_TRANSFORM")
    let defaultValue = "";
    let mainPart = trimmed;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      defaultValue = trimmed.slice(eqIdx + 1).trim();
      mainPart = trimmed.slice(0, eqIdx).trim();
    }

    // Split into type and name — last token is name, rest is type
    const tokens = mainPart.split(/\s+/);
    if (tokens.length >= 2) {
      const paramName = tokens[tokens.length - 1];
      const paramType = tokens.slice(0, -1).join(" ");
      params.push({ name: paramName, type: paramType, defaultValue });
    } else if (tokens.length === 1) {
      // Just a type with no name (rare but possible)
      params.push({ name: "", type: tokens[0], defaultValue });
    }
  }

  return params;
}

/**
 * Parse a member variable (attribute) table section.
 * Attributes have the same row structure as methods but without parenthesized params.
 * Section IDs: "pub-attribs", "pro-attribs"
 */
function parsePropertyTable(
  $: cheerio.CheerioAPI,
  sectionId: string
): PropertyInfo[] {
  const properties: PropertyInfo[] = [];

  const headingAnchor = $(`a#${sectionId}`);
  if (!headingAnchor.length) return properties;

  const table = headingAnchor.closest("table.memberdecls");
  if (!table.length) return properties;

  let inSection = false;

  table.find("tr").each((_i, row) => {
    const $row = $(row);
    const rowClass = $row.attr("class") || "";

    if (rowClass === "heading") {
      const anchor = $row.find(`a#${sectionId}`);
      if (anchor.length) {
        inSection = true;
        return;
      }
      if (inSection) {
        inSection = false;
        return false; // break
      }
      return;
    }

    if (!inSection) return;

    if (rowClass.startsWith("memitem:")) {
      const propType = $row.find("td.memItemLeft").text().trim();
      const rightCell = $row.find("td.memItemRight");
      const nameLink = rightCell.find("a.el");
      const propName = nameLink.text().trim() || rightCell.text().trim();

      if (!propName) return;

      // Get description from memdesc row
      const hash = rowClass.split(":")[1];
      const descRow = table.find(`tr.memdesc\\:${hash}`);
      const desc = descRow.find("td.mdescRight").text().trim();

      properties.push({
        name: propName,
        type: propType,
        description: desc,
      });
    }
  });

  return properties;
}

/**
 * Parse enum type definitions from the pub-types section and their detail docs.
 * Doxygen lists enum names in the pub-types member table, and their values
 * appear in detail sections with <table class="fieldtable"> or <dl> lists.
 */
function parseEnumSection($: cheerio.CheerioAPI): EnumInfo[] {
  const enums: EnumInfo[] = [];

  // Look for pub-types section (could also be pro-types)
  for (const sectionId of ["pub-types", "pro-types"]) {
    const headingAnchor = $(`a#${sectionId}`);
    if (!headingAnchor.length) continue;

    const table = headingAnchor.closest("table.memberdecls");
    if (!table.length) continue;

    let inSection = false;

    table.find("tr").each((_i, row) => {
      const $row = $(row);
      const rowClass = $row.attr("class") || "";

      if (rowClass === "heading") {
        const anchor = $row.find(`a#${sectionId}`);
        if (anchor.length) {
          inSection = true;
          return;
        }
        if (inSection) {
          inSection = false;
          return false; // break
        }
        return;
      }

      if (!inSection) return;

      if (rowClass.startsWith("memitem:")) {
        const leftText = $row.find("td.memItemLeft").text().trim();
        const rightCell = $row.find("td.memItemRight");
        const nameLink = rightCell.find("a.el");
        const enumName = nameLink.text().trim();

        // Only process enum types (skip typedefs, classes)
        if (!enumName || !leftText.includes("enum")) return;

        const hash = rowClass.split(":")[1];

        // Get brief description
        const descRow = table.find(`tr.memdesc\\:${hash}`);
        const desc = descRow.find("td.mdescRight").text().trim();

        // Try to parse enum values from the right cell text
        // Doxygen often shows: EnumName { VAL1, VAL2, VAL3 }
        const values = parseEnumValuesFromBrief($, hash, rightCell.text());

        enums.push({
          name: enumName,
          description: desc,
          values,
        });
      }
    });
  }

  return enums;
}

/**
 * Parse enum values. First tries the detailed documentation section (fieldtable),
 * then falls back to parsing the inline { VAL1, VAL2 } text from the member table.
 */
function parseEnumValuesFromBrief(
  $: cheerio.CheerioAPI,
  memberHash: string,
  briefText: string
): EnumValue[] {
  const values: EnumValue[] = [];

  // Strategy 1: Look for detailed documentation with fieldtable
  // Doxygen puts enum detail in a memdoc div keyed by the member anchor hash
  const detailAnchor = $(`a#${memberHash}`).closest("div.memdoc");
  // Fallback: try memtitle sibling
  const memtitle = $(`a[id="${memberHash}"]`).closest("h2.memtitle");
  const memdoc = detailAnchor.length
    ? detailAnchor
    : memtitle.next("div.memdoc");

  if (memdoc.length) {
    const fieldTable = memdoc.find("table.fieldtable");
    if (fieldTable.length) {
      fieldTable.find("tr").each((_i, tr) => {
        const $tr = $(tr);
        const cells = $tr.find("td");
        if (cells.length >= 1) {
          // First cell: enum value name (often contains an anchor + name)
          const valName = cells.eq(0).find("em").text().trim()
            || cells.eq(0).text().trim();
          const valDesc = cells.length >= 2 ? cells.eq(1).text().trim() : "";

          if (valName && valName !== "Enumerator") {
            values.push({ name: valName, value: "", description: valDesc });
          }
        }
      });
      if (values.length > 0) return values;
    }

    // Also try <dl> definition lists (alternative Doxygen format)
    const dl = memdoc.find("dl");
    if (dl.length) {
      let currentName = "";
      dl.find("dt").each((_i, dt) => {
        currentName = $(dt).find("em").text().trim() || $(dt).text().trim();
        const dd = $(dt).next("dd");
        if (dd.length && currentName) {
          values.push({ name: currentName, value: "", description: dd.text().trim() });
          currentName = "";
        }
      });
      if (values.length > 0) return values;
    }
  }

  // Strategy 2: Parse the inline enum { VAL1, VAL2 } text from member table
  const braceMatch = briefText.match(/\{([^}]*)\}/);
  if (braceMatch) {
    const valStr = braceMatch[1];
    const parts = valStr.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle "NAME = value" assignments
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        values.push({
          name: trimmed.slice(0, eqIdx).trim(),
          value: trimmed.slice(eqIdx + 1).trim(),
          description: "",
        });
      } else {
        values.push({ name: trimmed, value: "", description: "" });
      }
    }
  }

  return values;
}

/**
 * Enrich method descriptions with detailed documentation from memdoc sections.
 * Doxygen puts detailed method docs in sections with:
 *   <h2 class="memtitle"><span class="permalink">...</span>MethodName()</h2>
 *   <div class="memdoc"> ... detailed text ... </div>
 * We match by method name and replace the brief description if the detailed one is longer.
 */
function enrichMethodDescriptions(
  $: cheerio.CheerioAPI,
  methods: MethodInfo[]
): void {
  if (methods.length === 0) return;

  // Build a map of method names to their memdoc contents
  $("h2.memtitle").each((_i, heading) => {
    const $heading = $(heading);
    const memdoc = $heading.next("div.memdoc");
    if (!memdoc.length) return;

    // Extract method name from the heading text (strip permalink spans)
    const headingClone = $heading.clone();
    headingClone.find("span.permalink").remove();
    const headingText = headingClone.text().trim();

    // The heading typically shows "MethodName()" — extract just the name
    const nameMatch = headingText.match(/^(\w+)\s*\(/);
    if (!nameMatch) return;
    const methodName = nameMatch[1];

    // Find the matching method(s) and enrich their description
    const detailedText = memdoc.text().trim();
    if (!detailedText) return;

    // Trim to a reasonable length to avoid massive descriptions
    const maxLen = 500;
    const trimmedDetail = detailedText.length > maxLen
      ? detailedText.slice(0, maxLen) + "..."
      : detailedText;

    for (const method of methods) {
      if (method.name === methodName && trimmedDetail.length > method.description.length) {
        method.description = trimmedDetail;
      }
    }
  });
}

function extractSourceFile($: cheerio.CheerioAPI): string {
  // Look for "Definition at line X of file Y" text
  const definitionText = $("div.contents")
    .find("p")
    .filter((_i, el) => $(el).text().includes("Definition at line"))
    .first()
    .text();

  const match = definitionText.match(/of file\s+(.+?)\.?\s*$/);
  return match ? match[1].trim() : "";
}

/**
 * Parse hierarchy.html to extract the class inheritance tree.
 */
export function parseHierarchyPage(html: string): HierarchyNode[] {
  const $ = cheerio.load(html);
  const nodes: Map<string, HierarchyNode> = new Map();

  function processListItems(
    items: cheerio.Cheerio<AnyNode>,
    parentName: string | null
  ) {
    items.each((_i, li) => {
      const $li = $(li);
      // Get the direct text/link of this item (not nested children)
      const link = $li.children("a.el, span > a.el").first();
      const name = link.text().trim() || $li.children("span").first().text().trim();

      if (!name) return;

      // Ensure node exists
      if (!nodes.has(name)) {
        nodes.set(name, { name, children: [] });
      }

      // Add as child of parent
      if (parentName && nodes.has(parentName)) {
        const parent = nodes.get(parentName)!;
        if (!parent.children.includes(name)) {
          parent.children.push(name);
        }
      }

      // Process nested <ul> children
      const childList = $li.children("ul").children("li");
      if (childList.length > 0) {
        processListItems(childList, name);
      }
    });
  }

  // The hierarchy is a nested list structure
  const topList = $("div.contents > div.directory ul").first();
  if (topList.length) {
    processListItems(topList.children("li"), null);
  } else {
    // Fallback: try plain nested lists
    const altList = $("div.contents ul").first();
    if (altList.length) {
      processListItems(altList.children("li"), null);
    }
  }

  return Array.from(nodes.values());
}

/**
 * Parse a group page (group__[Name].html).
 */
export function parseGroupPage(html: string): GroupInfo {
  const $ = cheerio.load(html);

  const titleText = $("div.headertitle div.title").first().text().trim();
  const name = titleText.replace(/\s*Module Reference\s*$/, "").trim();

  const description = $("div.contents div.textblock").first().text().trim();

  const classes: string[] = [];
  $("table.memberdecls tr.memitem\\:").each((_i, row) => {
    // These are actually compound rows for classes in the group
  });

  // Alternative: look for links to interface pages in the member declarations
  $("table.memberdecls a.el").each((_i, link) => {
    const href = $(link).attr("href") || "";
    if (href.startsWith("interface") && href.endsWith(".html")) {
      const className = $(link).text().trim();
      if (className && !classes.includes(className)) {
        classes.push(className);
      }
    }
  });

  return { name, description, classes };
}

/**
 * Parse a tutorial/documentation page (Page_*.html).
 */
export function parseTutorialPage(
  html: string,
  source: "enfusion" | "arma",
  filename: string
): WikiPage {
  const $ = cheerio.load(html);

  const title = $("div.headertitle div.title").first().text().trim();

  // Extract the main content, stripping navigation and scripts
  const content = $("div.contents div.textblock")
    .map((_i, el) => $(el).text().trim())
    .get()
    .join("\n\n");

  return {
    title,
    source,
    content,
    filename,
  };
}
