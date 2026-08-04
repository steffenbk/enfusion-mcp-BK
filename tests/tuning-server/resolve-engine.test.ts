// tests/tuning-server/resolve-engine.test.ts
import { describe, it, expect } from "vitest";
import { resolveEngineFields } from "../../src/tuning-server/resolve-engine.js";

const MOD_ET_WITH_REF = `Vehicle : "{BBBB}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{CEA5458AC6B97274}Prefabs/Vehicles/Core/Configs/Engines/Engine_M151.conf" {
     MaxPower 75
    }
   }
  }
 }
}
`;

const ENGINE_M151_CONF = `Engine {
 Inertia 0.3
 MaxPower 53
 MaxTorque 176
 RpmMaxPower 4000
 RpmMaxTorque 1800
 Steepness 15
 Friction 53
 RpmIdle 840
 RpmMax 6000
}
`;

const MOD_ET_NO_REF = `Vehicle : "{CCCC}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 120
    }
   }
  }
 }
}
`;

const VANILLA_ET_INLINE = `Vehicle : "{DDDD}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     Inertia 1.3
     MaxPower 103
     MaxTorque 383
     RpmMaxPower 3300
     RpmMaxTorque 2500
     Steepness 12
     Friction 140
     RpmIdle 600
     RpmMax 4000
    }
   }
  }
 }
}
`;

const MOD_ET_M998_NO_REF = `Vehicle : "{EEEE}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 150
    }
   }
  }
 }
}
`;

const VANILLA_ET_M998_WITH_REF = `Vehicle : "{FFFF}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{9A9A9A9A9A9A9A9A}Prefabs/Vehicles/Core/Configs/Engines/Engine_M998.conf" {
    }
   }
  }
 }
}
`;

const ENGINE_M998_CONF = `Engine {
 Inertia 0.5
 MaxPower 135
 MaxTorque 305
 RpmMaxPower 3400
 RpmMaxTorque 2000
 Steepness 14
 Friction 90
 RpmIdle 700
 RpmMax 4200
}
`;

const MOD_ET_M35_NO_REF = `Vehicle : "{1111}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 200
    }
   }
  }
 }
}
`;

const VANILLA_ET_M35_WITH_REF_AND_INLINE = `Vehicle : "{2222}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine : "{3333333333333333}Prefabs/Vehicles/Core/Configs/Engines/Engine_M35.conf" {
     Steepness 25
    }
   }
  }
 }
}
`;

const ENGINE_M35_CONF = `Engine {
 Inertia 0.7
 MaxPower 130
 MaxTorque 420
 RpmMaxPower 2800
 RpmMaxTorque 1400
 Steepness 18
 Friction 110
 RpmIdle 650
 RpmMax 3200
}
`;

