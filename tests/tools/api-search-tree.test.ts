import { describe, it, expect } from "vitest";
import { SearchEngine } from "../../src/index/search-engine.js";
import { formatTreeNode, formatClassTree, MAX_TREE_CHILDREN } from "../../src/tools/api-search.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

describe("Class Hierarchy Tree Visualization", () => {
  const engine = new SearchEngine(dataDir);

  describe("formatTreeNode", () => {
    it("formats a class with method and property counts", () => {
      const cls = engine.getClass("IEntity");
      expect(cls).toBeDefined();
      const node = formatTreeNode(cls!, cls!.name, false);
      expect(node).toMatch(/^IEntity \(\d+m, \d+p\)/);
      expect(node).not.toContain("◀ TARGET");
    });

    it("marks the target class", () => {
      const cls = engine.getClass("IEntity");
      const node = formatTreeNode(cls!, cls!.name, true);
      expect(node).toContain("◀ TARGET");
    });

    it("handles unknown classes gracefully", () => {
      const node = formatTreeNode(undefined, "UnknownClass", false);
      expect(node).toBe("UnknownClass (?)");
    });

    it("handles unknown class marked as target", () => {
      const node = formatTreeNode(undefined, "UnknownClass", true);
      expect(node).toBe("UnknownClass (?)  ◀ TARGET");
    });

    it("includes brief description when available", () => {
      const cls = engine.getClass("IEntity");
      if (cls && cls.brief) {
        const node = formatTreeNode(cls, cls.name, false);
        expect(node).toContain("—");
      }
    });

    it("truncates long briefs", () => {
      // Create a mock ClassInfo with a very long brief
      const mockCls = {
        ...engine.getClass("IEntity")!,
        brief: "A".repeat(100),
      };
      const node = formatTreeNode(mockCls, mockCls.name, false);
      expect(node).toContain("...");
      // The brief portion should be truncated
      expect(node.length).toBeLessThan(mockCls.name.length + 100 + 30);
    });
  });

  describe("formatClassTree", () => {
    it("renders a tree with header and target marker", () => {
      const cls = engine.getClass("GenericEntity");
      expect(cls).toBeDefined();
      const tree = formatClassTree(cls!, engine);
      expect(tree).toContain("Class Hierarchy: GenericEntity");
      expect(tree).toContain("◀ TARGET");
    });

    it("contains root ancestor in the tree", () => {
      const cls = engine.getClass("GenericEntity");
      expect(cls).toBeDefined();
      const chain = engine.getInheritanceChain("GenericEntity");
      const root = chain[0];
      const tree = formatClassTree(cls!, engine);
      expect(tree).toContain(root);
    });

    it("uses proper tree indentation with └── connectors", () => {
      const cls = engine.getClass("GenericEntity");
      expect(cls).toBeDefined();
      const tree = formatClassTree(cls!, engine);
      expect(tree).toContain("└──");
    });

    it("deeper classes have more indentation", () => {
      const cls = engine.getClass("GenericEntity");
      expect(cls).toBeDefined();
      const tree = formatClassTree(cls!, engine);
      const treeLines = tree.split("\n").filter((l) => l.includes("└──"));
      // Each successive line should have more leading whitespace
      for (let i = 1; i < treeLines.length; i++) {
        const prevIndent = treeLines[i - 1].search(/\S/);
        const currIndent = treeLines[i].search(/\S/);
        expect(currIndent).toBeGreaterThan(prevIndent);
      }
    });

    it("shows children of the target class", () => {
      const cls = engine.getClass("IEntity");
      expect(cls).toBeDefined();
      if (cls!.children.length > 0) {
        const tree = formatClassTree(cls!, engine);
        // At least one child should appear
        expect(tree).toContain(cls!.children[0]);
      }
    });

    it("uses ├── and └── for children", () => {
      const cls = engine.getClass("IEntity");
      expect(cls).toBeDefined();
      if (cls!.children.length > 1) {
        const tree = formatClassTree(cls!, engine);
        expect(tree).toContain("├──");
        expect(tree).toContain("└──");
      }
    });

    it("renders a root class (no parents) with just target and children", () => {
      // Find a root class (one that has no parents in the chain)
      const chain = engine.getInheritanceChain("Managed");
      if (chain.length === 1) {
        const cls = engine.getClass("Managed");
        expect(cls).toBeDefined();
        const tree = formatClassTree(cls!, engine);
        expect(tree).toContain("Class Hierarchy: Managed");
        expect(tree).toContain("◀ TARGET");
        // Root should appear without └── prefix (it's the first line)
        const lines = tree.split("\n");
        const rootLine = lines.find((l) => l.includes("Managed") && l.includes("◀ TARGET"));
        expect(rootLine).toBeDefined();
        expect(rootLine!.trimStart().startsWith("Managed")).toBe(true);
      }
    });

    it("includes source info in footer", () => {
      const cls = engine.getClass("GenericEntity");
      expect(cls).toBeDefined();
      const tree = formatClassTree(cls!, engine);
      expect(tree).toMatch(/Source: (Enfusion Engine|Arma Reforger) API/);
    });

    it("notes secondary parents for multi-inheritance", () => {
      // Find a class with multiple parents
      const allNames = engine.getAllClassNames();
      let multiParentClass = null;
      for (const name of allNames) {
        const cls = engine.getClass(name);
        if (cls && cls.parents.length > 1) {
          multiParentClass = cls;
          break;
        }
      }
      if (multiParentClass) {
        const tree = formatClassTree(multiParentClass, engine);
        expect(tree).toContain("Also inherits from:");
        expect(tree).toContain(multiParentClass.parents[1]);
      }
    });

    it("caps children at MAX_TREE_CHILDREN", () => {
      // Find a class with many children
      const allNames = engine.getAllClassNames();
      let wideClass = null;
      for (const name of allNames) {
        const cls = engine.getClass(name);
        if (cls && cls.children.length > MAX_TREE_CHILDREN) {
          wideClass = cls;
          break;
        }
      }
      if (wideClass) {
        const tree = formatClassTree(wideClass, engine);
        expect(tree).toContain(`... and ${wideClass.children.length - MAX_TREE_CHILDREN} more`);
      }
    });
  });
});
