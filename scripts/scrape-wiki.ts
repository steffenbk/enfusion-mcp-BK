/**
 * Scrapes the BI Community Wiki for Arma Reforger modding pages using Playwright.
 * community.bistudio.com blocks bot user-agents, so we use a real browser.
 *
 * Usage: npx tsx scripts/scrape-wiki.ts
 *
 * Collects pages from Category:Arma_Reforger/Modding recursively,
 * fetches raw wikitext via action=raw, converts to plain text, and merges
 * with existing engine wiki docs in data/wiki/pages.json.
 */

import { chromium, type Page } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "https://community.bistudio.com";
const CATEGORY_URL = `${BASE_URL}/wiki/Category:Arma_Reforger/Modding`;
const OUTPUT_PATH = join(import.meta.dirname, "..", "data", "wiki", "pages.json");

// Rate limit: be respectful
const DELAY_MS = 1_200;

interface WikiPage {
  title: string;
  source: string;
  content: string;
  url: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Recursively collect all page URLs from a category and its subcategories.
 */
async function collectPageUrls(
  page: Page,
  categoryUrl: string,
  visited: Set<string> = new Set()
): Promise<string[]> {
  if (visited.has(categoryUrl)) return [];
  visited.add(categoryUrl);

  console.log(`  Scanning: ${categoryUrl.replace(BASE_URL, "")}`);
  await page.goto(categoryUrl, { waitUntil: "domcontentloaded" });
  await delay(DELAY_MS);

  const { pageLinks, subcategoryLinks } = await page.evaluate(() => {
    const pages: string[] = [];
    const subcats: string[] = [];

    // Subcategories section
    const subcatSection = document.querySelector("#mw-subcategories");
    if (subcatSection) {
      for (const a of subcatSection.querySelectorAll("a")) {
        const href = (a as HTMLAnchorElement).href;
        if (href.includes("/wiki/Category:Arma_Reforger")) {
          subcats.push(href);
        }
      }
    }

    // Pages section
    const pagesSection = document.querySelector("#mw-pages");
    if (pagesSection) {
      for (const a of pagesSection.querySelectorAll("a")) {
        const href = (a as HTMLAnchorElement).href;
        if (href.includes("/wiki/") && !href.includes("Category:")) {
          pages.push(href);
        }
      }
    }

    return { pageLinks: pages, subcategoryLinks: subcats };
  });

  const allPages: string[] = [...pageLinks];

  for (const subcat of subcategoryLinks) {
    const sub = await collectPageUrls(page, subcat, visited);
    allPages.push(...sub);
  }

  return allPages;
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

  // Convert {{Feature|...|text}} to just the text
  text = text.replace(/\{\{Feature\|[^|]*\|([^}]*)\}\}/g, "Note: $1");

  // Convert {{Link|Page Name}} and {{Link|Page Name|Display}}
  text = text.replace(/\{\{Link\|([^|}]+)\|([^}]+)\}\}/g, "$2");
  text = text.replace(/\{\{Link\|([^}]+)\}\}/g, "$1");

  // Convert {{hl|text}} (highlight) to just text
  text = text.replace(/\{\{hl\|([^}]*)\}\}/g, "$1");

  // Convert {{Wiki|TODO}} etc
  text = text.replace(/\{\{Wiki\|([^}]*)\}\}/g, "[$1]");

  // Convert <enforce inline>code</enforce> to `code`
  text = text.replace(/<enforce\s+inline>(.*?)<\/enforce>/gs, "`$1`");

  // Convert <enforce>code</enforce> to code blocks
  text = text.replace(/<enforce>(.*?)<\/enforce>/gs, (_, code) => {
    return "\n```\n" + code.trim() + "\n```\n";
  });

  // Convert <syntaxhighlight> and <source> to code blocks
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

  // Convert wiki tables to readable format
  // Simple approach: extract cell contents
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
        if (cellContent && !cellContent.startsWith("class=") && !cellContent.startsWith("style=")) {
          currentRow.push(cellContent);
        }
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow.join(" | "));
    }

    return rows.join("\n");
  });

  // Remove remaining HTML tags
  text = text.replace(/<\/?[^>]+>/g, "");

  // Remove remaining template calls we don't handle
  text = text.replace(/\{\{[^}]*\}\}/g, "");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

