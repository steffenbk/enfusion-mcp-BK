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
