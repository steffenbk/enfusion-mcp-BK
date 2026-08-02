import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listTunableVehicles,
  vehicleEtPath,
  isSafeVehicleRelPath,
  VEHICLES_SUBPATH,
} from "../../src/tuning-server/discover.js";

const WITH_ENGINE = `Vehicle : "{AAAA}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Engine Engine Engine {
     MaxPower 100
    }
   }
  }
 }
}
`;

const WITHOUT_ENGINE = `Vehicle : "{BBBB}Base.et" {
 components {
  VehicleWheeledSimulation "{731B26FCA2F19855}" {
   Simulation Wheeled "{4D8B26DEA5F25978}" {
    Gearbox Gearbox Gearbox {
     Forward {
      10 3.4
     }
    }
   }
  }
 }
}
`;

describe("listTunableVehicles", () => {
  let addonDir: string;

  beforeEach(() => {
    addonDir = mkdtempSync(join(tmpdir(), "tuner-vehicles-"));
  });

  afterEach(() => {
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("returns an empty array when Prefabs/Vehicles does not exist", () => {
    expect(listTunableVehicles(addonDir)).toEqual([]);
  });

  it("lists only .et files that contain an Engine block, recursively and sorted", () => {
    const base = join(addonDir, ...VEHICLES_SUBPATH.split("/"));
    mkdirSync(join(base, "Wheeled", "Ural4320"), { recursive: true });
    mkdirSync(join(base, "Wheeled", "M151A2"), { recursive: true });
    writeFileSync(join(base, "Wheeled", "Ural4320", "Ural4320.et"), WITHOUT_ENGINE);
    writeFileSync(join(base, "Wheeled", "M151A2", "M151A2.et"), WITH_ENGINE);
    writeFileSync(join(base, "Wheeled", "M151A2", "notes.txt"), "ignore me");

    expect(listTunableVehicles(addonDir)).toEqual([
      "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et",
    ]);
  });

  it("vehicleEtPath joins the addon path with the relative path", () => {
    const rel = "Prefabs/Vehicles/Wheeled/M151A2/M151A2.et";
    expect(vehicleEtPath(addonDir, rel)).toBe(join(addonDir, ...rel.split("/")));
  });
});

describe("isSafeVehicleRelPath", () => {
  it("accepts a normal vehicle path", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/Wheeled/M151A2/M151A2.et")).toBe(true);
  });

  it("rejects parent-directory traversal", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/../../../etc/passwd")).toBe(false);
  });

  it("rejects backslashes", () => {
    expect(isSafeVehicleRelPath("Prefabs\\Vehicles\\X.et")).toBe(false);
  });

  it("rejects absolute paths and drive letters", () => {
    expect(isSafeVehicleRelPath("/etc/passwd")).toBe(false);
    expect(isSafeVehicleRelPath("C:/Windows/system.ini")).toBe(false);
  });

  it("rejects paths outside Prefabs/Vehicles", () => {
    expect(isSafeVehicleRelPath("Scripts/Game/Thing.et")).toBe(false);
  });

  it("rejects non-.et files", () => {
    expect(isSafeVehicleRelPath("Prefabs/Vehicles/Wheeled/X/X.conf")).toBe(false);
  });
});
