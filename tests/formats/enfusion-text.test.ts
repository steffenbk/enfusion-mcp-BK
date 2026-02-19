import { describe, it, expect } from "vitest";
import { parse, serialize, createNode, setProperty, getProperty } from "../../src/formats/enfusion-text.js";
import { generateGuid } from "../../src/formats/guid.js";

describe("generateGuid", () => {
  it("produces 16-char uppercase hex", () => {
    const guid = generateGuid();
    expect(guid).toMatch(/^[0-9A-F]{16}$/);
  });

  it("produces unique values", () => {
    const a = generateGuid();
    const b = generateGuid();
    expect(a).not.toBe(b);
  });
});

describe("enfusion-text parser", () => {
  it("parses minimal .gproj", () => {
    const input = `GameProject {
 ID "TestMod"
 GUID "6156F2F771D5D73D"
}`;
    const node = parse(input);
    expect(node.type).toBe("GameProject");
    expect(getProperty(node, "ID")).toBe("TestMod");
    expect(getProperty(node, "GUID")).toBe("6156F2F771D5D73D");
  });

  it("parses .gproj with dependencies", () => {
    const input = `GameProject {
 ID "MyMod"
 GUID "AAAAAAAAAAAAAAAA"
 TITLE "My Mod"
 Dependencies {
  "58D0FB3206B6F859"
 }
}`;
    const node = parse(input);
    expect(node.type).toBe("GameProject");
    expect(getProperty(node, "TITLE")).toBe("My Mod");

    const deps = node.children.find((c) => c.type === "Dependencies");
    expect(deps).toBeDefined();
    expect(deps!.values).toContain("58D0FB3206B6F859");
  });

  it("parses .gproj with nested configurations", () => {
    const input = `GameProject {
 ID "TestMod"
 GUID "BBBBBBBBBBBBBBBB"
 Configurations {
  GameProjectConfig PC {
   ScriptProjectManagerSettings ScriptProjectManagerSettings "{CCCCCCCCCCCCCCCC}" {
    Configurations {
     ScriptConfigurationClass workbench {
      Defines {
       "PLATFORM_WINDOWS" "ENF_WB" "WORKBENCH"
      }
     }
    }
   }
  }
  GameProjectConfig HEADLESS {
  }
 }
}`;
    const node = parse(input);
    expect(node.type).toBe("GameProject");

    const configs = node.children.find((c) => c.type === "Configurations");
    expect(configs).toBeDefined();
    expect(configs!.children.length).toBe(2);

    const pcConfig = configs!.children.find((c) => c.id === "PC");
    expect(pcConfig).toBeDefined();
    expect(pcConfig!.type).toBe("GameProjectConfig");
  });

  it("parses simple .et prefab", () => {
    const input = `GenericEntity : "{AABB}Prefabs/Base.et" {
 ID "1234567890ABCDEF"
 components {
  MeshObject "{5584D66370FCAEF1}" {
  }
 }
}`;
    const node = parse(input);
    expect(node.type).toBe("GenericEntity");
    expect(node.inheritance).toBe("{AABB}Prefabs/Base.et");
    expect(getProperty(node, "ID")).toBe("1234567890ABCDEF");

    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    expect(comps!.children.length).toBe(1);
    expect(comps!.children[0].type).toBe("MeshObject");
    expect(comps!.children[0].id).toBe("{5584D66370FCAEF1}");
  });

  it("parses .et with multiple components and properties", () => {
    const input = `GenericEntity {
 ID "DDDDDDDDDDDDDDDD"
 components {
  SCR_EditableEntityComponent "{EEEEEEEEEEEEEEEE}" {
   m_sDisplayName "Test Entity"
   m_bAutoRegister 1
  }
  ActionsManagerComponent "{FFFFFFFFFFFFFFFF}" {
   ActionContexts {
    UserActionContext "{1111111111111111}" {
     ContextName "default"
    }
   }
  }
 }
}`;
    const node = parse(input);
    const comps = node.children.find((c) => c.type === "components");
    expect(comps).toBeDefined();
    expect(comps!.children.length).toBe(2);

    const editable = comps!.children[0];
    expect(editable.type).toBe("SCR_EditableEntityComponent");
    expect(getProperty(editable, "m_sDisplayName")).toBe("Test Entity");
    expect(getProperty(editable, "m_bAutoRegister")).toBe("1");
  });

  it("handles empty blocks", () => {
    const input = `Empty {
}`;
    const node = parse(input);
    expect(node.type).toBe("Empty");
    expect(node.properties).toEqual([]);
    expect(node.children).toEqual([]);
    expect(node.values).toEqual([]);
  });
});

