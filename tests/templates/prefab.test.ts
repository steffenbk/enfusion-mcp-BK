import { describe, it, expect } from "vitest";
import { generatePrefab, getPrefabSubdirectory, getPrefabFilename } from "../../src/templates/prefab.js";
import { parse } from "../../src/formats/enfusion-text.js";

describe("generatePrefab", () => {
  it("generates valid Enfusion text for generic prefab", () => {
    const text = generatePrefab({ name: "Test", prefabType: "generic" });
    const node = parse(text);
    expect(node.type).toBe("GenericEntity");
  });

  it("generates spawnpoint prefab with component", () => {
    const text = generatePrefab({ name: "MySpawn", prefabType: "spawnpoint" });
    const node = parse(text);
    expect(node.type).toBe("GenericEntity");
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    const spawnComp = comps!.children.find((c) => c.type === "SCR_SpawnPoint");
    expect(spawnComp).toBeDefined();
  });

  it("generates character prefab", () => {
    const text = generatePrefab({ name: "MyChar", prefabType: "character" });
    const node = parse(text);
    expect(node.type).toBe("SCR_ChimeraCharacter");
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    const invComp = comps!.children.find((c) => c.type === "InventoryStorageManagerComponent");
    expect(invComp).toBeDefined();
  });

  it("generates interactive prefab with actions", () => {
    const text = generatePrefab({ name: "Door", prefabType: "interactive" });
    const node = parse(text);
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    expect(comps!.children.find((c) => c.type === "MeshObject")).toBeDefined();
    expect(comps!.children.find((c) => c.type === "ActionsManagerComponent")).toBeDefined();
  });

  it("includes parent prefab as inheritance", () => {
    const text = generatePrefab({
      name: "MyWeapon",
      prefabType: "weapon",
      parentPrefab: "{AABB}Prefabs/Weapons/AK47.et",
    });
    const node = parse(text);
    expect(node.inheritance).toBe("{AABB}Prefabs/Weapons/AK47.et");
  });

  it("adds custom components", () => {
    const text = generatePrefab({
      name: "Custom",
      prefabType: "generic",
      components: [
        { type: "RigidBody", properties: { m_fMass: "10" } },
      ],
    });
    const node = parse(text);
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    const rb = comps!.children.find((c) => c.type === "RigidBody");
    expect(rb).toBeDefined();
    const massProp = rb!.properties.find((p) => p.key === "m_fMass");
    expect(massProp).toBeDefined();
    expect(massProp!.value).toBe("10");
  });

  it("adds editable component with description", () => {
    const text = generatePrefab({
      name: "Test",
      prefabType: "generic",
      description: "A test entity",
    });
    const node = parse(text);
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    const editable = comps!.children.find((c) => c.type === "SCR_EditableEntityComponent");
    expect(editable).toBeDefined();
    const nameProp = editable!.properties.find((p) => p.key === "m_sDisplayName");
    expect(nameProp).toBeDefined();
    expect(nameProp!.value).toBe("A test entity");
  });

  it("generates gamemode prefab", () => {
    const text = generatePrefab({ name: "MyMode", prefabType: "gamemode" });
    const node = parse(text);
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    expect(comps!.children.find((c) => c.type === "SCR_BaseGameMode")).toBeDefined();
    expect(comps!.children.find((c) => c.type === "SCR_RespawnSystemComponent")).toBeDefined();
  });

  it("all component nodes have GUIDs", () => {
    const text = generatePrefab({ name: "Test", prefabType: "interactive" });
    const node = parse(text);
    const comps = node.children.find((c) => c.type === "components");
    for (const child of comps!.children) {
      expect(child.id).toBeDefined();
      expect(child.id).toMatch(/^\{[0-9A-F]{16}\}$/);
    }
  });
});

describe("getPrefabSubdirectory", () => {
  it("returns correct subdirectories", () => {
    expect(getPrefabSubdirectory("character")).toBe("Prefabs/Characters");
    expect(getPrefabSubdirectory("vehicle")).toBe("Prefabs/Vehicles");
    expect(getPrefabSubdirectory("weapon")).toBe("Prefabs/Weapons");
    expect(getPrefabSubdirectory("spawnpoint")).toBe("Prefabs/Systems");
    expect(getPrefabSubdirectory("interactive")).toBe("Prefabs/Props");
    expect(getPrefabSubdirectory("generic")).toBe("Prefabs");
  });
});

describe("getPrefabFilename", () => {
  it("appends .et extension", () => {
    expect(getPrefabFilename("MyPrefab")).toBe("MyPrefab.et");
  });
});
