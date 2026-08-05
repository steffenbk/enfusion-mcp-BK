import { describe, it, expect } from "vitest";
import { resolve, sep } from "node:path";
import {
  validateFilename,
  validateEnforceIdentifier,
  safePath,
  validateProjectPath,
} from "../../src/utils/safe-path.js";

describe("validateFilename", () => {
  it("accepts valid filenames", () => {
    expect(() => validateFilename("MyFile")).not.toThrow();
    expect(() => validateFilename("TAG_MyComponent")).not.toThrow();
    expect(() => validateFilename("file.txt")).not.toThrow();
  });

  it("rejects empty names", () => {
    expect(() => validateFilename("")).toThrow("empty");
    expect(() => validateFilename("  ")).toThrow("empty");
  });

  it("rejects path traversal", () => {
    expect(() => validateFilename("..")).toThrow("..");
    expect(() => validateFilename("foo..bar")).toThrow("..");
  });

  it("rejects path separators", () => {
    expect(() => validateFilename("a/b")).toThrow("path separators");
    expect(() => validateFilename("a\\b")).toThrow("path separators");
  });

  it("rejects Windows reserved characters", () => {
    expect(() => validateFilename("a<b")).toThrow("invalid characters");
    expect(() => validateFilename('a"b')).toThrow("invalid characters");
  });

  it("rejects Windows reserved names", () => {
    expect(() => validateFilename("CON")).toThrow("reserved name");
    expect(() => validateFilename("NUL")).toThrow("reserved name");
    expect(() => validateFilename("COM1")).toThrow("reserved name");
  });
});

describe("validateEnforceIdentifier", () => {
  it("accepts valid Enforce identifiers", () => {
    expect(() => validateEnforceIdentifier("TAG_MyClass")).not.toThrow();
    expect(() => validateEnforceIdentifier("_private")).not.toThrow();
    expect(() => validateEnforceIdentifier("A")).not.toThrow();
    expect(() => validateEnforceIdentifier("SCR_Faction123")).not.toThrow();
  });

  it("rejects names starting with a digit", () => {
    expect(() => validateEnforceIdentifier("1BadName")).toThrow("Enforce identifier");
  });

  it("rejects names with spaces", () => {
    expect(() => validateEnforceIdentifier("My Class")).toThrow("Enforce identifier");
  });

  it("rejects names with hyphens", () => {
    expect(() => validateEnforceIdentifier("My-Class")).toThrow("Enforce identifier");
  });

  it("rejects names with dots", () => {
    expect(() => validateEnforceIdentifier("My.Class")).toThrow("Enforce identifier");
  });
});

describe("validateProjectPath", () => {
  const base = resolve("/testbase/project");

  it("resolves valid sub-paths", () => {
    const result = validateProjectPath(base, "Scripts/Game/MyScript.c");
    expect(result).toBe(resolve(base, "Scripts/Game/MyScript.c"));
  });

  it("rejects path traversal with ..", () => {
    expect(() => validateProjectPath(base, "../etc/passwd")).toThrow("..");
  });

  it("prevents prefix collision attacks", () => {
    // "projectEvil" starts with "project" but is a different directory
    // This tests that the containment check uses trailing sep
    const evilPath = `..${sep}projectEvil${sep}hack.c`;
    expect(() => validateProjectPath(base, evilPath)).toThrow();
  });

  it("allows the base directory itself", () => {
    const result = validateProjectPath(base, "");
    expect(result).toBe(resolve(base));
  });
});

describe("safePath", () => {
  const base = resolve("/testbase/project");

  it("resolves valid segments", () => {
    const result = safePath(base, "Scripts", "MyScript.c");
    expect(result).toBe(resolve(base, "Scripts", "MyScript.c"));
  });

  it("rejects segments with path separators", () => {
    expect(() => safePath(base, "Scripts/Game")).toThrow("path separators");
  });

  it("rejects segments with traversal", () => {
    expect(() => safePath(base, "..")).toThrow("..");
  });
});

// ---------------------------------------------------------------------------
// Windows path-normalisation hazards.
//
// These stay INSIDE the project, so a containment check alone passes them — but
// they do not address the file the caller named.
// ---------------------------------------------------------------------------
describe("windows normalisation hazards", () => {
  const BASE = process.platform === "win32" ? "C:\proj" : "/proj";

  it("rejects a filename ending in a dot (Windows strips it, defeating overwrite guards)", () => {
    // "foo.et." lands on "foo.et", so an existsSync check on the dotted name
    // reports no collision and the real file is clobbered.
    expect(() => validateFilename("foo.et.")).toThrow(/dot or space/);
  });

  it("rejects a filename ending in a space", () => {
    expect(() => validateFilename("foo.et ")).toThrow(/dot or space/);
  });

  it("still accepts ordinary names with dots inside", () => {
    expect(() => validateFilename("My.Prefab.et")).not.toThrow();
    expect(() => validateFilename("name_1")).not.toThrow();
  });

  it("rejects a reserved device name nested in a sub-path", () => {
    // Contained, but on Windows writes to the null device and the data vanishes.
    expect(() => validateProjectPath(BASE, "sub/NUL.txt")).toThrow(/reserved device/i);
    expect(() => validateProjectPath(BASE, "sub/CON")).toThrow(/reserved device/i);
    expect(() => validateProjectPath(BASE, "a/b/COM1.c")).toThrow(/reserved device/i);
  });

  it("rejects a sub-path segment ending in a dot or space", () => {
    expect(() => validateProjectPath(BASE, "sub./file.et")).toThrow(/dot or space/);
    expect(() => validateProjectPath(BASE, "sub/file.et.")).toThrow(/dot or space/);
  });

  it("still accepts a normal nested project path", () => {
    expect(() => validateProjectPath(BASE, "Scripts/Game/UI/Menu.c")).not.toThrow();
    expect(() => validateProjectPath(BASE, "./Assets/My.Vehicle/file.et")).not.toThrow();
  });

  it("keeps blocking real traversal", () => {
    expect(() => validateProjectPath(BASE, "../outside.txt")).toThrow();
    expect(() => validateProjectPath(BASE, "sub/../../outside.txt")).toThrow();
  });
});
