// scripts/build-prefab-map.ts
// Regenerates data/schema/*.json from the live extracted corpus.
// Run: npm run build:prefab-map
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { extractVehicle } from "../src/prefab-map/extract.js";
import { findSelfOverrides } from "../src/prefab-map/chain-merge.js";
import { contrastVehicles } from "../src/prefab-map/contrast.js";
import { buildCitationIndex } from "../src/prefab-map/citations.js";
import { generateVehicleDoc } from "../src/prefab-map/docgen.js";

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

const built = new Map<string, ReturnType<typeof extractVehicle>>();

for (const { name, path } of VEHICLES) {
  const schema = extractVehicle(path, corpusConfig);
  if (schema.unparsed.length > 0) {
    console.error(`${name}: ${schema.unparsed.length} unparsed entries`);
    for (const u of schema.unparsed) console.error(`  ${u.path}: ${u.reason}`);
    process.exit(1);
  }

  // A same-file "override" is never legitimate chain inheritance — it means two
  // distinct source declarations collided onto one property path within a single
  // component's own flatten, and one of them was silently discarded. Refusing to
  // write a schema this could produce is the gate that would have caught the
  // sibling-block collapse bug before it ever reached a committed schema.
  const selfOverrides = findSelfOverrides(schema.components);
  if (selfOverrides.length > 0) {
    console.error(`${name}: ${selfOverrides.length} same-file self-override(s) — refusing to write a corrupted schema`);
    for (const s of selfOverrides) console.error(`  ${s.component} :: ${s.path} (${s.from})`);
    process.exit(1);
  }

  built.set(name, schema);
  const file = resolve(outDir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  console.log(
    `${name}: ${schema.components.length} components, ` +
      `${schema.boneSurface.length} bones, ${schema.references.length} references -> ${file}`,
  );
}

const contrast = contrastVehicles(built.get("s105")!, built.get("brdm2")!);
const contrastFile = resolve(outDir, "contrast.json");
writeFileSync(contrastFile, `${JSON.stringify(contrast, null, 2)}\n`, "utf8");
console.log(
  `contrast: ${contrast.sharedComponents.length} shared, ` +
    `${contrast.onlyInA.length} S105-only, ${contrast.onlyInB.length} BRDM2-only -> ${contrastFile}`,
);

const KB_DIR = "C:/Users/Steffen/.claude/arma-knowledge/patterns/Vehicles_And_Physics";

if (process.argv.includes("--write-kb")) {
  mkdirSync(KB_DIR, { recursive: true });

  const api = JSON.parse(readFileSync(resolve("data/api/arma-classes.json"), "utf8"));
  const citations = buildCitationIndex(api);
  const observations = JSON.parse(
    readFileSync(resolve("data/schema/observations.json"), "utf8"),
  );

  for (const [name, schema] of built) {
    const doc = generateVehicleDoc(schema, citations, observations);
    const file = resolve(KB_DIR, `${name}-component-map.md`);
    writeFileSync(file, doc, "utf8");
    const lines = doc.split("\n").length;
    console.log(`${name} doc: ${lines} lines -> ${file}`);
    if (lines > 800) {
      console.warn(
        `  ${name}-component-map.md exceeds 800 lines. Repo convention: split into a ` +
          `subfolder with a local INDEX.md and point the main INDEX.md row at it.`,
      );
    }
  }
} else {
  console.log(`KB docs not written — pass --write-kb to write into ${KB_DIR}`);
}
