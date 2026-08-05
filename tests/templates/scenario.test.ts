import { describe, it, expect } from "vitest";
import { generateConflictScenario } from "../../src/templates/scenario.js";

const MINIMAL_OPTS = {
  scenarioName: "TestScenario",
  worldName: "Everon",
  bases: [
    { name: "BaseAlpha", position: "1000 0 2000", faction: "US", type: "MOB" as const },
    { name: "BaseBravo", position: "2000 0 3000", faction: "USSR", type: "MOB" as const },
    { name: "BaseCharlie", position: "1500 0 2500", faction: "US" },
  ],
};

describe("generateConflictScenario", () => {
  it("throws when bases array is empty", () => {
    expect(() =>
      generateConflictScenario({ scenarioName: "X", worldName: "Everon", bases: [] })
    ).toThrow();
  });

  describe("missionConf", () => {
    it("generates SCR_MissionHeaderCampaign", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("SCR_MissionHeaderCampaign {");
    });

    it("includes World reference for known map", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("World");
      expect(missionConf).toContain("Eden.ent");
    });

    it("resolves Arland world ref", () => {
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, worldName: "Arland" });
      expect(missionConf).toContain("CTI_Campaign_Arland.ent");
    });

    it("uses raw resource ref for unknown world", () => {
      const customRef = "{AABB1234AABB1234}worlds/Custom/MyMap.ent";
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, worldName: customRef });
      expect(missionConf).toContain(customRef);
    });

    it("includes SystemsConfig pointing to ConflictSystems.conf", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("SystemsConfig");
      expect(missionConf).toContain("ConflictSystems.conf");
    });

    it("sets player count", () => {
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, playerCount: 64 });
      expect(missionConf).toContain("m_iPlayerCount 64");
    });

    it("defaults to player count 40", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("m_iPlayerCount 40");
    });

    it("omits xpMultiplier when 1.0", () => {
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, xpMultiplier: 1.0 });
      expect(missionConf).not.toContain("m_fXpMultiplier");
    });

    it("includes xpMultiplier when not 1.0", () => {
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, xpMultiplier: 0.5 });
      expect(missionConf).toContain("m_fXpMultiplier 0.5");
    });

    it("includes base whitelist with base names", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("m_bCustomBaseWhitelist 1");
      expect(missionConf).toContain("m_aCampaignCustomBaseList");
      expect(missionConf).toContain("BaseAlpha");
      expect(missionConf).toContain("BaseBravo");
      expect(missionConf).toContain("BaseCharlie");
    });

    it("marks controlPoint bases with m_bIsControlPoint", () => {
      const opts = {
        ...MINIMAL_OPTS,
        bases: [
          { name: "MOB_US", position: "0 0 0", faction: "US", type: "MOB" as const },
          { name: "CP1", position: "100 0 100", faction: "US", type: "controlPoint" as const },
        ],
      };
      const { missionConf } = generateConflictScenario(opts);
      expect(missionConf).toContain("m_bIsControlPoint 1");
    });

    it("excludes sourceBase from base whitelist", () => {
      const opts = {
        ...MINIMAL_OPTS,
        bases: [
          { name: "MOB_US", position: "0 0 0", faction: "US", type: "MOB" as const },
          { name: "Harbor", position: "500 0 500", faction: "US", type: "sourceBase" as const },
        ],
      };
      const { missionConf } = generateConflictScenario(opts);
      expect(missionConf).not.toContain("Harbor");
      expect(missionConf).toContain("MOB_US");
    });

    it("includes saving enabled flag", () => {
      const { missionConf } = generateConflictScenario(MINIMAL_OPTS);
      expect(missionConf).toContain("m_bIsSavingEnabled 1");
    });

    it("omits saving flag when disabled", () => {
      const { missionConf } = generateConflictScenario({ ...MINIMAL_OPTS, savingEnabled: false });
      expect(missionConf).not.toContain("m_bIsSavingEnabled");
    });
  });

  describe("worldEnt", () => {
    it("generates a SubScene with Parent reference", () => {
      const { worldEnt } = generateConflictScenario(MINIMAL_OPTS);
      expect(worldEnt).toContain("SubScene {");
      expect(worldEnt).toContain("Parent");
      expect(worldEnt).toContain("Eden.ent");
    });

    it("does NOT contain entity definitions (those go in layers)", () => {
      const { worldEnt } = generateConflictScenario(MINIMAL_OPTS);
      expect(worldEnt).not.toContain("SCR_GameModeCampaign");
      expect(worldEnt).not.toContain("ConflictMilitaryBase");
    });
  });

  describe("defaultLayer", () => {
    it("includes SCR_GameModeCampaign entity", () => {
      const { defaultLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(defaultLayer).toContain("SCR_GameModeCampaign");
      expect(defaultLayer).toContain("GameMode_Seize.et");
    });

    it("includes SCR_CampaignFactionManager entity", () => {
      const { defaultLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(defaultLayer).toContain("SCR_CampaignFactionManager");
      expect(defaultLayer).toContain("CampaignFactionManager_Seize.et");
    });

    it("each entity has a unique ID", () => {
      const { defaultLayer } = generateConflictScenario(MINIMAL_OPTS);
      const ids = [...defaultLayer.matchAll(/ID "([A-F0-9]{16})"/g)].map(m => m[1]);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  describe("basesLayer", () => {
    it("uses $grp GenericEntity with ConflictMilitaryBase.et", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("$grp GenericEntity");
      expect(basesLayer).toContain("ConflictMilitaryBase.et");
    });

    it("includes a named block for each base", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("BaseAlpha {");
      expect(basesLayer).toContain("BaseBravo {");
      expect(basesLayer).toContain("BaseCharlie {");
    });

    it("includes SCR_CampaignSeizingComponent on all bases", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      const count = (basesLayer.match(/SCR_CampaignSeizingComponent/g) || []).length;
      expect(count).toBe(3); // one per base
    });

    it("disables seizing on MOB bases", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("Enabled 0");
    });

    it("includes SCR_CoverageRadioComponent with RelayTransceiver on all bases", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      const count = (basesLayer.match(/SCR_CoverageRadioComponent/g) || []).length;
      expect(count).toBe(3);
      expect(basesLayer).toContain("RelayTransceiver");
    });

    it("sets m_bIsSource 1 on MOB radio component", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("m_bIsSource 1");
    });

    it("includes SCR_CampaignMilitaryBaseComponent with m_sBaseName", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain('m_sBaseName "BaseAlpha"');
      expect(basesLayer).toContain('m_sBaseName "BaseBravo"');
      expect(basesLayer).toContain('m_sBaseName "BaseCharlie"');
    });

    it("sets MOB-specific overrides (m_bCanBeHQ, m_bIsSupplyHub)", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("m_bCanBeHQ 1");
      expect(basesLayer).toContain("m_bIsSupplyHub 1");
    });

    it("marks MOBs as m_bExcludeFromRandomization", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("m_bExcludeFromRandomization 1");
    });

    it("includes spawn protection area on MOB", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("MOBSpawnProtectionArea.et");
    });

    it("includes SCR_CampaignSuppliesComponent on MOB", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("SCR_CampaignSuppliesComponent");
      expect(basesLayer).toContain("m_iSupplies 500");
    });

    it("places base at specified position", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Base1", position: "1234 0 5678", faction: "US" }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("coords 1234 0 5678");
    });

    it("includes ambient patrol spawnpoints", () => {
      const { basesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(basesLayer).toContain("AmbientPatrolSpawnpoint_Base.et");
    });

    it("respects patrolCount 0", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Base1", position: "0 0 0", faction: "US", patrolCount: 0 }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).not.toContain("AmbientPatrolSpawnpoint_Base.et");
    });

    it("uses correct radio range default of 1470", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Base1", position: "0 0 0", faction: "US" }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("m_fRadioAntennaServiceRange 1470");
    });

    it("respects custom radioRange", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Base1", position: "0 0 0", faction: "US", radioRange: 2500 }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("m_fRadioAntennaServiceRange 2500");
    });

    it("major type sets m_bRequiresCaptureAndHoldAreas", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Port", position: "0 0 0", faction: "US", type: "major" as const }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("m_bRequiresCaptureAndHoldAreas 1");
    });

    it("excludes harbor type from $grp block", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [
          { name: "MOB_US", position: "0 0 0", faction: "US", type: "MOB" as const },
          { name: "Harbor1", position: "100 0 100", faction: "US", type: "harbor" as const },
        ],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("MOB_US {");
      expect(basesLayer).not.toContain("Harbor1 {");
    });

    it("uses FIA patrol prefab for FIA faction", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "FIABase", position: "0 0 0", faction: "FIA" }],
      };
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("AmbientPatrolSpawnpoint_FIA.et");
    });
  });

  describe("cahLayer", () => {
    it("returns null when no major bases", () => {
      const { cahLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(cahLayer).toBeNull();
    });

    it("returns a string when major bases exist", () => {
      const opts = {
        ...MINIMAL_OPTS,
        bases: [
          { name: "MOB_US", position: "0 0 0", faction: "US", type: "MOB" as const },
          { name: "Airport", position: "500 0 500", faction: "US", type: "major" as const },
        ],
      };
      const { cahLayer } = generateConflictScenario(opts);
      expect(cahLayer).not.toBeNull();
      expect(cahLayer).toContain("SCR_CaptureAndHoldArea");
      expect(cahLayer).toContain("CaptureAndHoldArea_Major.et");
    });

    it("auto-generates zone names for major base", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "Airport", position: "0 0 0", faction: "US", type: "major" as const }],
      };
      const { cahLayer } = generateConflictScenario(opts);
      expect(cahLayer).toContain("Airport_A {");
      expect(cahLayer).toContain("Airport_B {");
      expect(cahLayer).toContain("Airport_C {");
    });

    it("uses custom cahZones when provided", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{
          name: "Airport",
          position: "0 0 0",
          faction: "US",
          type: "major" as const,
          cahZones: ["Terminal", "Hangar", "Tower"],
        }],
      };
      const { cahLayer } = generateConflictScenario(opts);
      expect(cahLayer).toContain("Terminal {");
      expect(cahLayer).toContain("Hangar {");
      expect(cahLayer).toContain("Tower {");
    });
  });

  describe("defendersLayer", () => {
    it("includes defender spawnpoints for non-MOB bases", () => {
      const { defendersLayer } = generateConflictScenario(MINIMAL_OPTS);
      // BaseCharlie is the only non-MOB base in MINIMAL_OPTS
      expect(defendersLayer).toContain("SCR_AmbientPatrolSpawnPointComponent");
    });

    it("skips MOB bases", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [{ name: "MOB_US", position: "0 0 0", faction: "US", type: "MOB" as const }],
      };
      const { defendersLayer } = generateConflictScenario(opts);
      // No non-MOB bases — layer should have no groups
      expect(defendersLayer).not.toContain("SCR_AmbientPatrolSpawnPointComponent");
    });

    it("includes SCR_DefendWaypoint child entities", () => {
      const { defendersLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(defendersLayer).toContain("SCR_DefendWaypoint");
    });

    it("uses FIA patrol prefab for FIA defenders", () => {
      const opts = {
        scenarioName: "Test",
        worldName: "Everon",
        bases: [
          { name: "MOB_FIA", position: "0 0 0", faction: "FIA", type: "MOB" as const },
          { name: "FIABase", position: "100 0 100", faction: "FIA" },
        ],
      };
      const { defendersLayer } = generateConflictScenario(opts);
      expect(defendersLayer).toContain("AmbientPatrolSpawnpoint_FIA.et");
    });
  });

  describe("ambientVehiclesLayer", () => {
    it("returns null when civVehicleCount is 0 or omitted", () => {
      const { ambientVehiclesLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(ambientVehiclesLayer).toBeNull();

      const { ambientVehiclesLayer: a2 } = generateConflictScenario({ ...MINIMAL_OPTS, civVehicleCount: 0 });
      expect(a2).toBeNull();
    });

    it("returns layer content when civVehicleCount > 0", () => {
      const { ambientVehiclesLayer } = generateConflictScenario({ ...MINIMAL_OPTS, civVehicleCount: 4 });
      expect(ambientVehiclesLayer).not.toBeNull();
      expect(ambientVehiclesLayer).toContain("AmbientVehicleSpawnpoint_CIV.et");
      expect(ambientVehiclesLayer).toContain("SCR_AmbientVehicleSpawnPointComponent");
    });

    it("generates the requested number of vehicle spawns", () => {
      const { ambientVehiclesLayer } = generateConflictScenario({ ...MINIMAL_OPTS, civVehicleCount: 6 });
      const count = (ambientVehiclesLayer?.match(/coords /g) || []).length;
      expect(count).toBe(6);
    });
  });

  describe("relay base type", () => {
    const opts = {
      ...MINIMAL_OPTS,
      bases: [...MINIMAL_OPTS.bases, { name: "RelayTower", position: "1500 0 3000", faction: "US", type: "relay" as const }],
    };

    it("generates a non-seizable radio-only entity", () => {
      const { basesLayer } = generateConflictScenario(opts);
      expect(basesLayer).toContain("RelayTower");
      expect(basesLayer).toContain("m_eType RELAY");
      expect(basesLayer).not.toMatch(/RelayTower \{[\s\S]*?SCR_CampaignSeizingComponent/);
    });

    it("defaults relay radio range to 3000", () => {
      const { basesLayer } = generateConflictScenario(opts);
      // Vanilla writes the quoted multi-word key (CampaignMobileAssembly*.et);
      // m_fTransmittingRange was silently ignored by the engine.
      expect(basesLayer).toContain('"Transmitting Range" 3000');
    });

    it("respects an explicit radioRange override", () => {
      const customOpts = {
        ...MINIMAL_OPTS,
        bases: [...MINIMAL_OPTS.bases, { name: "RelayTower", position: "1500 0 3000", faction: "US", type: "relay" as const, radioRange: 4500 }],
      };
      const { basesLayer } = generateConflictScenario(customOpts);
      expect(basesLayer).toContain('"Transmitting Range" 4500');
    });

    it("excludes relay bases from the mission base whitelist", () => {
      const { missionConf } = generateConflictScenario(opts);
      expect(missionConf).not.toContain(`m_sBaseName "RelayTower"`);
    });

    it("excludes relay bases from patrol and defender generation", () => {
      const { basesLayer, defendersLayer } = generateConflictScenario(opts);
      expect(basesLayer.split("RelayTower")[1]).not.toContain("AmbientPatrolSpawnpoint");
      expect(defendersLayer).not.toContain("RelayTower");
    });
  });

  describe("seedingEnabled", () => {
    it("is omitted from default.layer and returns a null seedingLayer when not set", () => {
      const { defaultLayer, seedingLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(defaultLayer).not.toContain("m_bServerSeedingEnabled");
      expect(seedingLayer).toBeNull();
    });

    it("adds gamemode seeding attributes with default threshold 12", () => {
      const { defaultLayer } = generateConflictScenario({ ...MINIMAL_OPTS, seedingEnabled: true });
      expect(defaultLayer).toContain("m_bServerSeedingEnabled 1");
      expect(defaultLayer).toContain("m_iServerSeedingThreshold 12");
    });

    it("respects a custom seedingThreshold", () => {
      const { defaultLayer } = generateConflictScenario({ ...MINIMAL_OPTS, seedingEnabled: true, seedingThreshold: 8 });
      expect(defaultLayer).toContain("m_iServerSeedingThreshold 8");
    });

    it("adds a restriction zone to each MOB in Bases.layer", () => {
      const { basesLayer } = generateConflictScenario({ ...MINIMAL_OPTS, seedingEnabled: true });
      expect(basesLayer).toContain("IRON_SeedingRestrictionZoneEntity");
      expect(basesLayer).toContain("m_bAutoSizeToHQ 1");
      // MINIMAL_OPTS has 2 MOBs — one restriction zone each
      expect((basesLayer.match(/IRON_SeedingRestrictionZoneEntity/g) || []).length).toBe(2);
    });

    it("generates a seeding patrol layer with fast respawn at each MOB", () => {
      const { seedingLayer } = generateConflictScenario({ ...MINIMAL_OPTS, seedingEnabled: true });
      expect(seedingLayer).not.toBeNull();
      expect(seedingLayer).toContain("SCR_Iron_AmbientPatrolSpawnPointComponent_Seeding");
      expect(seedingLayer).toContain("m_bRespawnOnlyDuringSeeding 1");
      expect(seedingLayer).toContain("m_iRespawnPeriod 90");
    });

    it("returns null seedingLayer when seedingEnabled but no MOB exists", () => {
      const { seedingLayer } = generateConflictScenario({
        scenarioName: "X",
        worldName: "Everon",
        bases: [{ name: "BaseOnly", position: "0 0 0", faction: "US" }],
        seedingEnabled: true,
      });
      expect(seedingLayer).toBeNull();
    });
  });

  describe("suppliesIncome", () => {
    it("defaults to 50", () => {
      const { defaultLayer } = generateConflictScenario(MINIMAL_OPTS);
      expect(defaultLayer).toContain("m_iRegularSuppliesIncome 50");
    });

    it("respects a custom value", () => {
      const { defaultLayer } = generateConflictScenario({ ...MINIMAL_OPTS, suppliesIncome: 75 });
      expect(defaultLayer).toContain("m_iRegularSuppliesIncome 75");
    });
  });
});
