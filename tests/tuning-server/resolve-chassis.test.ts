import { describe, it, expect } from "vitest";
import { resolveChassis } from "../../src/tuning-server/resolve-chassis.js";

// join() gives OS-native separators; normalise back to the map's posix keys.
const norm = (p: string) => p.split("\\").join("/").replace("/vanilla/", "").replace("/addon/", "");

const VANILLA_ET = `Vehicle : "{AAAA1111}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Axles {
     Axle "{1}" {
      Suspension Suspension "{2}" : "{BBBB2222}Cfg/SuspFront.conf" {
       MaxTravelUp 0.09
      }
     }
     Axle "{3}" {
      Suspension Suspension "{4}" : "{CCCC3333}Cfg/SuspRear.conf" {
      }
     }
    }
    Pacejka Pacejka "{5}" : "{DDDD4444}Cfg/Pacejka_Veh.conf" {
    }
   }
  }
 }
}
`;

const FILES: Record<string, string> = {
  "Cfg/SuspFront.conf": `Suspension : "{CCCC3333}Cfg/SuspRear.conf" {\n MaxSteeringAngle 31\n}\n`,
  "Cfg/SuspRear.conf": `Suspension {\n SpringRate 40\n CompressionDamper 1600\n MaxTravelDown 0.1\n}\n`,
  "Cfg/Pacejka_Veh.conf": `Pacejka : "{EEEE5555}Cfg/Pacejka_Base.conf" {\n Longitudinal PacejkaLongitudinal "{9}" {\n  b0 0.8\n  b2 2400\n }\n Lateral PacejkaLateral "{8}" {\n  a0 1.2\n }\n}\n`,
  "Cfg/Pacejka_Base.conf": `Pacejka {\n Longitudinal PacejkaLongitudinal "{9}" {\n  b0 1.65\n  b2 1800\n  b3 20\n }\n Lateral PacejkaLateral "{8}" {\n  a0 1.55\n  a1 -55\n }\n}\n`,
  "Prefabs/Vehicles/Wheeled/X/X.et": VANILLA_ET,
};

const read = (p: string) => FILES[norm(p)] ?? null;

describe("resolveChassis", () => {
  // Every RoadForger vehicle is an empty overlay of a same-path vanilla prefab.
  const modText = `Vehicle : "{AAAA1111}Prefabs/Vehicles/Core/Wheeled_Car_Base.et" {\n components {\n }\n}\n`;
  const opts = {
    modText,
    relPath: "Prefabs/Vehicles/Wheeled/X/X.et",
    extractedPath: "/vanilla",
    readFile: read,
  };

  it("takes Pacejka coefficients from the vehicle conf, filling gaps from its parent", () => {
    const r = resolveChassis(opts);
    expect(r.longitudinal.b0).toEqual({ value: 0.8, source: "inherited" });   // vehicle conf wins
    expect(r.longitudinal.b3).toEqual({ value: 20, source: "inherited" });    // only in base
    expect(r.lateral.a0.value).toBe(1.2);
    expect(r.lateral.a1.value).toBe(-55);
  });

  it("resolves each axle separately rather than merging front and rear", () => {
    const r = resolveChassis(opts);
    expect(r.axles).toHaveLength(2);
    // Front writes MaxTravelUp inline and inherits the rest through its conf chain.
    expect(r.axles[0].fields.MaxTravelUp.value).toBe(0.09);
    expect(r.axles[0].fields.MaxSteeringAngle.value).toBe(31);
    expect(r.axles[0].fields.SpringRate.value).toBe(40);
    // Rear has no steering angle: that field belongs to the front conf only.
    expect(r.axles[1].fields.MaxSteeringAngle.value).toBeNull();
    expect(r.axles[1].fields.SpringRate.value).toBe(40);
  });

  it("reports unresolved rather than guessing when no vanilla data is available", () => {
    const r = resolveChassis({ modText, relPath: "Prefabs/Vehicles/Wheeled/X/X.et", readFile: read });
    expect(r.longitudinal.b0).toEqual({ value: null, source: "unresolved" });
    expect(r.axles).toHaveLength(0);
  });
});
