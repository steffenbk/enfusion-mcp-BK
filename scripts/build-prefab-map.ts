// scripts/build-prefab-map.ts
// Regenerates data/schema/*.json from the live extracted corpus.
// Run: npm run build:prefab-map
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { extractVehicle } from "../src/prefab-map/extract.js";

const VEHICLES: { name: string; path: string }[] = [
  { name: "s105", path: "Prefabs/Vehicles/Wheeled/S105/S105_base.et" },
  { name: "brdm2", path: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et" },
];

const config = loadConfig();
if (!config.extractedPath) {
  console.error(
    "extractedPath is not configured. Set ENFUSION_EXTRACTED_PATH or place the " +
      "extracted directory beside the addons directory.",
  );
  process.exit(1);
}

// The schema must reflect the stock extracted corpus, not whatever mod project
// happens to be configured locally: readEtFile checks config.projectPath's addon
// subdirs first and a mod can ship its own partial override of a stock .et (e.g.
// a "Fire system" addon overriding Vehicle_Base.et), which would silently starve
// the schema of the real component set. Clearing projectPath forces every read
// through extractedPath.
const corpusConfig = { ...config, projectPath: "" };

const outDir = resolve("data/schema");
mkdirSync(outDir, { recursive: true });

for (const { name, path } of VEHICLES) {
  const schema = extractVehicle(path, corpusConfig);
  if (schema.unparsed.length > 0) {
    console.error(`${name}: ${schema.unparsed.length} unparsed entries`);
    for (const u of schema.unparsed) console.error(`  ${u.path}: ${u.reason}`);
    process.exit(1);
  }
  const file = resolve(outDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  console.log(
    `${name}: ${schema.components.length} components, ` +
      `${schema.boneSurface.length} bones, ${schema.references.length} references -> ${file}`,
  );
}