describe("enfusion-text serializer", () => {
  it("serializes minimal node", () => {
    const node = createNode("GameProject", {
      properties: [
        { key: "ID", value: "TestMod" },
        { key: "GUID", value: "AAAA0000BBBB1111" },
      ],
    });
    const text = serialize(node);
    expect(text).toContain("GameProject {");
    expect(text).toContain('ID "TestMod"');
    expect(text).toContain('GUID "AAAA0000BBBB1111"');
    expect(text).toContain("}");
  });

  it("serializes node with inheritance", () => {
    const node = createNode("GenericEntity", {
      inheritance: "{GUID}Prefabs/Base.et",
      properties: [{ key: "ID", value: "1234567890ABCDEF" }],
    });
    const text = serialize(node);
    expect(text).toContain('GenericEntity : "{GUID}Prefabs/Base.et" {');
  });

  it("serializes node with quoted GUID id", () => {
    const node = createNode("MeshObject", {
      id: "5584D66370FCAEF1",
    });
    const text = serialize(node);
    expect(text).toContain('MeshObject "5584D66370FCAEF1" {');
  });

  it("serializes node with bare word id", () => {
    const node = createNode("GameProjectConfig", {
      id: "PC",
    });
    const text = serialize(node);
    expect(text).toContain("GameProjectConfig PC {");
  });

  it("serializes standalone values", () => {
    const node = createNode("Dependencies", {
      values: ["58D0FB3206B6F859"],
    });
    const text = serialize(node);
    expect(text).toContain('"58D0FB3206B6F859"');
  });

  it("serializes nested children", () => {
    const inner = createNode("MeshObject", { id: "AAAAAAAAAAAAAAAA" });
    const comps = createNode("components", { children: [inner] });
    const root = createNode("GenericEntity", {
      properties: [{ key: "ID", value: "BBBBBBBBBBBBBBBB" }],
      children: [comps],
    });
    const text = serialize(root);
    expect(text).toContain("GenericEntity {");
    expect(text).toContain("components {");
    expect(text).toContain('MeshObject "AAAAAAAAAAAAAAAA" {');
  });
});

describe("round-trip", () => {
  it("round-trips a .gproj", () => {
    const input = `GameProject {
 ID "MyMod"
 GUID "6156F2F771D5D73D"
 TITLE "My Mod"
 Dependencies {
  "58D0FB3206B6F859"
 }
}`;
    const node = parse(input);
    const output = serialize(node);
    // Re-parse the output to verify structural equivalence
    const node2 = parse(output);
    expect(node2.type).toBe(node.type);
    expect(getProperty(node2, "ID")).toBe(getProperty(node, "ID"));
    expect(getProperty(node2, "GUID")).toBe(getProperty(node, "GUID"));
    expect(getProperty(node2, "TITLE")).toBe(getProperty(node, "TITLE"));
    const deps1 = node.children.find((c) => c.type === "Dependencies");
    const deps2 = node2.children.find((c) => c.type === "Dependencies");
    expect(deps2!.values).toEqual(deps1!.values);
  });

  it("round-trips an .et prefab", () => {
    const input = `GenericEntity : "{AABB}Prefabs/Base.et" {
 ID "1234567890ABCDEF"
 components {
  MeshObject "{5584D66370FCAEF1}" {
  }
  SCR_EditableEntityComponent "{CCCCCCCCCCCCCCCC}" {
   m_sDisplayName "Test"
  }
 }
}`;
    const node = parse(input);
    const output = serialize(node);
    const node2 = parse(output);
    expect(node2.type).toBe("GenericEntity");
    expect(node2.inheritance).toBe("{AABB}Prefabs/Base.et");
    const comps = node2.children.find((c) => c.type === "components");
    expect(comps!.children.length).toBe(2);
    expect(comps!.children[0].type).toBe("MeshObject");
    expect(comps!.children[1].type).toBe("SCR_EditableEntityComponent");
    expect(getProperty(comps!.children[1], "m_sDisplayName")).toBe("Test");
  });
});

describe("createNode / setProperty / getProperty helpers", () => {
  it("creates node with defaults", () => {
    const node = createNode("Test");
    expect(node.type).toBe("Test");
    expect(node.properties).toEqual([]);
    expect(node.values).toEqual([]);
    expect(node.children).toEqual([]);
    expect(node.id).toBeUndefined();
    expect(node.inheritance).toBeUndefined();
  });

  it("setProperty adds new property", () => {
    const node = createNode("Test");
    setProperty(node, "foo", "bar");
    expect(getProperty(node, "foo")).toBe("bar");
  });

  it("setProperty updates existing property", () => {
    const node = createNode("Test", {
      properties: [{ key: "foo", value: "old" }],
    });
    setProperty(node, "foo", "new");
    expect(getProperty(node, "foo")).toBe("new");
    expect(node.properties.length).toBe(1);
  });

  it("serialize escapes quotes and backslashes in string values", () => {
    const node = createNode("Test");
    setProperty(node, "m_sName", 'has "quotes" inside');
    setProperty(node, "m_sPath", "C:\\Users\\test");
    const text = serialize(node);
    expect(text).toContain('has \\"quotes\\" inside');
    expect(text).toContain("C:\\\\Users\\\\test");
  });

  it("round-trips strings with quotes through parse/serialize", () => {
    const node = createNode("Test");
    setProperty(node, "m_sDesc", 'say "hello"');
    const text = serialize(node);
    const parsed = parse(text);
    expect(getProperty(parsed, "m_sDesc")).toBe('say "hello"');
  });

  it("escapes special characters in node id and inheritance", () => {
    const node = createNode("GenericEntity", {
      id: 'has "quotes"',
      inheritance: 'C:\\path\\to "base".et',
    });
    const text = serialize(node);
    expect(text).toContain('has \\"quotes\\"');
    expect(text).toContain('C:\\\\path\\\\to \\"base\\".et');
    // Round-trip
    const parsed = parse(text);
    expect(parsed.id).toBe('has "quotes"');
    expect(parsed.inheritance).toBe('C:\\path\\to "base".et');
  });
});
