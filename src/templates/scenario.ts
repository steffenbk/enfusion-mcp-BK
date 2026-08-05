import { generateGuid } from "../formats/guid.js";

// ---------------------------------------------------------------------------
// Known prefab GUIDs — verified from extracted base game files / mod analysis
// ---------------------------------------------------------------------------

/** Map world parent references. Key is friendly name (lowercase). */
const WORLD_PARENTS: Record<string, string> = {
  everon:           "{853E92315D1D9EFE}worlds/Eden/Eden.ent",
  arland:           "{DC924A8DDECC73AD}worlds/MP/CTI_Campaign_Arland.ent",
  "western everon": "{312CDBA105554B51}worlds/MP/CTI_Campaign_WesternEveron.ent",
};

// Game mode (production Seize/Conflict mods)
const PREFAB_GAME_MODE      = "{CE6DD1D3C1BC7366}Prefabs/GameLogic/GameMode_Seize.et";
// Faction manager for Seize game mode
const PREFAB_FACTION_MGR    = "{F1AC26310BAE3788}Prefabs/MP/Campaign/CampaignFactionManager_Seize.et";
// ConflictMilitaryBase — all military bases use this ($grp wrapper)
const PREFAB_CONFLICT_BASE  = "{1391CE8C0E255636}Prefabs/Systems/MilitaryBase/ConflictMilitaryBase.et";
// MOB spawn protection area
const PREFAB_SPAWN_PROTECT  = "{35C70C8528D145B1}Prefabs/MOBSpawnProtection/MOBSpawnProtectionArea.et";
// Faction-specific ambient patrol spawnpoints
const PREFAB_PATROL_FIA     = "{9273AB931008C271}Prefabs/Systems/AmbientPatrol/AmbientPatrolSpawnpoint_FIA.et";
const PREFAB_PATROL_US      = "{1E4C8AD00BBB16AA}Prefabs/Systems/AmbientPatrol/AmbientPatrolSpawnpoint_Base.et"; // Base used for US
const PREFAB_PATROL_USSR    = "{1E4C8AD00BBB16AA}Prefabs/Systems/AmbientPatrol/AmbientPatrolSpawnpoint_Base.et"; // Base used for USSR
// Ambient vehicle spawnpoints (civilian and faction)
const PREFAB_VEHICLE_CIV    = "{0DDAFCA92FF4451C}Prefabs/Systems/AmbientVehicles/AmbientVehicleSpawnpoint_CIV.et";
const PREFAB_VEHICLE_FIA    = "{D4A604DD154470CD}Prefabs/Systems/AmbientVehicles/AmbientVehicleSpawnpoint_FIA.et";
// CAH area (major base capture zones)
const PREFAB_CAH_MAJOR      = "{F4649500E51DF810}Prefabs/MP/Modes/CaptureAndHold/Areas/CaptureAndHoldArea_Major.et";
// Defend waypoint for patrol defenders
const PREFAB_DEFEND_WP      = "{AAE8882E0DE0761A}Prefabs/AI/Waypoints/AIWaypoint_Defend_Hierarchy.et";
// Harbor source base (T3 = large, most common in production mods)
const PREFAB_HARBOR_T3      = "{0226331FB6A8249A}Prefabs/Systems/MilitaryBase/ConflictSourceBase_T3Harbor.et";
// Seeding restriction zone — confines players to MOB area during low-pop seeding
const PREFAB_SEEDING_ZONE   = "{801DADF0D6C316B9}PrefabsEditable/RestrictionZone/E_SeedingRestrictionZoneBase.et";
// Seeding-only ambient patrol (fast respawn, stops once seeding ends)
const PREFAB_PATROL_SEEDING = "{0E66F798F84EEB58}Prefabs/Systems/AmbientPatrol/IRON_AmbientPatrolSpawnpoint_Base_Seeding.et";

