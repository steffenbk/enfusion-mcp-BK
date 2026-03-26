import { describe, it, expect } from "vitest";
import {
  stripGuid,
  parseParentPath,
  parseComponents,
  mergeAncestryComponents,
  type AncestorLevel,
} from "../../src/utils/prefab-ancestry.js";

describe("stripGuid", () => {
  it("removes leading GUID prefix", () => {
    expect(stripGuid("{AABBCCDD11223344}Prefabs/Foo.et")).toBe("Prefabs/Foo.et");
  });

  it("returns path unchanged when no GUID prefix", () => {
    expect(stripGuid("Prefabs/Foo.et")).toBe("Prefabs/Foo.et");
  });

  it("does not strip malformed short GUID prefix", () => {
    expect(stripGuid("{AABB}Prefabs/Foo.et")).toBe("{AABB}Prefabs/Foo.et");
  });
});

describe("parseParentPath", () => {
  it("parses entity class and parent with GUID prefix", () => {
    const content = `SCR_ChimeraCharacter : "{AABB112233445566}Prefabs/Base.et" {\n  ID "abc"\n}`;
    const result = parseParentPath(content);
    expect(result.entityClass).toBe("SCR_ChimeraCharacter");
    expect(result.parentPath).toBe("Prefabs/Base.et");
  });

  it("parses entity class and parent without GUID prefix", () => {
    const content = `Vehicle : "Prefabs/VehicleBase.et" {\n  ID "abc"\n}`;
    const result = parseParentPath(content);
    expect(result.entityClass).toBe("Vehicle");
    expect(result.parentPath).toBe("Prefabs/VehicleBase.et");
  });

  it("parses root entity with no parent", () => {
    const content = `GenericEntity {\n  ID "abc"\n}`;
    const result = parseParentPath(content);
    expect(result.entityClass).toBe("GenericEntity");
    expect(result.parentPath).toBeNull();
  });
});

describe("parseComponents", () => {
  it("returns empty map when no components block", () => {
    const content = `GenericEntity {\n  ID "abc"\n}`;
    expect(parseComponents(content).size).toBe(0);
  });

  it("parses a single component", () => {
    const content = `GenericEntity {\n  components {\n   MeshObject "{AABBCCDD11223344}" {\n    Object "foo.xob"\n   }\n  }\n}`;
    const comps = parseComponents(content);
    expect(comps.size).toBe(1);
    const comp = comps.get("AABBCCDD11223344");
    expect(comp).toBeDefined();
    expect(comp!.typeName).toBe("MeshObject");
    expect(comp!.guid).toBe("AABBCCDD11223344");
    expect(comp!.rawBody).toContain('Object "foo.xob"');
  });

  it("parses multiple components with distinct GUIDs", () => {
    const content = `GenericEntity {\n  components {\n   MeshObject "{AAAAAAAAAAAAAAAA}" {\n  }\n   RigidBody "{BBBBBBBBBBBBBBBB}" {\n  }\n  }\n}`;
    const comps = parseComponents(content);
    expect(comps.size).toBe(2);
    expect(comps.has("AAAAAAAAAAAAAAAA")).toBe(true);
    expect(comps.has("BBBBBBBBBBBBBBBB")).toBe(true);
  });
});

describe("mergeAncestryComponents", () => {
  function makeLevel(depth: number, components: Record<string, string>): AncestorLevel {
    const compMap = new Map(
      Object.entries(components).map(([guid, type]) => [
        guid,
        { guid, typeName: type, rawBody: "" },
      ])
    );
    return { path: `level${depth}.et`, depth, entityClass: "GenericEntity", components: compMap, rawContent: "" };
  }

  it("returns empty map for empty levels", () => {
    expect(mergeAncestryComponents([]).size).toBe(0);
  });

  it("returns all components from a single level", () => {
    const level = makeLevel(0, { AAAAAAAAAAAAAAAA: "MeshObject", BBBBBBBBBBBBBBBB: "RigidBody" });
    const merged = mergeAncestryComponents([level]);
    expect(merged.size).toBe(2);
    expect(merged.get("AAAAAAAAAAAAAAAA")!.comp.typeName).toBe("MeshObject");
  });

  it("child overrides parent for same GUID", () => {
    const parent = makeLevel(0, { AAAAAAAAAAAAAAAA: "MeshObject" });
    const child = makeLevel(1, { AAAAAAAAAAAAAAAA: "MeshObject" }); // same GUID, re-declared
    const merged = mergeAncestryComponents([parent, child]);
    expect(merged.size).toBe(1);
    expect(merged.get("AAAAAAAAAAAAAAAA")!.source.depth).toBe(1); // child wins
  });

  it("includes ancestor-only components not present in leaf", () => {
    const parent = makeLevel(0, { AAAAAAAAAAAAAAAA: "MeshObject" });
    const child = makeLevel(1, { BBBBBBBBBBBBBBBB: "RigidBody" }); // different GUID
    const merged = mergeAncestryComponents([parent, child]);
    expect(merged.size).toBe(2);
    expect(merged.has("AAAAAAAAAAAAAAAA")).toBe(true);
    expect(merged.has("BBBBBBBBBBBBBBBB")).toBe(true);
  });
});
