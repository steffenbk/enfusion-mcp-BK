/**
 * Parses a MediaWiki XML export and converts it to pages.json format.
 *
 * Usage: npx tsx scripts/parse-wiki-export.ts
 *
 * Reads data/wiki/export.xml, converts wikitext to plain text,
 * and merges with existing pages in data/wiki/pages.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";

const EXPORT_PATH = join(import.meta.dirname, "..", "data", "wiki", "export.xml");
const OUTPUT_PATH = join(import.meta.dirname, "..", "data", "wiki", "pages.json");
const BASE_URL = "https://community.bistudio.com/wiki";

interface WikiPage {
  title: string;
  source: string;
  content: string;
  url: string;
}

/**
 * Convert MediaWiki markup to clean readable text.
 */
function wikitextToPlainText(wikitext: string): string {
  let text = wikitext;

  // Remove TOC directive
  text = text.replace(/\{\{TOC\|[^}]*\}\}/g, "");

  // Remove image/file links
  text = text.replace(/\[\[File:[^\]]*\]\]/g, "");
  text = text.replace(/\[\[Image:[^\]]*\]\]/g, "");

  // Remove category tags
  text = text.replace(/\{\{GameCategory[^}]*\}\}/g, "");

  // Remove {{armaR}} / {{arma3}} / similar game name templates
  text = text.replace(/\{\{armaR\}\}/g, "Arma Reforger");
  text = text.replace(/\{\{arma3\}\}/g, "Arma 3");
  text = text.replace(/\{\{arma4\}\}/g, "Arma 4");
  text = text.replace(/\{\{dayz\}\}/g, "DayZ");
  text = text.replace(/\{\{enfusion\}\}/g, "Enfusion");

  // Convert {{Feature|...|text}} to just the text
  text = text.replace(/\{\{Feature\|[^|]*\|([\s\S]*?)\}\}/g, "Note: $1");

  // Convert {{Link|Page Name}} and {{Link|Page Name|Display}}
  text = text.replace(/\{\{Link\|([^|}]+)\|([^}]+)\}\}/g, "$2");
  text = text.replace(/\{\{Link\|([^}]+)\}\}/g, "$1");

  // Convert {{hl|text}} (highlight) to just text
  text = text.replace(/\{\{hl\|([^}]*)\}\}/g, "`$1`");

  // Convert {{Wiki|TODO}} etc
  text = text.replace(/\{\{Wiki\|([^}]*)\}\}/g, "[$1]");

  // Convert {{GUIButton|text}} to text
  text = text.replace(/\{\{GUIButton\|([^}]*)\}\}/g, "$1");

  // Convert <enforce inline>code</enforce> to `code`
  text = text.replace(/<enforce\s+inline>(.*?)<\/enforce>/gs, "`$1`");

  // Convert <enforce>code</enforce> to code blocks
  text = text.replace(/<enforce>(.*?)<\/enforce>/gs, (_, code) => {
    return "\n```enforce\n" + code.trim() + "\n```\n";
  });

  // Convert <syntaxhighlight> and <source> to code blocks
  text = text.replace(/<syntaxhighlight[^>]*lang="([^"]*)"[^>]*>(.*?)<\/syntaxhighlight>/gs, (_, lang, code) => {
    return "\n```" + lang + "\n" + code.trim() + "\n```\n";
  });
  text = text.replace(/<syntaxhighlight[^>]*>(.*?)<\/syntaxhighlight>/gs, (_, code) => {
    return "\n```\n" + code.trim() + "\n```\n";
  });
  text = text.replace(/<source[^>]*>(.*?)<\/source>/gs, (_, code) => {
    return "\n```\n" + code.trim() + "\n```\n";
  });

  // Convert <pre> to code blocks
  text = text.replace(/<pre>(.*?)<\/pre>/gs, (_, code) => {
    return "\n```\n" + code.trim() + "\n```\n";
  });

  // Convert <code> to inline code
  text = text.replace(/<code>(.*?)<\/code>/gs, "`$1`");

  // Convert wiki headings: == H2 ==, === H3 ===, etc.
  text = text.replace(/^={5}\s*(.*?)\s*={5}/gm, "##### $1");
  text = text.replace(/^={4}\s*(.*?)\s*={4}/gm, "#### $1");
  text = text.replace(/^={3}\s*(.*?)\s*={3}/gm, "### $1");
  text = text.replace(/^={2}\s*(.*?)\s*={2}/gm, "## $1");

  // Convert [[Page|display]] links to just display text
  text = text.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  // Convert [[Page]] links to just page name
  text = text.replace(/\[\[([^\]]*)\]\]/g, "$1");

  // Convert external links [url text]
  text = text.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1");

  // Convert bold '''text''' and italic ''text''
  text = text.replace(/'''(.*?)'''/g, "$1");
  text = text.replace(/''(.*?)''/g, "$1");

  // Convert bullet lists: * item → - item
  text = text.replace(/^\*\*\*\s*/gm, "      - ");
  text = text.replace(/^\*\*\s*/gm, "    - ");
  text = text.replace(/^\*\s*/gm, "- ");

  // Convert numbered lists: # item → 1. item
  text = text.replace(/^###\s*/gm, "      1. ");
  text = text.replace(/^##\s*/gm, "    1. ");
  text = text.replace(/^#\s*/gm, "1. ");

  // Convert ; definition lists
  text = text.replace(/^;\s*(.*)/gm, "**$1**");
  text = text.replace(/^:\s*(.*)/gm, "  $1");

  // Convert wiki tables to readable format
  text = text.replace(/\{\|[^\n]*\n([\s\S]*?)\|\}/g, (_, tableContent) => {
    const lines = tableContent.split("\n");
    const rows: string[] = [];
    let currentRow: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("|-")) {
        if (currentRow.length > 0) {
          rows.push(currentRow.join(" | "));
          currentRow = [];
        }
      } else if (trimmed.startsWith("|") || trimmed.startsWith("!")) {
        const cellContent = trimmed.replace(/^[|!]\s*/, "").trim();
        if (cellContent && !cellContent.startsWith("class=") && !cellContent.startsWith("style=") && !cellContent.startsWith("rowspan") && !cellContent.startsWith("colspan")) {
          currentRow.push(cellContent);
        }
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow.join(" | "));
    }

    return rows.join("\n");
  });

  // Remove remaining HTML tags (but preserve content)
  text = text.replace(/<br\s*\/?>/g, "\n");
  text = text.replace(/<\/?[^>]+>/g, "");

  // Remove remaining template calls we don't handle
  text = text.replace(/\{\{[^}]*\}\}/g, "");

  // Clean up HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

