import { describe, it, expect } from "vitest";
import { generateGproj } from "../../src/templates/gproj.js";
import { parse, getProperty } from "../../src/formats/enfusion-text.js";

describe("generateGproj", () => {
  it("generates valid Enfusion text", () => {
    const text = generateGproj({ name: "TestMod" });
    const node = parse(text);
    expect(node.type).toBe("GameProject");
    expect(getProperty(node, "ID")).toBe("TestMod");
    expect(getProperty(node, "TITLE")).toBe("TestMod");
  });

  it("includes base game dependency", () => {
    const text = generateGproj({ name: "TestMod" });
    const node = parse(text);
    const deps = node.children.find((c) => c.type === "Dependencies");
    expect(deps).toBeDefined();
    expect(deps!.values).toContain("58D0FB3206B6F859");
  });

  it("uses provided GUID", () => {
    const text = generateGproj({ name: "TestMod", guid: "AAAAAAAAAAAAAAAA" });
    const node = parse(text);
    expect(getProperty(node, "GUID")).toBe("AAAAAAAAAAAAAAAA");
  });

  it("uses custom title", () => {
    const text = generateGproj({ name: "TestMod", title: "My Awesome Mod" });
    const node = parse(text);
    expect(getProperty(node, "TITLE")).toBe("My Awesome Mod");
  });

  it("adds extra dependencies", () => {
    const text = generateGproj({
      name: "TestMod",
      dependencies: ["BBBBBBBBBBBBBBBB"],
    });
    const node = parse(text);
    const deps = node.children.find((c) => c.type === "Dependencies");
    expect(deps!.values).toContain("58D0FB3206B6F859");
    expect(deps!.values).toContain("BBBBBBBBBBBBBBBB");
  });

  it("includes platform configurations", () => {
    const text = generateGproj({ name: "TestMod" });
    const node = parse(text);
    const configs = node.children.find((c) => c.type === "Configurations");
    expect(configs).toBeDefined();
    const pcConfig = configs!.children.find((c) => c.id === "PC");
    expect(pcConfig).toBeDefined();
    expect(pcConfig!.type).toBe("GameProjectConfig");
    const headlessConfig = configs!.children.find((c) => c.id === "HEADLESS");
    expect(headlessConfig).toBeDefined();
  });

  it("does not include ScriptProjectManagerSettings", () => {
    const text = generateGproj({ name: "TestMod" });
    expect(text).not.toContain("ScriptProjectManagerSettings");
  });

  it("contains GameProject as root", () => {
    const text = generateGproj({ name: "TestMod" });
    expect(text.startsWith("GameProject {")).toBe(true);
  });
});
