import { describe, it, expect } from "vitest";
import {
  findEngineBlock,
  readEngineFieldsFromBlock,
  countUnquotedBraces,
  writeEngineFields,
} from "../../src/tuning-server/et-engine-block.js";

// Shape of RoadForger/Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et:
// has Simulation Wheeled with a Gearbox, but NO Engine block.
const URAL_NO_ENGINE = `Vehicle : "{E03D5609EEA6E03D}Prefabs/Vehicles/Core/Wheeled_Truck_Base.et" {
 ID "0000000000000001"
 components {
  SCR_TerrainDragComponent_BK "{6A81C5A0B3D14E22}" {
   m_fMaxSpeedKmh 95
  }
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Gearbox Gearbox Gearbox {
     Forward {
      10 3.4 2.25 1.48 1
     }
    }
   }
  }
 }
 coords 1213.632 39 2355.943
}
`;

// Shape of vanilla S105_rally.et / BRDM2_base.et: full inline Engine block, no conf reference.
const INLINE_ENGINE = `Vehicle : "{AAAA}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     Inertia 0.3
     MaxPower 100
     MaxTorque 135
     RpmMaxPower 7500
     RpmMaxTorque 5500
     Steepness 15
     Friction 41
     RpmIdle 840
     RpmRedline 8500
     RpmMax 9000
    }
    Clutch Clutch Clutch {
     MaxTorque 250
    }
   }
  }
 }
}
`;

// Shape of vanilla M151A2.et: Engine references a .conf and overrides only Output.
const REF_ENGINE = `Vehicle : "{BBBB}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {
 components {
  SCR_VehicleSoundComponent "{55C2E66AD4EF2CA6}" {
   Filenames + {
    "{D89573B95647C34A}Sounds/A.acp" "{A117C96F2734B916}Sounds/B.acp"
   }
  }
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf" {
     Output "Clutch"
    }
   }
  }
 }
}
`;

describe("countUnquotedBraces", () => {
  it("ignores braces inside quoted strings (GUIDs)", () => {
    expect(countUnquotedBraces(`  Engine : "{CEA5458AC6B97274}path.conf" {`)).toBe(1);
  });

  it("counts a plain opening brace", () => {
    expect(countUnquotedBraces("  Gearbox {")).toBe(1);
  });

  it("counts a plain closing brace", () => {
    expect(countUnquotedBraces("  }")).toBe(-1);
  });

  it("nets to zero for a single-line block", () => {
    expect(countUnquotedBraces("  Foo { }")).toBe(0);
  });
});

describe("findEngineBlock", () => {
  it("returns null when the vehicle has Simulation Wheeled but no Engine block", () => {
    expect(findEngineBlock(URAL_NO_ENGINE)).toBeNull();
  });

  it("returns null when there is no VehicleWheeledSimulation at all", () => {
    const noSim = `Vehicle : "{CCCC}Base.et" {\n components {\n  SCR_Foo "{DDDD}" {\n  }\n }\n}\n`;
    expect(findEngineBlock(noSim)).toBeNull();
  });

  it("locates an inline Engine block and its field indentation", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    expect(loc).not.toBeNull();
    const lines = INLINE_ENGINE.split("\n");
    expect(lines[loc.openLine].trim()).toBe("Engine Engine Engine {");
    expect(lines[loc.closeLine].trim()).toBe("}");
    expect(loc.fieldIndent).toBe("     "); // 5 spaces, one deeper than the header's 4
    expect(loc.inheritance).toBeUndefined();
  });

  it("does not mistake the Clutch block's MaxTorque for the Engine's", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const fields = readEngineFieldsFromBlock(INLINE_ENGINE, loc);
    expect(fields.MaxTorque).toBe(135); // Engine's, not Clutch's 250
  });

  it("captures the conf reference on a referencing Engine block", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    expect(loc.inheritance).toBe(
      "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf"
    );
  });

  it("is not confused by a Filenames + block earlier in the file", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const lines = REF_ENGINE.split("\n");
    expect(lines[loc.openLine]).toContain("Engine Engine Engine");
  });
});

describe("readEngineFieldsFromBlock", () => {
  it("reads all present fields from an inline block, ignoring RpmRedline", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const fields = readEngineFieldsFromBlock(INLINE_ENGINE, loc);
    expect(fields).toEqual({
      Inertia: 0.3,
      MaxPower: 100,
      MaxTorque: 135,
      RpmMaxPower: 7500,
      RpmMaxTorque: 5500,
      Steepness: 15,
      Friction: 41,
      RpmIdle: 840,
      RpmMax: 9000,
    });
    expect("RpmRedline" in fields).toBe(false);
  });

  it("returns an empty object for a block that only overrides Output", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    expect(readEngineFieldsFromBlock(REF_ENGINE, loc)).toEqual({});
  });
});

describe("writeEngineFields", () => {
  it("replaces an existing field in place and changes nothing else", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxPower: 175 });

    const before = INLINE_ENGINE.split("\n");
    const after = out.split("\n");
    expect(after.length).toBe(before.length);

    const differing = after.filter((l, i) => l !== before[i]);
    expect(differing).toEqual(["     MaxPower 175"]);
  });

  it("preserves the RpmRedline line it does not manage", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxPower: 175 });
    expect(out).toContain("RpmRedline 8500");
  });

  it("does not touch the Clutch block's MaxTorque when writing the Engine's", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    const out = writeEngineFields(INLINE_ENGINE, loc, { MaxTorque: 999 });
    expect(out).toContain("MaxTorque 999");
    expect(out).toContain("MaxTorque 250"); // Clutch's, untouched
  });

  it("inserts a missing field inside the block using the block's indentation", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const out = writeEngineFields(REF_ENGINE, loc, { MaxPower: 75 });

    const before = REF_ENGINE.split("\n");
    const after = out.split("\n");
    expect(after.length).toBe(before.length + 1);
    expect(out).toContain("     MaxPower 75");
    // inserted inside the block, before its closing brace
    const idx = after.findIndex((l) => l.trim() === "MaxPower 75");
    expect(after[idx - 1].trim()).toBe('Output "Clutch"');
  });

  it("preserves the + array-append operator elsewhere in the file", () => {
    const loc = findEngineBlock(REF_ENGINE)!;
    const out = writeEngineFields(REF_ENGINE, loc, { MaxPower: 75 });
    expect(out).toContain("Filenames + {");
  });

  it("writes nothing when there are no changes", () => {
    const loc = findEngineBlock(INLINE_ENGINE)!;
    expect(writeEngineFields(INLINE_ENGINE, loc, {})).toBe(INLINE_ENGINE);
  });

  it("preserves CRLF line endings", () => {
    const crlf = INLINE_ENGINE.replace(/\n/g, "\r\n");
    const loc = findEngineBlock(crlf)!;
    const out = writeEngineFields(crlf, loc, { MaxPower: 175 });
    expect(out).toContain("\r\n");
    expect(out).toContain("MaxPower 175");
    expect(out.includes("\n\n")).toBe(false);
  });
});