function main(): void {
  console.log("Reading export.xml...");
  const xml = readFileSync(EXPORT_PATH, "utf-8");

  console.log("Parsing XML...");
  const $ = load(xml, { xmlMode: true });

  const pages: WikiPage[] = [];
  let skippedCategory = 0;
  let skippedShort = 0;

  $("page").each((_, el) => {
    const title = $(el).find("title").first().text();
    const ns = $(el).find("ns").first().text();
    const wikitext = $(el).find("text").first().text();

    // Skip category pages (ns=14) and template pages (ns=10)
    if (ns === "14") {
      skippedCategory++;
      return;
    }
    if (ns === "10") {
      skippedCategory++;
      return;
    }

    // Skip non-Reforger pages that slipped in
    if (title === "Doxygen" || title === "OFPEC Tags List" || title === "Steam") {
      skippedShort++;
      return;
    }

    // Skip pages with very little content
    if (!wikitext || wikitext.length < 50) {
      skippedShort++;
      return;
    }

    const content = wikitextToPlainText(wikitext);

    // Skip if converted content is too short
    if (content.length < 50) {
      skippedShort++;
      return;
    }

    // Clean up the title for display
    const displayTitle = title
      .replace(/^Arma Reforger:/, "")
      .replace(/_/g, " ");

    // Build the wiki URL
    const urlTitle = title.replace(/ /g, "_");
    const url = `${BASE_URL}/${urlTitle}`;

    pages.push({
      title: displayTitle,
      source: "bistudio-wiki",
      content,
      url,
    });

    console.log(`  ✓ ${displayTitle} (${content.length} chars)`);
  });

  console.log(`\nParsed ${pages.length} pages (skipped ${skippedCategory} categories, ${skippedShort} too-short)`);

  // Merge with existing pages (keep non-bistudio-wiki pages)
  let existing: WikiPage[] = [];
  try {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    existing = existing.filter((p: any) => p.source !== "bistudio-wiki");
    console.log(`Keeping ${existing.length} existing engine docs`);
  } catch {
    console.log("No existing pages.json found, creating new");
  }

  const merged = [...existing, ...pages];
  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), "utf-8");

  console.log(`\n=== Done ===`);
  console.log(`  BI wiki pages: ${pages.length}`);
  console.log(`  Engine docs kept: ${existing.length}`);
  console.log(`  Total wiki pages: ${merged.length}`);
  console.log(`  Written to: ${OUTPUT_PATH}`);
}

main();
