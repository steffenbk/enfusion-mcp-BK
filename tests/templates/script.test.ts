import { describe, it, expect } from "vitest";
import { generateScript, getScriptModuleFolder, getScriptFilename } from "../../src/templates/script.js";

describe("generateScript", () => {
  it("generates modded class", () => {
    const code = generateScript({
      className: "SCR_BaseGameMode",
      scriptType: "modded",
      parentClass: "SCR_BaseGameMode",
      methods: ["void OnGameStart()"],
    });
    expect(code).toContain("modded class SCR_BaseGameMode");
    expect(code).toContain("override void OnGameStart()");
    expect(code).toContain("super.OnGameStart();");
  });

  it("modded requires parentClass", () => {
    expect(() =>
      generateScript({ className: "Test", scriptType: "modded" })
    ).toThrow("parentClass");
  });

  it("generates component with default methods", () => {
    const code = generateScript({
      className: "TAG_MyComponent",
      scriptType: "component",
    });
    expect(code).toContain("class TAG_MyComponent : ScriptComponent");
    expect(code).toContain("[ComponentEditorProps(");
    expect(code).toContain("override void EOnInit(IEntity owner)");
    expect(code).toContain("override void OnPostInit(IEntity owner)");
    expect(code).toContain("override void OnDelete(IEntity owner)");
  });

  it("generates component with custom parent", () => {
    const code = generateScript({
      className: "TAG_MyComp",
      scriptType: "component",
      parentClass: "SCR_BaseEditableEntityComponent",
    });
    expect(code).toContain("class TAG_MyComp : SCR_BaseEditableEntityComponent");
  });

  it("generates gamemode with default methods", () => {
    const code = generateScript({
      className: "TAG_GameMode",
      scriptType: "gamemode",
    });
    expect(code).toContain("class TAG_GameMode : SCR_BaseGameMode");
    expect(code).toContain("override void OnGameStart()");
    expect(code).toContain("override void OnPlayerConnected(int playerId)");
    expect(code).toContain("override void OnPlayerSpawned(int playerId, IEntity controlledEntity)");
  });

  it("generates action with default methods", () => {
    const code = generateScript({
      className: "TAG_PickupAction",
      scriptType: "action",
    });
    expect(code).toContain("class TAG_PickupAction : ScriptedUserAction");
    expect(code).toContain("override void PerformAction(");
    expect(code).toContain("override bool CanBePerformedScript(");
    expect(code).toContain("override bool CanBeShownScript(");
  });

  it("generates entity with default methods", () => {
    const code = generateScript({
      className: "TAG_MyEntity",
      scriptType: "entity",
    });
    expect(code).toContain("class TAG_MyEntity : GenericEntity");
    expect(code).toContain("override void EOnInit(IEntity owner)");
    expect(code).toContain("SetEventMask(EntityEvent.FRAME)");
  });

  it("generates manager singleton", () => {
    const code = generateScript({
      className: "TAG_Manager",
      scriptType: "manager",
    });
    expect(code).toContain("class TAG_Manager");
    expect(code).toContain("private static ref TAG_Manager s_Instance");
    expect(code).toContain("static TAG_Manager GetInstance()");
  });

  it("generates basic class", () => {
    const code = generateScript({
      className: "TAG_Helper",
      scriptType: "basic",
    });
    expect(code).toContain("class TAG_Helper");
    expect(code).not.toContain(" : "); // no parent
  });

  it("generates basic class with parent", () => {
    const code = generateScript({
      className: "TAG_Child",
      scriptType: "basic",
      parentClass: "TAG_Parent",
    });
    expect(code).toContain("class TAG_Child : TAG_Parent");
  });

  it("includes description comment", () => {
    const code = generateScript({
      className: "Test",
      scriptType: "basic",
      description: "A test class",
    });
    expect(code).toContain("// A test class");
  });

  it("ends with newline", () => {
    const code = generateScript({
      className: "Test",
      scriptType: "basic",
    });
    expect(code.endsWith("\n")).toBe(true);
  });
});

describe("getScriptModuleFolder", () => {
  it("returns Scripts/Game for all standard types", () => {
    expect(getScriptModuleFolder("component")).toBe("Scripts/Game");
    expect(getScriptModuleFolder("gamemode")).toBe("Scripts/Game");
    expect(getScriptModuleFolder("modded")).toBe("Scripts/Game");
    expect(getScriptModuleFolder("action")).toBe("Scripts/Game");
  });
});

describe("getScriptFilename", () => {
  it("appends .c extension", () => {
    expect(getScriptFilename("TAG_MyComponent")).toBe("TAG_MyComponent.c");
  });
});
