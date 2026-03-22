import { describe, it, expect } from "vitest";
import { extractBlocks, extractProp, extractStringArray } from "../../src/animation/parser.js";

describe("extractBlocks", () => {
  it("extracts named blocks with nested braces", () => {
    const text = `AnimSrcNodeQueue MasterQueue {
 Child "Foo"
 Inner {
  Nested 1
 }
}`;
    const blocks = extractBlocks(text, "AnimSrcNodeQueue");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("MasterQueue");
    expect(blocks[0].body).toContain('Child "Foo"');
    expect(blocks[0].body).toContain("Nested 1");
  });

  it("extracts quoted names", () => {
    const text = `AnimSrcGCTVarFloat "My Variable" {
 DefaultValue 1.0
}`;
    const blocks = extractBlocks(text, "AnimSrcGCTVarFloat");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("My Variable");
  });

  it("returns empty for no matches", () => {
    const blocks = extractBlocks("no match here", "AnimSrcNodeQueue");
    expect(blocks).toHaveLength(0);
  });
});

describe("extractProp", () => {
  it("extracts unquoted value", () => {
    expect(extractProp(" DefaultValue 2.094\n MaxValue 10", "DefaultValue")).toBe("2.094");
  });

  it("extracts quoted value", () => {
    expect(extractProp(' Source "Locomotion.Erc.Idle"', "Source")).toBe("Locomotion.Erc.Idle");
  });

  it("returns null for missing prop", () => {
    expect(extractProp("Child Foo", "Missing")).toBeNull();
  });
});

describe("extractStringArray", () => {
  it("extracts quoted strings from block", () => {
    const body = `GlobalTags {
 "Vehicle"
 "Wheeled"
}`;
    const result = extractStringArray(body, "GlobalTags");
    expect(result).toEqual(["Vehicle", "Wheeled"]);
  });

  it("returns empty for missing block", () => {
    expect(extractStringArray("no array", "Tags")).toEqual([]);
  });
});
