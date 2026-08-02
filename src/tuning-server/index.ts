import { join } from "node:path";
import { loadConfig } from "../config.js";
import { createTuningServer } from "./server.js";

const config = loadConfig();
const addonName = process.env.ENFUSION_TUNING_ADDON || "RoadForger";
const addonPath = join(config.projectPath, addonName);
const port = process.env.ENFUSION_TUNING_PORT ? parseInt(process.env.ENFUSION_TUNING_PORT, 10) : 5790;

const server = createTuningServer(addonPath, config.extractedPath);
server.listen(port, "127.0.0.1", () => {
  console.log(`Vehicle tuning server: http://127.0.0.1:${port}`);
  console.log(`  addon:      ${addonName}`);
  console.log(`  path:       ${addonPath}`);
  console.log(`  base data:  ${config.extractedPath ?? "(not configured — inherited values will show as unresolved)"}`);
  console.log(`  Set ENFUSION_TUNING_ADDON to point at a different addon, ENFUSION_TUNING_PORT to change the port.`);
});
