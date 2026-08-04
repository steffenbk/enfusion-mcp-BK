/**
 * Probe Workbench menu paths to find the one bound to script compilation.
 *
 * ExecuteAction is the only way to trigger a menu item and there is no API to
 * enumerate menus, so the real path has to be found by trying candidates and
 * watching which one returns executed=1.
 *
 *   npx tsx probe-menu.ts                 # sweep ScriptEditor candidates
 *   npx tsx probe-menu.ts "Build,Rebuild" # try one exact path
 */
import { loadConfig } from "./src/config.js";
import { WorkbenchClient } from "./src/workbench/client.js";

const config = loadConfig();
const client = new WorkbenchClient(config.workbenchHost, config.workbenchPort, config);
const OPTS = { skipAutoLaunch: true, timeout: 8000 } as const;

// Compilation-ish only. Nothing here saves, closes or deletes, so a stray hit
// cannot damage the session.
const CANDIDATES: Array<[string, string]> = [
  ["ScriptEditor", "Script,Compile"],
  ["ScriptEditor", "Script,Compile All"],
  ["ScriptEditor", "Script,Rebuild"],
  ["ScriptEditor", "Script,Validate and Rebuild"],
  ["ScriptEditor", "Build,Compile"],
  ["ScriptEditor", "Build,Compile All"],
  ["ScriptEditor", "Build,Rebuild"],
  ["ScriptEditor", "Build,Build"],
  ["ScriptEditor", "Build,Validate and Rebuild"],
  ["ScriptEditor", "Build,Validate And Rebuild"],
  ["ScriptEditor", "Scripts,Compile"],
  ["ScriptEditor", "Scripts,Rebuild"],
  ["ScriptEditor", "Tools,Compile"],
  ["ScriptEditor", "Tools,Reload Scripts"],
  ["ScriptEditor", "Edit,Compile"],
  ["ScriptEditor", "Compile"],
  ["ScriptEditor", "Rebuild"],
  ["WorldEditor", "Plugins,Reload Scripts"],
  ["WorldEditor", "Tools,Reload Scripts"],
  ["ResourceManager", "Plugins,Reload"],
];

async function probe(module: string, menuPath: string): Promise<void> {
  try {
    const r = await client.call<Record<string, unknown>>(
      "EMCP_WB_ExecuteAction",
      { menuPath, module },
      OPTS
    );
    const hit = r.executed === 1 || r.executed === "1";
    const mark = hit ? "  *** HIT ***" : "";
    console.log(`${hit ? "YES" : " no"}  ${module.padEnd(16)} ${menuPath}${mark}`);
  } catch (e) {
    console.log(`ERR  ${module.padEnd(16)} ${menuPath}  -- ${e instanceof Error ? e.message : String(e)}`);
  }
}

const arg = process.argv[2];
const list: Array<[string, string]> = arg
  ? [[process.argv[3] || "ScriptEditor", arg]]
  : CANDIDATES;

console.log(`Probing ${list.length} menu path(s) on ${config.workbenchHost}:${config.workbenchPort}\n`);
for (const [module, path] of list) {
  await probe(module, path);
}
console.log("\nA HIT means the menu item exists and fired. Confirm a compile actually ran:");
console.log('  grep "Compiling Game scripts" logs/logs_*/console.log');