describe("resolveEngineFields", () => {
  it("marks a field written in the mod .et as overridden and the rest as inherited", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_WITH_REF,
      relPath: "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et",
      extractedPath: "E:/mirror",
      readFile: (p) => (p.includes("Engine_M151.conf") ? ENGINE_M151_CONF : null),
    });
    expect(r.MaxPower).toEqual({ value: 75, source: "overridden" });
    expect(r.MaxTorque).toEqual({ value: 176, source: "inherited" });
    expect(r.RpmIdle).toEqual({ value: 840, source: "inherited" });
  });

  it("falls back to the same-path vanilla .et when the block has no conf reference", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
      extractedPath: "E:/mirror",
      readFile: (p) => (p.includes("BRDM2_base.et") ? VANILLA_ET_INLINE : null),
    });
    expect(r.MaxPower).toEqual({ value: 120, source: "overridden" });
    expect(r.Steepness).toEqual({ value: 12, source: "inherited" });
    expect(r.Friction).toEqual({ value: 140, source: "inherited" });
  });

  it("marks fields unresolved when no baseline can be read", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/BRDM2/BRDM2_base.et",
      extractedPath: undefined,
      readFile: () => null,
    });
    expect(r.MaxPower).toEqual({ value: 120, source: "overridden" });
    expect(r.Steepness).toEqual({ value: null, source: "unresolved" });
  });

  it("falls back through a vanilla .et that itself only references a conf", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_M998_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/M998/M998_base.et",
      extractedPath: "E:/mirror",
      readFile: (p) =>
        p.includes("M998_base.et")
          ? VANILLA_ET_M998_WITH_REF
          : p.includes("Engine_M998.conf")
            ? ENGINE_M998_CONF
            : null,
    });
    expect(r.MaxPower).toEqual({ value: 150, source: "overridden" });
    expect(r.MaxTorque).toEqual({ value: 305, source: "inherited" });
    expect(r.RpmIdle).toEqual({ value: 700, source: "inherited" });
  });

  it("reads the vanilla conf baseline even when the vanilla block also has an inline override", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_M35_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/M35/M35_base.et",
      extractedPath: "E:/mirror",
      readFile: (p) =>
        p.includes("M35_base.et")
          ? VANILLA_ET_M35_WITH_REF_AND_INLINE
          : p.includes("Engine_M35.conf")
            ? ENGINE_M35_CONF
            : null,
    });
    expect(r.MaxPower).toEqual({ value: 200, source: "overridden" });
    // Steepness is overridden inline in the vanilla block (25), which must win
    // over the conf's own Steepness (18).
    expect(r.Steepness).toEqual({ value: 25, source: "inherited" });
    // MaxTorque is only in the referenced conf, not inline in the vanilla block,
    // so it must still resolve via confFromRef even though the vanilla block
    // also has an inline field on another key.
    expect(r.MaxTorque).toEqual({ value: 420, source: "inherited" });
    expect(r.RpmIdle).toEqual({ value: 650, source: "inherited" });
  });

  it("returns all nine keys regardless of what resolved", () => {
    const r = resolveEngineFields({
      modText: MOD_ET_NO_REF,
      relPath: "Prefabs/Vehicles/Wheeled/X/X.et",
      readFile: () => null,
    });
    expect(Object.keys(r).sort()).toEqual(
      ["Friction", "Inertia", "MaxPower", "MaxTorque", "RpmIdle", "RpmMax", "RpmMaxPower", "RpmMaxTorque", "Steepness"].sort()
    );
  });
});

describe("resolveEngineFields, parent chain", () => {
  // join() gives OS-native separators; normalise back to the map's posix keys.
  const norm = (p: string) => p.split("\\").join("/").replace("/addon/", "");

  const et = (parent: string | null, fields: string) =>
    `Vehicle${parent ? ` : "${parent}"` : ""} {\n components {\n  VehicleWheeledSimulation "{7}" {\n   Simulation Wheeled "{4}" {\n    Engine Engine Engine {\n${fields}\n    }\n   }\n  }\n }\n}\n`;

  it("takes a field deleted from the child from its nearest ancestor", () => {
    // The child overrides only MaxPower; RpmMax was set back to default and so is
    // absent from the file entirely — exactly what Workbench writes.
    const files: Record<string, string> = {
      "A/Base.et": et(null, "     RpmMax 6000\n     MaxPower 50"),
      "A/Mid.et": et("{BBBB2222}A/Base.et", "     MaxPower 60"),
    };
    const child = et("{AAAA1111}A/Mid.et", "     MaxPower 75");

    const r = resolveEngineFields({
      modText: child,
      relPath: "A/Child.et",
      addonPath: "/addon",
      readFile: (p) => files[norm(p)] ?? null,
    });

    expect(r.MaxPower).toEqual({ value: 75, source: "overridden" });
    expect(r.RpmMax).toEqual({ value: 6000, source: "inherited" });
  });

  it("prefers the nearest ancestor when several define the same field", () => {
    const files: Record<string, string> = {
      "A/Base.et": et(null, "     RpmMax 6000"),
      "A/Mid.et": et("{BBBB2222}A/Base.et", "     RpmMax 7000"),
    };
    const r = resolveEngineFields({
      modText: et("{AAAA1111}A/Mid.et", "     MaxPower 75"),
      relPath: "A/Child.et",
      addonPath: "/addon",
      readFile: (p) => files[norm(p)] ?? null,
    });
    expect(r.RpmMax).toEqual({ value: 7000, source: "inherited" });
  });

  it("survives a cyclic parent reference instead of hanging", () => {
    const files: Record<string, string> = {
      "A/X.et": et("{CCCC3333}A/Y.et", "     RpmMax 6000"),
      "A/Y.et": et("{CCCC3333}A/X.et", "     MaxPower 10"),
    };
    const r = resolveEngineFields({
      modText: et("{CCCC3333}A/X.et", ""),
      relPath: "A/Child.et",
      addonPath: "/addon",
      readFile: (p) => files[norm(p)] ?? null,
    });
    expect(r.RpmMax.value).toBe(6000);
  });
});
