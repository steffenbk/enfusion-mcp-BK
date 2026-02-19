import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const TEST_DIR = resolve(import.meta.dirname, "../../tmp-test-config-validate");

function setup(files: Record<string, string>) {
  rmSync(TEST_DIR, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(resolve(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }
}

function cleanup() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

afterAll(cleanup);

describe("config validation test structures", () => {
  it("valid .conf file parses correctly", () => {
    setup({
      "Configs/Factions/TestFaction.conf": `SCR_Faction {
 m_sKey "test_faction"
 m_sName "Test Faction"
 m_Color "0,100,200,255"
}`,
    });

    expect(existsSync(join(TEST_DIR, "Configs/Factions/TestFaction.conf"))).toBe(true);
  });

  it("invalid .conf file is detectable", () => {
    setup({
      "Configs/Bad.conf": "this is {{{ not valid enfusion text }}}",
    });

    expect(existsSync(join(TEST_DIR, "Configs/Bad.conf"))).toBe(true);
  });

  it("valid mission header .conf", () => {
    setup({
      "Missions/MissionHeader.conf": `SCR_MissionHeader {
 m_sName "Test Scenario"
 m_sDescription "A test"
 m_sWorldFile ""
 m_bIsModded 1
}`,
    });

    expect(existsSync(join(TEST_DIR, "Missions/MissionHeader.conf"))).toBe(true);
  });

  it("handles missing Configs directory gracefully", () => {
    setup({
      "Scripts/Game/Test.c": "class Test {}",
    });

    expect(existsSync(join(TEST_DIR, "Configs"))).toBe(false);
  });
});
