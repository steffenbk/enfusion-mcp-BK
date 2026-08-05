import { join } from "node:path";
import { loadConfig } from "../config.js";
import { createTuningServer } from "./server.js";
import { WorkbenchClient } from "../workbench/client.js";

const config = loadConfig();
const addonName = process.env.ENFUSION_TUNING_ADDON || "RoadForger";
const addonPath = join(config.projectPath, addonName);
const port = process.env.ENFUSION_TUNING_PORT ? parseInt(process.env.ENFUSION_TUNING_PORT, 10) : 5790;

// Writing is on by default: editing the .et text directly is the documented-safe
// way to change a nested field (the Workbench API replaces the whole nested
// object and wipes siblings). Set ENFUSION_TUNING_READONLY=1 to lock it.
const allowWrite = process.env.ENFUSION_TUNING_READONLY !== "1";

// What to do in Workbench after a successful write, via ENFUSION_TUNING_POST_WRITE:
//   rebuild        (default) re-import the changed .et file (ResourceManager.RebuildResourceFile)
//   scripts        EMCP_WB_Reload target=scripts (Script>Compile / Build>Compile All /
//                  Script>Compile All / Plugins>Reload Scripts fallback chain)
//   menu:A,B       run an exact menu path against WorldEditor, e.g. menu:Plugins,Reload Scripts
//   none           write only
//
// WARNING on `scripts`: a full script compile is documented to kill the NET API bridge —
// after it fires, further calls here fail until Workbench is restarted. `rebuild` does not
// do this. The write itself always lands regardless of postWrite, and the banner reports
// what happened.
const postWrite = process.env.ENFUSION_TUNING_POST_WRITE || "rebuild";

const wbClient = new WorkbenchClient(config.workbenchHost, config.workbenchPort, config);

// skipAutoLaunch: the tuner must never spawn Workbench just because a value changed.
const CALL_OPTS = { skipAutoLaunch: true, timeout: 8000 } as const;

async function notifyWorkbench(relPath: string): Promise<string | null> {
  if (postWrite === "none") return null;

  try {
    let result: Record<string, unknown>;

    if (postWrite.startsWith("menu:")) {
      const menuPath = postWrite.slice("menu:".length);
      result = await wbClient.call("EMCP_WB_ExecuteAction", { menuPath }, CALL_OPTS);
    } else if (postWrite === "rebuild") {
      const wbPath = `$${addonName}:${relPath}`;
      result = await wbClient.call("EMCP_WB_Resources", { action: "rebuild", path: wbPath }, CALL_OPTS);
    } else {
      result = await wbClient.call("EMCP_WB_Reload", { target: "scripts" }, CALL_OPTS);
    }

    const msg = typeof result.message === "string" ? result.message : JSON.stringify(result);
    return `Workbench [${postWrite}]: ${msg}`;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return `Workbench not reachable (${reason}). The file was still written -- reload it manually.`;
  }
}

const server = createTuningServer(addonPath, config.extractedPath, allowWrite, notifyWorkbench);
server.listen(port, "127.0.0.1", () => {
  console.log(`Vehicle tuning server: http://127.0.0.1:${port}`);
  console.log(`  addon:      ${addonName}`);
  console.log(`  path:       ${addonPath}`);
  console.log(`  mode:       ${allowWrite ? "read-write — close the prefab's Prefab Edit tab before applying" : "READ-ONLY (ENFUSION_TUNING_READONLY=1)"}`);
  console.log(`  after write: ${postWrite}${postWrite === "scripts" ? " (script compile can drop the NET API bridge until restart)" : ""}`);
  console.log(`  base data:  ${config.extractedPath ?? "(not configured — inherited values will show as unresolved)"}`);
  console.log(`  Set ENFUSION_TUNING_ADDON to point at a different addon, ENFUSION_TUNING_PORT to change the port.`);
});