// Component GUIDs inside ConflictMilitaryBase (from mod analysis)
const CID_SEIZING   = "{5C66967235FBEEA3}";
const CID_RADIO     = "{5C669673C2A82A2B}";
const CID_RELAY_TX  = "{5C669673E8C94083}";
const CID_BASE_COMP = "{5AFC974A70234D1C}";
const CID_SUPPLIES  = "{5C6696724F524DA2}";
// Harbor source base component GUIDs
const CID_HARBOR_SEIZING    = "{621EB97024DABABE}";
const CID_HARBOR_SOURCE     = "{621EB97024DABD3C}";
// Ambient patrol component GUID
const CID_PATROL_COMP       = "{5CCEC6036BBF3EDD}";
// Ambient vehicle component GUID
const CID_VEHICLE_COMP      = "{5D5E85F932F777FA}";

const GUID_CONFLICT_SYSTEMS = "{7C9E720397CC6ACD}Configs/Systems/ConflictSystems.conf";

// CAH area symbol keys (lettered A-Z)
const CAH_SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictBaseSpec {
  /** Display name for the base, e.g. "BaseAlpha" */
  name: string;
  /**
   * World position as "x y z". Y is typically 0 — Workbench adjusts to terrain
   * when you open the world.
   */
  position: string;
  /** Starting faction: "US", "USSR", "FIA", or a custom faction key */
  faction: string;
  /**
   * Base type:
   * - "base" (default) — standard contested military base (TownBase / SmallBase)
   * - "major" — large base with CAH areas, supply hub (harbour, airfield, military base)
   * - "MOB" — main operating base / HQ (no seizing, 3000 supplies, radio source)
   * - "controlPoint" — lightweight control point objective
   * - "sourceBase" — supply source, not capturable
   * - "harbor" — supply-income harbor using ConflictSourceBase prefab family
   * - "relay" — pre-placed always-on radio relay tower, not capturable, extends radio coverage
   */
  type?: "base" | "major" | "MOB" | "controlPoint" | "sourceBase" | "harbor" | "relay";
  /** Number of ambient patrol spawnpoints around this base (default 2, max 6) */
  patrolCount?: number;
  /** Radio antenna service range in meters (default 1470) */
  radioRange?: number;
  /**
   * CAH zone names for major bases. If omitted and type=major, names are auto-generated
   * as "{name}_A", "{name}_B", "{name}_C".
   */
  cahZones?: string[];
}

export interface ConflictScenarioOptions {
  /**
   * Enable low-population seeding mode. Restricts players to MOB areas and spawns
   * fast-respawning AI patrols until enough players connect (one-way transition —
   * never re-activates once the threshold is crossed).
   */
  seedingEnabled?: boolean;
  /** Player count at which seeding mode permanently ends (default 12). Ignored unless seedingEnabled. */
  seedingThreshold?: number;
  /** Regular per-tick supply income for contested bases (default 50). */
  suppliesIncome?: number;
  /** Display name of the scenario */
  scenarioName: string;
  /**
   * Base world to inherit. Use "Everon", "Arland", "Western Everon",
   * or a full resource ref like "{GUID}worlds/MyWorld.ent".
   */
  worldName: string;
  /** Bases to place in the world */
  bases: ConflictBaseSpec[];
  /** Max player count (default 40) */
  playerCount?: number;
  /** XP multiplier, e.g. 0.5 for PvE (default 1.0) */
  xpMultiplier?: number;
  /** Enable persistence/saving (default true) */
  savingEnabled?: boolean;
  /** Game mode display label (default "Conflict") */
  gameModeLabel?: string;
  /** Scenario description */
  description?: string;
  /** Author name */
  author?: string;
  /**
   * Number of civilian vehicle spawnpoints to generate (default 0).
   * Placed at random offsets across the map.
   */
  civVehicleCount?: number;
}

export interface ConflictScenarioOutput {
  /** Content for Missions/{scenarioName}.conf */
  missionConf: string;
  /** Content for Worlds/{scenarioName}.ent — minimal SubScene stub */
  worldEnt: string;
  /** Content for Worlds/{scenarioName}_Layers/default.layer — game mode, AI, radio */
  defaultLayer: string;
  /** Content for Worlds/{scenarioName}_Layers/Bases.layer — all military base entities */
  basesLayer: string;
  /** Content for Worlds/{scenarioName}_Layers/CAH.layer — capture zone triggers (only if major bases exist) */
  cahLayer: string | null;
  /** Content for Worlds/{scenarioName}_Layers/Defenders.layer — faction patrol defenders with waypoints */
  defendersLayer: string;
  /** Content for Worlds/{scenarioName}_Layers/AmbientVehicles.layer — civilian vehicle spawns (only if civVehicleCount > 0) */
  ambientVehiclesLayer: string | null;
  /** Content for Worlds/{scenarioName}_Layers/AmbientPatrols_SEEDING.layer — seeding-only AI patrols (only if seedingEnabled) */
  seedingLayer: string | null;
}

