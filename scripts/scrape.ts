import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scrape } from "../src/scraper/index.js";
import { loadConfig } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
let source: "local" | "remote" = "local";
let workbenchPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source" && args[i + 1]) {
    source = args[i + 1] as "local" | "remote";
    i++;
  } else if (args[i] === "--workbench-path" && args[i + 1]) {
    workbenchPath = args[i + 1];
    i++;
  }
}

const config = loadConfig();
const dataDir = resolve(__dirname, "..", "data");

await scrape({
  source,
  workbenchPath: workbenchPath || config.workbenchPath,
  dataDir,
});
