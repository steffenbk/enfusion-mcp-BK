import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHierarchyPage, parseClassPage } from "../../src/scraper/doxygen-parser.js";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("parseHierarchyPage", () => {
  const html = readFileSync(resolve(fixturesDir, "sample-hierarchy.html"), "utf-8");
  const nodes = parseHierarchyPage(html);
  const nodeMap = new Map(nodes.map((n) => [n.name, n]));

  it("parses nodes from the table-based Doxygen 1.13 format", () => {
    expect(nodes.length).toBeGreaterThan(100);
  });

  it("correctly identifies root nodes (no parent in the tree)", () => {
    // ActionManager is a root entry in the hierarchy (row_0_)
    expect(nodeMap.has("ActionManager")).toBe(true);
    // AlignableSlot is another root (row_1_)
    expect(nodeMap.has("AlignableSlot")).toBe(true);
  });

  it("correctly identifies parent-child relationships", () => {
    // ActionManager → InputManager
    const am = nodeMap.get("ActionManager");
    expect(am).toBeDefined();
    expect(am!.children).toContain("InputManager");

    // AlignableSlot → ButtonSlot, GridSlot, LayoutSlot, etc.
    const as_ = nodeMap.get("AlignableSlot");
    expect(as_).toBeDefined();
    expect(as_!.children).toContain("ButtonSlot");
    expect(as_!.children).toContain("GridSlot");
    expect(as_!.children).toContain("LayoutSlot");
  });

  it("correctly identifies multi-level nesting", () => {
    // AlignableSlot → LayoutSlot → HorizontalLayoutSlot
    const ls = nodeMap.get("LayoutSlot");
    expect(ls).toBeDefined();
    expect(ls!.children).toContain("HorizontalLayoutSlot");
    expect(ls!.children).toContain("VerticalLayoutSlot");
  });

  it("ScriptComponent is a child of GenericComponent", () => {
    const gc = nodeMap.get("GenericComponent");
    expect(gc).toBeDefined();
    expect(gc!.children).toContain("ScriptComponent");
  });

  it("GenericEntity is a child of IEntity", () => {
    const ie = nodeMap.get("IEntity");
    expect(ie).toBeDefined();
    expect(ie!.children).toContain("GenericEntity");
  });

  it("does not produce circular relationships", () => {
    for (const node of nodes) {
      for (const childName of node.children) {
        const child = nodeMap.get(childName);
        if (child) {
          expect(child.children).not.toContain(node.name);
        }
      }
    }
  });
});

describe("parseClassPage inheritance (map-area heuristic)", () => {
  const html = readFileSync(resolve(fixturesDir, "sample-class.html"), "utf-8");
  const cls = parseClassPage(html, "enfusion", "interfaceIEntity.html");

  it("parses the class name", () => {
    expect(cls.name).toBe("IEntity");
  });

  it("identifies Managed as a parent (above subject in diagram)", () => {
    expect(cls.parents).toContain("Managed");
  });

  it("identifies GenericEntity as a direct child", () => {
    expect(cls.children).toContain("GenericEntity");
  });

  it("does not include grandchildren (indented x) in children", () => {
    // AutotestGrid etc. are at x=179 (indented) — should be excluded
    expect(cls.children).not.toContain("AutotestGrid");
    expect(cls.children).not.toContain("CinematicEntity");
  });

  it("does not classify children as parents", () => {
    // GenericEntity should NOT appear in parents
    expect(cls.parents).not.toContain("GenericEntity");
    // No grandchildren in parents either
    expect(cls.parents).not.toContain("AutotestGrid");
  });
});
