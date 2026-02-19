import { describe, it, expect } from "vitest";
import {
  generateStringTable,
  deriveStringKey,
} from "../../src/templates/localization.js";

describe("generateStringTable", () => {
  it("produces valid XML structure", () => {
    const result = generateStringTable({
      modName: "TestMod",
      entries: [{ key: "STR_TestMod_Hello", original: "Hello" }],
    });
    expect(result).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(result).toContain("<StringTable>");
    expect(result).toContain("</StringTable>");
  });

  it("sets package name", () => {
    const result = generateStringTable({
      modName: "MyMod",
      entries: [],
    });
    expect(result).toContain('<Package Name="MyMod">');
  });

  it("includes all entries", () => {
    const result = generateStringTable({
      modName: "TestMod",
      entries: [
        { key: "STR_TestMod_Name", original: "Test Name" },
        { key: "STR_TestMod_Desc", original: "Test Description" },
      ],
    });
    expect(result).toContain('Id="STR_TestMod_Name"');
    expect(result).toContain("<Original>Test Name</Original>");
    expect(result).toContain('Id="STR_TestMod_Desc"');
    expect(result).toContain("<Original>Test Description</Original>");
  });

  it("escapes XML special characters", () => {
    const result = generateStringTable({
      modName: "Test&Mod",
      entries: [{ key: "STR_Test", original: '<"hello"> & world' }],
    });
    expect(result).toContain("Test&amp;Mod");
    expect(result).toContain("&lt;&quot;hello&quot;&gt; &amp; world");
  });

  it("handles empty entries", () => {
    const result = generateStringTable({
      modName: "Empty",
      entries: [],
    });
    expect(result).toContain("<StringTable>");
    expect(result).toContain("</StringTable>");
    expect(result).not.toContain("<Key");
  });
});

describe("deriveStringKey", () => {
  it("produces correct format", () => {
    expect(deriveStringKey("MyMod", "Faction", "Name")).toBe(
      "STR_MyMod_Faction_Name"
    );
  });

  it("strips non-alphanumeric characters", () => {
    expect(deriveStringKey("My-Mod!", "Test Case", "Label")).toBe(
      "STR_MyMod_TestCase_Label"
    );
  });

  it("handles single-word inputs", () => {
    expect(deriveStringKey("Mod", "UI", "Title")).toBe("STR_Mod_UI_Title");
  });
});