// ---------------------------------------------------------------------------
// Mission header (.conf) generation
// ---------------------------------------------------------------------------

function buildMissionConf(opts: ConflictScenarioOptions, worldRef: string): string {
  const playerCount = opts.playerCount ?? 40;
  const gameMode = opts.gameModeLabel ?? "Conflict";
  const lines: string[] = ["SCR_MissionHeaderCampaign {"];

  lines.push(` World "${worldRef}"`);
  lines.push(` SystemsConfig "${GUID_CONFLICT_SYSTEMS}"`);
  lines.push(` m_sName "${opts.scenarioName}"`);
  if (opts.description) lines.push(` m_sDescription "${opts.description}"`);
  if (opts.author)      lines.push(` m_sAuthor "${opts.author}"`);
  lines.push(` m_sGameMode "${gameMode}"`);
  lines.push(` m_iPlayerCount ${playerCount}`);
  lines.push(` m_eEditableGameFlags 6`);
  lines.push(` m_eDefaultGameFlags 6`);
  if (opts.xpMultiplier !== undefined && opts.xpMultiplier !== 1.0) {
    lines.push(` m_fXpMultiplier ${opts.xpMultiplier}`);
  }
  if (opts.savingEnabled !== false) {
    lines.push(` m_bIsSavingEnabled 1`);
  }

  // Base whitelist — links .conf base names to world entities
  const contestable = opts.bases.filter(b => b.type !== "sourceBase" && b.type !== "harbor" && b.type !== "relay");
  if (contestable.length > 0) {
    lines.push(` m_bCustomBaseWhitelist 1`);
    lines.push(` m_aCampaignCustomBaseList {`);
    for (const base of contestable) {
      const guid = generateGuid();
      lines.push(`  SCR_CampaignCustomBase "{${guid}}" {`);
      lines.push(`   m_sBaseName "${base.name}"`);
      if (base.type === "controlPoint") lines.push(`   m_bIsControlPoint 1`);
      lines.push(`  }`);
    }
    lines.push(` }`);
  }

  lines.push("}");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// World .ent — minimal SubScene stub
// ---------------------------------------------------------------------------

function buildWorldEnt(worldRef: string): string {
  return `SubScene {\n Parent "${worldRef}"\n}\n`;
}

// ---------------------------------------------------------------------------
// default.layer — game mode entity + required managers
// ---------------------------------------------------------------------------

function buildDefaultLayer(opts: ConflictScenarioOptions): string {
  const gmId  = generateGuid();
  const fmId  = generateGuid();
  const contestableCount = opts.bases.filter(
    b => !b.type || b.type === "base" || b.type === "major" || b.type === "controlPoint"
  ).length;
  const threshold = Math.max(1, Math.floor(contestableCount * 0.5));
  const lines: string[] = [];

  lines.push(`SCR_GameModeCampaign GameMode1 : "${PREFAB_GAME_MODE}" {`);
  lines.push(` ID "${gmId}"`);
  lines.push(` coords 0 0 0`);
  lines.push(` m_fAutoReloadTime 30`);
  lines.push(` m_iControlPointsThreshold ${threshold}`);
  lines.push(` m_fVictoryTimer 300`);
  lines.push(` m_iRegularSuppliesIncome ${opts.suppliesIncome ?? 50}`);
  lines.push(` m_bEstablishingBasesEnabled 0`);
  lines.push(` m_bHideBasesOutsideRadioRange 1`);
  if (opts.seedingEnabled) {
    lines.push(` m_bServerSeedingEnabled 1`);
    lines.push(` m_iServerSeedingThreshold ${opts.seedingThreshold ?? 12}`);
  }
  lines.push(`}`);

  lines.push(`SCR_CampaignFactionManager CampaignFactionManager1 : "${PREFAB_FACTION_MGR}" {`);
  lines.push(` ID "${fmId}"`);
  lines.push(` coords 0 0 0`);
  lines.push(`}`);

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePos(pos: string): [number, number, number] {
  const parts = pos.trim().split(/\s+/);
  const x = parseFloat(parts[0] ?? "0");
  const y = parseFloat(parts[1] ?? "0");
  const z = parseFloat(parts[2] ?? "0");
  return [
    isNaN(x) ? 0 : x,
    isNaN(y) ? 0 : y,
    isNaN(z) ? 0 : z,
  ];
}

function fmtPos(x: number, y: number, z: number): string {
  return `${x} ${y} ${z}`;
}

/** Resolve CAH zone names for a major base */
function cahZoneNames(base: ConflictBaseSpec): string[] {
  if (base.cahZones && base.cahZones.length > 0) return base.cahZones;
  return [`${base.name}_A`, `${base.name}_B`, `${base.name}_C`];
}

// ---------------------------------------------------------------------------
// Bases.layer
// ---------------------------------------------------------------------------

function buildBasesLayer(opts: ConflictScenarioOptions): string {
  const lines: string[] = [];

  // All military bases go in one $grp block
  lines.push(`$grp GenericEntity : "${PREFAB_CONFLICT_BASE}" {`);

  for (const base of opts.bases) {
    if (base.type === "harbor") continue; // harbors have their own prefab family

    const [bx, by, bz] = parsePos(base.position);
    const baseType = base.type ?? "base";
    const isMOB = baseType === "MOB";
    const isMajor = baseType === "major";
    const isRelay = baseType === "relay";
    const radioRange = base.radioRange ?? (isRelay ? 3000 : 1470);

    if (isRelay) {
      // Pre-placed always-on relay tower: not capturable, extends radio coverage only.
      lines.push(` ${base.name} {`);
      lines.push(`  components {`);
      lines.push(`   SCR_CampaignMilitaryBaseComponent "${CID_BASE_COMP}" {`);
      lines.push(`    m_iRadius 10`);
      lines.push(`    m_bShowNotifications 0`);
      lines.push(`    m_sBaseName "${base.name}"`);
      lines.push(`    m_eType RELAY`);
      lines.push(`   }`);
      lines.push(`   SCR_CoverageRadioComponent "${CID_RADIO}" {`);
      lines.push(`    Transceivers {`);
      lines.push(`     RelayTransceiver "${CID_RELAY_TX}" {`);
      // "Transmitting Range" — a quoted multi-word key, NOT m_fTransmittingRange.
      // RelayTransceiver is a native ScriptAndConfig whose range is exposed via
      // GetRange()/SetRange() protos, so there is no m_f* script member to write.
      // Verified against vanilla: Prefabs/MP/Campaign/Assets/CampaignMobileAssembly{East,West}.et
      // both write `"Transmitting Range" 2000`. The old name was silently ignored,
      // so every generated relay tower fell back to its default range.
      lines.push(`      "Transmitting Range" ${radioRange}`);
      lines.push(`     }`);
      lines.push(`    }`);
      lines.push(`   }`);
      lines.push(`  }`);
      lines.push(`  coords ${fmtPos(bx, by, bz)}`);
      lines.push(` }`);
      continue;
    }

    lines.push(` ${base.name} {`);
    lines.push(`  components {`);

    // SCR_CampaignSeizingComponent
    lines.push(`   SCR_CampaignSeizingComponent "${CID_SEIZING}" {`);
    if (isMOB) {
      lines.push(`    Enabled 0`);
    } else {
      lines.push(`    m_fMaximumSeizingTime 120`);
      lines.push(`    m_fMinimumSeizingTime 30`);
      if (isMajor) {
        lines.push(`    m_iRadius 200`);
        lines.push(`    m_bRequiresCaptureAndHoldAreas 1`);
        lines.push(`    m_iAreaThreshold 50`);
        const zones = cahZoneNames(base);
        lines.push(`    m_aCaptureAndHoldAreaNames {`);
        for (const z of zones) lines.push(`     "${z}"`);
        lines.push(`    }`);
      }
      lines.push(`    m_RequiredGroupTypes {`);
      lines.push(`     ASSAULT`);
      lines.push(`     SF_ASSAULT`);
      lines.push(`    }`);
    }
    lines.push(`   }`);

    // SCR_CoverageRadioComponent
    lines.push(`   SCR_CoverageRadioComponent "${CID_RADIO}" {`);
    lines.push(`    Transceivers {`);
    lines.push(`     RelayTransceiver "${CID_RELAY_TX}" {`);
    lines.push(`     }`);
    lines.push(`    }`);
    if (isMOB) lines.push(`    m_bIsSource 1`);
    lines.push(`   }`);

    // SCR_CampaignMilitaryBaseComponent
    lines.push(`   SCR_CampaignMilitaryBaseComponent "${CID_BASE_COMP}" {`);
    if (isMajor) lines.push(`    m_iRadius 200`);
    if (isMajor || isMOB) lines.push(`    m_bIsControlPoint 1`);
    if (isMajor || isMOB) lines.push(`    m_bIsSupplyHub 1`);
    if (isMOB) lines.push(`    m_bCanBeHQ 1`);
    lines.push(`    m_sBaseName "${base.name}"`);
    lines.push(`    m_sBaseNameUpper "${base.name.toUpperCase()}"`);
    lines.push(`    m_fRadioAntennaServiceRange ${radioRange}`);
    if (isMOB || isMajor) lines.push(`    m_bExcludeFromRandomization 1`);
    lines.push(`   }`);

    // Supplies for MOB
    if (isMOB) {
      lines.push(`   SCR_CampaignSuppliesComponent "${CID_SUPPLIES}" {`);
      lines.push(`    m_iSupplies 500`);
      lines.push(`    m_iSuppliesMax 3000`);
      lines.push(`    m_fOperationalRadius 50`);
      lines.push(`   }`);
    }

    lines.push(`  }`);
    lines.push(`  coords ${fmtPos(bx, by, bz)}`);

    if (isMOB) {
      lines.push(`  {`);
      lines.push(`   SCR_Iron_CaptureAndHoldSpawnProtectionArea : "${PREFAB_SPAWN_PROTECT}" {`);
      lines.push(`    coords 0 0 0`);
      lines.push(`   }`);
      lines.push(`  }`);

      if (opts.seedingEnabled) {
        lines.push(`  {`);
        lines.push(`   IRON_SeedingRestrictionZoneEntity : "${PREFAB_SEEDING_ZONE}" {`);
        lines.push(`    m_bAutoSizeToHQ 1`);
        lines.push(`    m_iDistanceToHQ 2000`);
        lines.push(`    coords 0 0 0`);
        lines.push(`   }`);
        lines.push(`  }`);
      }
    }

    lines.push(` }`);
  }

  lines.push(`}`);

  // Ambient patrol spawnpoints (outside the $grp, after all bases)
  for (const base of opts.bases) {
    if (base.type === "harbor" || base.type === "relay") continue;
    const [bx, by, bz] = parsePos(base.position);
    const patrolCount = Math.min(Math.max(base.patrolCount ?? 2, 0), 6);
    const patrolOffsets = [
      [30, 0], [-30, 0], [0, 30], [0, -30], [25, 25], [-25, -25],
    ];
    const patrolPrefab = base.faction === "FIA" ? PREFAB_PATROL_FIA : PREFAB_PATROL_US;
    for (let i = 0; i < patrolCount; i++) {
      const [ox, oz] = patrolOffsets[i]!;
      lines.push(`GenericEntity : "${patrolPrefab}" {`);
      lines.push(` ID "${generateGuid()}"`);
      lines.push(` coords ${fmtPos(bx + ox, by, bz + oz)}`);
      lines.push(`}`);
    }
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// CAH.layer — capture zone triggers for major bases
// ---------------------------------------------------------------------------

function buildCAHLayer(opts: ConflictScenarioOptions): string | null {
  const majorBases = opts.bases.filter(b => b.type === "major");
  if (majorBases.length === 0) return null;

  const lines: string[] = [];
  let symbolIdx = 0;

  lines.push(`$grp SCR_CaptureAndHoldArea : "${PREFAB_CAH_MAJOR}" {`);

  for (const base of majorBases) {
    const [bx, by, bz] = parsePos(base.position);
    const zones = cahZoneNames(base);

    // Place 3 CAH zones around the base at small offsets
    const zoneOffsets = [[0, 0], [15, 0], [0, 15]];
    for (let i = 0; i < zones.length; i++) {
      const [ox, oz] = zoneOffsets[i] ?? [0, 0];
      const symbol = `#AR-CAH-Area_Symbol_${CAH_SYMBOLS[symbolIdx % 26]}`;
      symbolIdx++;
      lines.push(` ${zones[i]} {`);
      lines.push(`  coords ${fmtPos(bx + ox, by, bz + oz)}`);
      lines.push(`  TriggerShapeType Sphere`);
      lines.push(`  SphereRadius 40`);
      lines.push(`  DrawShape 0`);
      if (i > 0) lines.push(`  m_sAreaSymbol "${symbol}"`);
      lines.push(` }`);
    }
  }

  lines.push(`}`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Defenders.layer — faction-specific patrol defenders with defend waypoints
// ---------------------------------------------------------------------------

function buildDefendersLayer(opts: ConflictScenarioOptions): string {
  const lines: string[] = [];

  // Group by faction for cleaner layer output
  const factionGroups = new Map<string, ConflictBaseSpec[]>();
  for (const base of opts.bases) {
    if (base.type === "MOB" || base.type === "harbor" || base.type === "relay") continue;
    const list = factionGroups.get(base.faction) ?? [];
    list.push(base);
    factionGroups.set(base.faction, list);
  }

  for (const [faction, bases] of factionGroups) {
    const patrolPrefab = faction === "FIA" ? PREFAB_PATROL_FIA : PREFAB_PATROL_US;

    lines.push(`$grp GenericEntity : "${patrolPrefab}" {`);

    for (const base of bases) {
      const [bx, by, bz] = parsePos(base.position);
      // Place 2 defenders per base at ±50m with defend waypoints pointing back to base
      const defenderOffsets = [[50, 0], [-50, 0]];
      for (const [ox, oz] of defenderOffsets) {
        lines.push(` {`);
        lines.push(`  components {`);
        lines.push(`   SCR_AmbientPatrolSpawnPointComponent "${CID_PATROL_COMP}" {`);
        lines.push(`    m_bPickRandomGroupType 1`);
        lines.push(`    m_iRespawnPeriod 600`);
        lines.push(`   }`);
        lines.push(`  }`);
        lines.push(`  coords ${fmtPos(bx + ox, by, bz + oz)}`);
        lines.push(`  {`);
        lines.push(`   SCR_DefendWaypoint : "${PREFAB_DEFEND_WP}" {`);
        // Waypoint points back toward base center
        lines.push(`    coords ${fmtPos(-ox, 0, -oz)}`);
        lines.push(`    CompletionRadius 50`);
        lines.push(`   }`);
        lines.push(`  }`);
        lines.push(` }`);
      }
    }

    lines.push(`}`);
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// AmbientVehicles.layer — civilian vehicle spawns
// ---------------------------------------------------------------------------

function buildAmbientVehiclesLayer(opts: ConflictScenarioOptions): string | null {
  const count = opts.civVehicleCount ?? 0;
  if (count === 0) return null;

  const lines: string[] = [];
  lines.push(`$grp GenericEntity : "${PREFAB_VEHICLE_CIV}" {`);

  // Spread vehicle spawns near base positions
  const basePositions = opts.bases.map(b => parsePos(b.position));
  for (let i = 0; i < count; i++) {
    const [bx, by, bz] = basePositions[i % basePositions.length]!;
    // Offset each spawn away from base center
    const angle = (i / count) * Math.PI * 2;
    const dist = 80 + (i % 3) * 30;
    const ox = Math.round(Math.cos(angle) * dist);
    const oz = Math.round(Math.sin(angle) * dist);
    lines.push(` {`);
    lines.push(`  components {`);
    lines.push(`   SCR_AmbientVehicleSpawnPointComponent "${CID_VEHICLE_COMP}" {`);
    lines.push(`    m_iRespawnPeriod 600`);
    lines.push(`    m_aIncludedEditableEntityLabels {`);
    lines.push(`     TRAIT_PASSENGERS_SMALL`);
    lines.push(`     TRAIT_PASSENGERS_LARGE`);
    lines.push(`    }`);
    lines.push(`    m_aExcludedEditableEntityLabels {`);
    lines.push(`     VEHICLE_HELICOPTER`);
    lines.push(`     VEHICLE_AIRPLANE`);
    lines.push(`    }`);
    lines.push(`   }`);
    lines.push(`  }`);
    lines.push(`  coords ${fmtPos(bx + ox, by, bz + oz)}`);
    lines.push(` }`);
  }

  lines.push(`}`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// AmbientPatrols_SEEDING.layer — seeding-only AI patrols at each MOB
// ---------------------------------------------------------------------------

function buildSeedingLayer(opts: ConflictScenarioOptions): string | null {
  if (!opts.seedingEnabled) return null;

  const mobs = opts.bases.filter(b => b.type === "MOB");
  if (mobs.length === 0) return null;

  const lines: string[] = [];
  lines.push(`$grp GenericEntity : "${PREFAB_PATROL_SEEDING}" {`);

  const patrolOffsets = [[40, 0], [-40, 0]];
  for (const base of mobs) {
    const [bx, by, bz] = parsePos(base.position);
    for (const [ox, oz] of patrolOffsets) {
      lines.push(` {`);
      lines.push(`  components {`);
      lines.push(`   SCR_Iron_AmbientPatrolSpawnPointComponent_Seeding "${generateGuid()}" {`);
      lines.push(`    m_bRespawnOnlyDuringSeeding 1`);
      lines.push(`    m_iRespawnPeriod 90`);
      lines.push(`   }`);
      lines.push(`  }`);
      lines.push(`  coords ${fmtPos(bx + ox, by, bz + oz)}`);
      lines.push(`  {`);
      lines.push(`   SCR_DefendWaypoint : "${PREFAB_DEFEND_WP}" {`);
      lines.push(`    coords ${fmtPos(-ox, 0, -oz)}`);
      lines.push(`    CompletionRadius 75`);
      lines.push(`   }`);
      lines.push(`  }`);
      lines.push(` }`);
    }
  }

  lines.push(`}`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete Conflict multiplayer scenario.
 * Returns content for up to 7 files:
 *   - missionConf         → Missions/{scenarioName}.conf
 *   - worldEnt            → Worlds/{scenarioName}.ent  (SubScene stub)
 *   - defaultLayer        → Worlds/{scenarioName}_Layers/default.layer
 *   - basesLayer          → Worlds/{scenarioName}_Layers/Bases.layer
 *   - cahLayer            → Worlds/{scenarioName}_Layers/CAH.layer  (null if no major bases)
 *   - defendersLayer      → Worlds/{scenarioName}_Layers/Defenders.layer
 *   - ambientVehiclesLayer→ Worlds/{scenarioName}_Layers/AmbientVehicles.layer (null if civVehicleCount=0)
 *   - seedingLayer        → Worlds/{scenarioName}_Layers/AmbientPatrols_SEEDING.layer (null unless seedingEnabled and a MOB exists)
 */
export function generateConflictScenario(opts: ConflictScenarioOptions): ConflictScenarioOutput {
  if (opts.bases.length === 0) {
    throw new Error("At least one base is required to generate a Conflict scenario.");
  }

  const worldKey = opts.worldName.toLowerCase().replace(/\s+/g, " ").trim();
  const worldRef = WORLD_PARENTS[worldKey] ?? opts.worldName;

  return {
    missionConf:          buildMissionConf(opts, worldRef),
    worldEnt:             buildWorldEnt(worldRef),
    defaultLayer:         buildDefaultLayer(opts),
    basesLayer:           buildBasesLayer(opts),
    cahLayer:             buildCAHLayer(opts),
    defendersLayer:       buildDefendersLayer(opts),
    ambientVehiclesLayer: buildAmbientVehiclesLayer(opts),
    seedingLayer:         buildSeedingLayer(opts),
  };
}

/** List of known world names for the tool description. */
export const KNOWN_WORLDS = Object.keys(WORLD_PARENTS);
