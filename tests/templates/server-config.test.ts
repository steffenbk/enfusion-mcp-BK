import { describe, it, expect } from "vitest";
import { generateServerConfig } from "../../src/templates/server-config.js";

describe("generateServerConfig", () => {
  it("returns valid JSON", () => {
    const result = generateServerConfig({ name: "Test Server" });
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
  });

  it("sets server name", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "My Server" })
    );
    expect(result.game.name).toBe("My Server");
  });

  it("defaults port to 2001", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test" })
    );
    expect(result.gameHostBindPort).toBe(2001);
  });

  it("defaults maxPlayers to 32", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test" })
    );
    expect(result.game.maxPlayers).toBe(32);
  });

  it("defaults visible to false", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test" })
    );
    expect(result.game.visible).toBe(false);
  });

  it("uses custom port", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test", port: 3000 })
    );
    expect(result.gameHostBindPort).toBe(3000);
    expect(result.gameHostRegisterPort).toBe(3000);
  });

  it("uses custom maxPlayers", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test", maxPlayers: 64 })
    );
    expect(result.game.maxPlayers).toBe(64);
  });

  it("sets password", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test", password: "secret" })
    );
    expect(result.game.password).toBe("secret");
  });

  it("includes mod entry when modName provided", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test", modName: "MyMod", modId: "ABC123" })
    );
    expect(result.game.mods).toHaveLength(1);
    expect(result.game.mods[0].name).toBe("MyMod");
    expect(result.game.mods[0].modId).toBe("ABC123");
  });

  it("has empty mods when no mod info provided", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test" })
    );
    expect(result.game.mods).toHaveLength(0);
  });

  it("sets scenarioId", () => {
    const result = JSON.parse(
      generateServerConfig({
        name: "Test",
        scenarioId: "{AABB}Missions/Header.conf",
      })
    );
    expect(result.game.scenarioId).toBe("{AABB}Missions/Header.conf");
  });

  it("disables battlEye by default", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test" })
    );
    expect(result.game.gameProperties.battlEye).toBe(false);
  });

  it("sets a2s port", () => {
    const result = JSON.parse(
      generateServerConfig({ name: "Test", a2sPort: 18888 })
    );
    expect(result.a2s.port).toBe(18888);
  });
});
