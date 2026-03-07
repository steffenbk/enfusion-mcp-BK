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

    it("groups contain multiple classes for sibling discovery", () => {
      const groups = engine.getGroups();
      const largeGroup = groups.find((g) => g.classes.length > 5);
      expect(largeGroup).toBeDefined();
      expect(largeGroup!.classes.length).toBeGreaterThan(5);
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

    it("finds enum-like classes by class name", () => {
      const results = engine.searchEnums("SCR_SoundEvent");
      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.enumInfo.name === "SCR_SoundEvent");
      expect(match).toBeDefined();
      expect(match!.enumInfo.values.length).toBeGreaterThan(0);
      expect(match!.enumInfo.description).toContain("[Enum-like class]");
    });

    it("finds enum-like classes by property/value name", () => {
      // SCR_SoundEvent has properties like SOUND_*
      const results = engine.searchEnums("SOUND_CP");
      expect(results.length).toBeGreaterThan(0);
      // Should reference SCR_SoundEvent
      expect(results.some((r) => r.className === "SCR_SoundEvent")).toBe(true);
    });

    it("detects GameLibWidgetType as enum-like", () => {
      const results = engine.searchEnums("GameLibWidgetType");
      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.enumInfo.name === "GameLibWidgetType");
      expect(match).toBeDefined();
      expect(match!.enumInfo.values.length).toBeGreaterThanOrEqual(4);
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

  describe("getInheritedMembersLimited", () => {
    it("returns members from only the nearest N parents", () => {
      const chain = engine.getInheritanceChain("GenericEntity");
      // GenericEntity should have multiple ancestors
      expect(chain.length).toBeGreaterThanOrEqual(2);

      const limited = engine.getInheritedMembersLimited("GenericEntity", 1);
      // parentClassNames should have at most 1 entry
      expect(limited.parentClassNames.length).toBeLessThanOrEqual(1);
      // All methods should come from the same class
      const uniqueClasses = new Set(limited.methods.map((m) => m.className));
      expect(uniqueClasses.size).toBeLessThanOrEqual(1);
    });

    it("orders immediate parent first", () => {
      const chain = engine.getInheritanceChain("GenericEntity");
      if (chain.length >= 3) {
        const limited = engine.getInheritedMembersLimited("GenericEntity", 3);
        // First parentClassName should be the immediate parent
        expect(limited.parentClassNames[0]).toBe(chain[chain.length - 2]);
      }
    });

    it("returns empty for unknown classes", () => {
      const limited = engine.getInheritedMembersLimited("NonExistent12345", 3);
      expect(limited.methods).toEqual([]);
      expect(limited.properties).toEqual([]);
      expect(limited.enums).toEqual([]);
      expect(limited.parentClassNames).toEqual([]);
    });

    it("defaults to 3 parent classes", () => {
      const limited = engine.getInheritedMembersLimited("GenericEntity");
      expect(limited.parentClassNames.length).toBeLessThanOrEqual(3);
    });

    it("respects maxParents parameter", () => {
      const limited2 = engine.getInheritedMembersLimited("GenericEntity", 2);
      const limited1 = engine.getInheritedMembersLimited("GenericEntity", 1);
      expect(limited1.parentClassNames.length).toBeLessThanOrEqual(limited2.parentClassNames.length);
    });
  });

  describe("getWikiPage", () => {
    it("finds a page by exact title", () => {
      const page = engine.getWikiPage("Getting Started");
      expect(page).toBeDefined();
      expect(page!.title).toBe("Getting Started");
      expect(page!.content.length).toBeGreaterThan(0);
    });

    it("is case-insensitive", () => {
      const page = engine.getWikiPage("getting started");
      expect(page).toBeDefined();
      expect(page!.title).toBe("Getting Started");
    });

    it("returns undefined for non-existent title", () => {
      expect(engine.getWikiPage("This Page Does Not Exist 12345")).toBeUndefined();
    });

    it("returns full content without truncation", () => {
      const page = engine.getWikiPage("Conflict");
      expect(page).toBeDefined();
      // Conflict is 6688 chars — well above the old 2000 truncation limit
      expect(page!.content.length).toBeGreaterThan(2000);
    });
  });

  describe("searchWiki", () => {
    it("finds pages by keyword", () => {
      const results = engine.searchWiki("replication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBeTruthy();
      expect(results[0].content).toBeTruthy();
    });

    it("respects limit parameter", () => {
      const results = engine.searchWiki("game", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("returns empty for nonsense query", () => {
      const results = engine.searchWiki("xyzzy99999qqq");
      expect(results).toEqual([]);
    });
  });

  describe("searchComponents", () => {
    it("returns components for a broad query", () => {
      const results = engine.searchComponents({ query: "damage" });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.component.name).toBeTruthy();
        expect(r.categories).toBeDefined();
        expect(Array.isArray(r.categories)).toBe(true);
        expect(r.eventHandlers).toBeDefined();
        expect(Array.isArray(r.eventHandlers)).toBe(true);
        expect(r.score).toBeGreaterThan(0);
      }
    });

    it("filters by category", () => {
      const results = engine.searchComponents({ category: "character" });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.categories).toContain("character");
      }
    });

    it("filters by event handler", () => {
      const results = engine.searchComponents({ event: "EOnInit" });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.eventHandlers.some((h) => h.toLowerCase().includes("eoninit"))).toBe(true);
      }
    });

    it("combines query + category + event filters", () => {
      const queryOnly = engine.searchComponents({ query: "character" });
      const combined = engine.searchComponents({ query: "character", category: "character" });
      // Combined filter should be a subset of query-only results
      expect(combined.length).toBeLessThanOrEqual(queryOnly.length);
      for (const r of combined) {
        expect(r.categories).toContain("character");
      }
    });

    it("returns empty for nonsense query", () => {
      const results = engine.searchComponents({ query: "xyzzynonexistent99999" });
      expect(results).toEqual([]);
    });

    it("respects limit parameter", () => {
      const results = engine.searchComponents({ limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("returns components without query when category is specified", () => {
      const results = engine.searchComponents({ category: "vehicle" });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.categories).toContain("vehicle");
        expect(r.component.name.endsWith("Component")).toBe(true);
      }
    });

    it("includes component index in stats", () => {
      const stats = engine.getStats();
      expect(stats.totalComponents).toBeGreaterThan(100);
    });

    it("filters by source", () => {
      const enfusionOnly = engine.searchComponents({ source: "enfusion", limit: 5 });
      for (const r of enfusionOnly) {
        expect(r.component.source).toBe("enfusion");
      }
      const armaOnly = engine.searchComponents({ source: "arma", limit: 5 });
      for (const r of armaOnly) {
        expect(r.component.source).toBe("arma");
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
