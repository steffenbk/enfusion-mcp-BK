import { logger } from "../utils/logger.js";

export interface HtmlEntry {
  filename: string;
  html: string;
}

const BASE_URL = "https://arexplorer.zeroy.com/";
const DELAY_MS = 100;
const MAX_CONCURRENT = 5;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single HTML page from the remote Doxygen mirror.
 */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "enfusion-mcp-scraper/0.1.0 (https://github.com/enfusion-mcp)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

/**
 * Fetch the annotated.html class list from the remote source.
 */
export async function fetchAnnotatedPage(): Promise<string> {
  logger.info("Fetching class list from arexplorer.zeroy.com");
  return fetchPage(`${BASE_URL}annotated.html`);
}

/**
 * Fetch the hierarchy.html page from the remote source.
 */
export async function fetchHierarchyPage(): Promise<string> {
  return fetchPage(`${BASE_URL}hierarchy.html`);
}

/**
 * Fetch multiple class pages with rate limiting.
 * Yields {filename, html} for each successfully fetched page.
 */
export async function* fetchClassPages(
  urls: Array<{ name: string; url: string }>
): AsyncGenerator<HtmlEntry> {
  let pending: Array<Promise<HtmlEntry | null>> = [];

  for (const { name, url } of urls) {
    const fullUrl = `${BASE_URL}${url}`;

    const promise = delay(DELAY_MS)
      .then(() => fetchPage(fullUrl))
      .then((html) => ({ filename: url, html }) as HtmlEntry)
      .catch((err) => {
        logger.warn(`Failed to fetch ${name}: ${err}`);
        return null;
      });

    pending.push(promise);

    // Limit concurrency
    if (pending.length >= MAX_CONCURRENT) {
      const results = await Promise.all(pending);
      for (const result of results) {
        if (result) yield result;
      }
      pending = [];
    }
  }

  // Flush remaining
  if (pending.length > 0) {
    const results = await Promise.all(pending);
    for (const result of results) {
      if (result) yield result;
    }
  }
}
