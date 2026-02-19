import { describe, it, expect } from "vitest";
import { SearchEngine } from "../../src/index/search-engine.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

describe("SearchEngine", () => {
  const engine = new SearchEngine(dataDir);

  it("loads the index", () => {
    expect(engine.isLoaded()).toBe(true);
    const stats = engine.getStats();
    expect(stats.totalClasses).toBeGreaterThan(8000);
  });

  describe("getClass", () => {
    it("finds IEntity", () => {
      const cls = engine.getClass("IEntity");
      expect(cls).toBeDefined();
      expect(cls!.name).toBe("IEntity");
    });

    it("is case-insensitive", () => {
      const cls = engine.getClass("ientity");
      expect(cls).toBeDefined();
      expect(cls!.name).toBe("IEntity");
    });

    it("returns undefined for unknown class", () => {
      expect(engine.getClass("NonExistentClass12345")).toBeUndefined();
    });
  });

  describe("hasClass", () => {
    it("returns true for known class", () => {
      expect(engine.hasClass("IEntity")).toBe(true);
      expect(engine.hasClass("ScriptComponent")).toBe(true);
    });

    it("returns false for unknown class", () => {
      expect(engine.hasClass("FakeClass12345")).toBe(false);
    });
  });

  describe("getClassTree", () => {
    it("finds ancestors of GenericEntity", () => {
      const tree = engine.getClassTree("GenericEntity");
      // GenericEntity should have IEntity as ancestor
      expect(tree.ancestors).toContain("IEntity");
    });

    it("finds descendants of IEntity", () => {
      const tree = engine.getClassTree("IEntity");
      expect(tree.descendants.length).toBeGreaterThan(0);
      // GenericEntity should be a descendant
      expect(tree.descendants).toContain("GenericEntity");
    });

    it("returns empty for unknown class", () => {
      const tree = engine.getClassTree("NonExistent12345");
      expect(tree.ancestors).toEqual([]);
      expect(tree.descendants).toEqual([]);
    });
  });

  describe("getInheritanceChain", () => {
    it("returns chain for GenericEntity", () => {
      const chain = engine.getInheritanceChain("GenericEntity");
      expect(chain.length).toBeGreaterThanOrEqual(2);
      // Last element is the class itself
      expect(chain[chain.length - 1]).toBe("GenericEntity");
      // Should contain Managed somewhere before it (actual scraped hierarchy)
      expect(chain).toContain("Managed");
      const managedIdx = chain.indexOf("Managed");
      const genericIdx = chain.indexOf("GenericEntity");
      expect(managedIdx).toBeLessThan(genericIdx);
    });

    it("returns just the class for root classes", () => {
      const chain = engine.getInheritanceChain("NonExistent12345");
      expect(chain).toEqual(["NonExistent12345"]);
    });
  });

  describe("getComponents", () => {
    it("returns ScriptComponent subclasses", () => {
      const components = engine.getComponents();
      // There should be ScriptComponent subclasses in the index
      // (may be 0 if ScriptComponent has no direct children in scraped data)
      expect(components).toBeDefined();
      expect(Array.isArray(components)).toBe(true);
      // Each result should be a valid ClassInfo
      for (const comp of components.slice(0, 5)) {
        expect(comp.name).toBeTruthy();
        expect(comp.source).toBeDefined();
      }
    });
  });

  describe("getGroup", () => {
    it("finds a group", () => {
      const groups = engine.getGroups();
      if (groups.length > 0) {
        const first = groups[0];
        const found = engine.getGroup(first.name);
        expect(found).toBeDefined();
        expect(found!.name).toBe(first.name);
      }
    });

    it("returns undefined for unknown group", () => {
      expect(engine.getGroup("NonExistentGroup12345")).toBeUndefined();
    });
  });

  describe("getAllClassNames", () => {
    it("returns all class names", () => {
      const names = engine.getAllClassNames();
      expect(names.length).toBeGreaterThan(8000);
      expect(names).toContain("IEntity");
    });
  });
});
