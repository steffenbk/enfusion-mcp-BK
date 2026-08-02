import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listEngineConfFiles, engineConfPath, ENGINE_CONF_SUBPATH } from "../../src/tuning-server/discover.js";

describe("listEngineConfFiles / engineConfPath", () => {
  let addonDir: string;

  beforeEach(() => {
    addonDir = mkdtempSync(join(tmpdir(), "tuning-server-test-"));
  });

  afterEach(() => {
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("returns an empty array when the Engines directory doesn't exist", () => {
    expect(listEngineConfFiles(addonDir)).toEqual([]);
  });

  it("lists .conf files sorted alphabetically, ignoring non-.conf files", () => {
    const enginesDir = join(addonDir, ENGINE_CONF_SUBPATH);
    mkdirSync(enginesDir, { recursive: true });
    writeFileSync(join(enginesDir, "Engine_UAZ469.conf"), "Engine {}\n");
    writeFileSync(join(enginesDir, "Engine_M151.conf"), "Engine {}\n");
    writeFileSync(join(enginesDir, "readme.txt"), "not a conf\n");

    expect(listEngineConfFiles(addonDir)).toEqual(["Engine_M151.conf", "Engine_UAZ469.conf"]);
  });

  it("engineConfPath joins addonPath, the fixed subpath, and the filename", () => {
    const p = engineConfPath(addonDir, "Engine_M151.conf");
    expect(p).toBe(join(addonDir, ENGINE_CONF_SUBPATH, "Engine_M151.conf"));
  });
});
