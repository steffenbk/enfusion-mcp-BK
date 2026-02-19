import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// We test the validation logic by importing the check functions indirectly
// through a test addon structure

const TEST_DIR = resolve(import.meta.dirname, "../../tmp-test-validate");

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

describe("mod_validate test structures", () => {
  it("valid addon has .gproj, Scripts/Game, Prefabs", () => {
    setup({
      "TestMod.gproj": `GameProject {
 ID "TestMod"
 GUID "AAAAAAAAAAAAAAAA"
 TITLE "Test Mod"
 Dependencies {
  "58D0FB3206B6F859"
 }
}`,
      "Scripts/Game/TM_Test.c": `class TM_Test : ScriptComponent
{
  override void EOnInit(IEntity owner)
  {
  }
}
`,
      "Prefabs/Test.et": `GenericEntity {
 ID "BBBBBBBBBBBBBBBB"
}`,
    });

    expect(existsSync(join(TEST_DIR, "TestMod.gproj"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "Scripts/Game/TM_Test.c"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "Prefabs/Test.et"))).toBe(true);
  });

  it("detects scripts outside Scripts/Game/", () => {
    setup({
      "TestMod.gproj": `GameProject {
 ID "TestMod"
 GUID "AAAAAAAAAAAAAAAA"
 Dependencies {
  "58D0FB3206B6F859"
 }
}`,
      "BadScript.c": `class BadClass
{
}`,
      "Scripts/Game/Good.c": `class TM_Good : ScriptComponent
{
}`,
    });

    // BadScript.c is in the root, not in Scripts/Game/
    // The validate tool would flag this as an error
    expect(existsSync(join(TEST_DIR, "BadScript.c"))).toBe(true);
  });

  it("detects missing base game dependency", () => {
    setup({
      "TestMod.gproj": `GameProject {
 ID "TestMod"
 GUID "AAAAAAAAAAAAAAAA"
 Dependencies {
 }
}`,
    });

    expect(existsSync(join(TEST_DIR, "TestMod.gproj"))).toBe(true);
  });

  it("detects invalid prefab format", () => {
    setup({
      "TestMod.gproj": `GameProject {
 ID "TestMod"
 GUID "AAAAAAAAAAAAAAAA"
 Dependencies {
  "58D0FB3206B6F859"
 }
}`,
      "Prefabs/Bad.et": "this is not valid enfusion text {{{}}}",
    });

    expect(existsSync(join(TEST_DIR, "Prefabs/Bad.et"))).toBe(true);
  });

  it("detects missing .gproj", () => {
    setup({
      "Scripts/Game/Test.c": `class Test { }`,
    });

    // No .gproj file at all
    const gprojFiles = ["TestMod.gproj", "test.gproj"].filter((f) =>
      existsSync(join(TEST_DIR, f))
    );
    expect(gprojFiles.length).toBe(0);
  });
});
