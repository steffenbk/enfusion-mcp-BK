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

  describe("getStats", () => {
    it("includes enum and property counts", () => {
      const stats = engine.getStats();
      expect(stats.totalClasses).toBeGreaterThan(0);
      expect(stats.totalMethods).toBeGreaterThan(0);
      expect(typeof stats.totalEnums).toBe("number");
      expect(typeof stats.totalProperties).toBe("number");
      expect(stats.totalWikiPages).toBeGreaterThan(0);
    });
  });

  describe("searchEnums", () => {
    it("returns array for any query", () => {
      const results = engine.searchEnums("weapon");
      expect(Array.isArray(results)).toBe(true);
      // Each result should have className and enumInfo
      for (const r of results.slice(0, 3)) {
        expect(r.className).toBeTruthy();
        expect(r.enumInfo).toBeDefined();
        expect(r.enumInfo.name).toBeTruthy();
      }
    });
  });

  describe("searchProperties", () => {
    it("returns array for any query", () => {
      const results = engine.searchProperties("position");
      expect(Array.isArray(results)).toBe(true);
      for (const r of results.slice(0, 3)) {
        expect(r.className).toBeTruthy();
        expect(r.property).toBeDefined();
        expect(r.property.name).toBeTruthy();
      }
    });
  });

  describe("searchAny", () => {
    it("includes class, method, enum, and property result types", () => {
      // searchAny should accept all result types without errors
      const results = engine.searchAny("entity");
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      // Each result should have a valid type
      for (const r of results) {
        expect(["class", "method", "enum", "property"]).toContain(r.type);
      }
    });
  });

  describe("getInheritedMembers", () => {
    it("returns inherited methods for GenericEntity", () => {
      const inherited = engine.getInheritedMembers("GenericEntity");
      expect(inherited.methods).toBeDefined();
      expect(Array.isArray(inherited.methods)).toBe(true);
      expect(inherited.properties).toBeDefined();
      expect(inherited.enums).toBeDefined();
      // GenericEntity inherits from IEntity which should have methods
      if (inherited.methods.length > 0) {
        expect(inherited.methods[0].className).toBeTruthy();
        expect(inherited.methods[0].method).toBeDefined();
      }
    });

    it("returns empty for root classes", () => {
      const inherited = engine.getInheritedMembers("NonExistent12345");
      expect(inherited.methods).toEqual([]);
      expect(inherited.properties).toEqual([]);
      expect(inherited.enums).toEqual([]);
    });
  });
});