/**
 * Fetch raw wikitext for a page using action=raw.
 */
async function fetchRawPage(page: Page, url: string): Promise<WikiPage | null> {
  try {
    // Extract page title from URL for the raw action
    const pageName = url.replace(`${BASE_URL}/wiki/`, "");
    const rawUrl = `${BASE_URL}/wiki/${pageName}?action=raw`;

    await page.goto(rawUrl, { waitUntil: "domcontentloaded" });
    await delay(DELAY_MS);

    const rawText = await page.evaluate(() => {
      // action=raw returns plain text in a <pre> or just as the body text
      const pre = document.querySelector("pre");
      if (pre) return pre.textContent || "";
      return document.body.innerText || "";
    });

    if (!rawText || rawText.length < 30) {
      // Fallback: try scraping the rendered HTML
      return await fetchRenderedPage(page, url);
    }

    const content = wikitextToPlainText(rawText);

    if (content.length < 50) {
      console.log(`    Skipped (too short): ${pageName}`);
      return null;
    }

    // Extract title from page name
    const title = decodeURIComponent(pageName)
      .replace(/Arma_Reforger:/, "")
      .replace(/_/g, " ");

    return {
      title,
      source: "bistudio-wiki",
      content,
      url,
    };
  } catch (err) {
    console.error(`    Error fetching raw: ${url} — ${err}`);
    return await fetchRenderedPage(page, url);
  }
}

/**
 * Fallback: scrape rendered HTML if raw wikitext isn't available.
 */
async function fetchRenderedPage(page: Page, url: string): Promise<WikiPage | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await delay(DELAY_MS);

    const result = await page.evaluate(() => {
      const titleEl = document.querySelector("#firstHeading");
      const contentEl = document.querySelector("#mw-content-text .mw-parser-output");

      if (!titleEl || !contentEl) return null;

      const title = titleEl.textContent?.trim() || "";

      // Clone and clean
      const clone = contentEl.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(".mw-editsection, #toc, .toc, .navbox, .mbox-small, .noprint, script, style")
        .forEach((el) => el.remove());

      // Get text with basic structure preservation
      const text = clone.innerText || "";
      return { title, content: text };
    });

    if (!result || result.content.length < 50) return null;

    return {
      title: result.title.replace(/ – Arma Reforger$/, ""),
      source: "bistudio-wiki",
      content: result.content,
      url,
    };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log("Launching Chromium...\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Step 1: Collect all page URLs
  console.log("=== Collecting page URLs ===\n");
  const pageUrls = await collectPageUrls(page, CATEGORY_URL);
  const uniqueUrls = [...new Set(pageUrls)];
  console.log(`\nFound ${uniqueUrls.length} unique pages.\n`);

  // Step 2: Scrape each page
  console.log("=== Scraping pages ===\n");
  const pages: WikiPage[] = [];

  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    const shortName = url.replace(BASE_URL + "/wiki/", "");
    console.log(`  [${i + 1}/${uniqueUrls.length}] ${shortName}`);

    const wikiPage = await fetchRawPage(page, url);
    if (wikiPage) {
      pages.push(wikiPage);
      console.log(`    ✓ ${wikiPage.title} (${wikiPage.content.length} chars)`);
    }
  }

  await browser.close();

  // Step 3: Merge with existing wiki pages
  let existing: WikiPage[] = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    // Keep non-bistudio-wiki pages (engine docs)
    existing = existing.filter((p: any) => p.source !== "bistudio-wiki");
  }

  const merged = [...existing, ...pages];
  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), "utf-8");

  console.log(`\n=== Done ===`);
  console.log(`  BI wiki pages scraped: ${pages.length}`);
  console.log(`  Engine docs kept: ${existing.length}`);
  console.log(`  Total wiki pages: ${merged.length}`);
  console.log(`  Written to: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
