import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";
import { requireEditMode, formatConnectionStatus } from "../workbench/status.js";

const SF = "Prefabs/Systems/ScenarioFramework/Components";

// GUIDs verified from live Workbench layer files (TESTING CLAUD sample worlds)
const PREFABS: Record<string, Record<string, string>> = {
  kill: {
    layerTask: `{2008B4EE6C4D528E}${SF}/LayerTaskKill.et`,
    slot:      `{C70DC6CBD1AAEC9A}${SF}/SlotKill.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotKill",
    layerComp: "SCR_ScenarioFrameworkLayerTaskKill",
  },
  clearArea: {
    layerTask: `{CDC0845AD90BA073}${SF}/LayerTaskClearArea.et`,
    slot:      `{E53456990A756229}${SF}/SlotClearArea.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotClearArea",
    layerComp: "SCR_ScenarioFrameworkLayerTaskClearArea",
  },
  destroy: {
    layerTask: `{5EDF39860639027D}${SF}/LayerTaskDestroy.et`,
    slot:      `{7586595959BA2D99}${SF}/SlotDestroy.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotDestroy",
    layerComp: "SCR_ScenarioFrameworkLayerTaskDestroy",
  },
};

const AREA_PREFAB    = `{C72F956E4AC6A6E7}${SF}/Area.et`;
const LAYER_PREFAB   = `{5F9FFF4BF027B3A3}${SF}/Layer.et`;
const SLOT_AI_PREFAB = `{8D43830F02C3F114}${SF}/SlotAI.et`;

// ---------------------------------------------------------------------------
// Shared helpers for WB scenario tools
// ---------------------------------------------------------------------------

/** Delete all entities in the placed list (best-effort cleanup on failure). */
async function cleanupEntities(client: WorkbenchClient, placed: string[]): Promise<string[]> {
  const cleaned: string[] = [];
  for (const entityName of placed) {
    try {
      await client.call("EMCP_WB_DeleteEntity", { name: entityName });
      cleaned.push(entityName);
    } catch { /* Entity might not exist */ }
  }
  return cleaned;
}

/** Set a component property via WB API. Collects warnings for properties that can't be set. */
async function setEntityProp(
  client: WorkbenchClient,
  warnings: string[],
  entityName: string,
  componentDotProp: string,
  value: string,
): Promise<void> {
  const dot = componentDotProp.lastIndexOf(".");
  const propertyPath = dot === -1 ? "" : componentDotProp.slice(0, dot);
  let propertyKey    = dot === -1 ? componentDotProp : componentDotProp.slice(dot + 1);
  // Strip surrounding quotes from property key (Enfusion file format uses "faction affiliation" style keys)
  if (propertyKey.startsWith('"') && propertyKey.endsWith('"')) {
    propertyKey = propertyKey.slice(1, -1);
  }
  const res = await client.call<Record<string, unknown>>("EMCP_WB_ModifyEntity", {
    action: "setProperty", name: entityName, propertyPath, propertyKey, value,
  });
  if (res.status !== "ok") {
    warnings.push(`  ${entityName} ${componentDotProp} = ${value}  (${String(res.message ?? "failed")})`);
  }
}

/** Resolve position — use provided value, or query current camera position. */
async function resolvePosition(
  client: WorkbenchClient,
  position: string | undefined,
  toolName: string,
): Promise<{ position: string } | { error: string }> {
  if (position) return { position };
  const camRes = await client.call<{ status: string; position?: string; message?: string }>("EMCP_WB_GetCameraPos", {});
  if (camRes.status === "ok" && camRes.position) {
    return { position: camRes.position };
  }
  return { error: `**${toolName} failed**\nCould not get camera position: ${camRes.message ?? "unknown error"}. Pass an explicit 'position' parameter.` };
}

export function registerScenarioTools(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "scenario_create_objective",
    {
      description:
        "SCENARIO FRAMEWORK ONLY — for single-player and co-op narrative missions. " +
        "NOT for multiplayer Conflict/PvE scenarios (use scenario_create_conflict to generate files or scenario_create_base to place Conflict bases in Workbench). " +
        "Places a complete SF objective hierarchy in the live Workbench scene: " +
        "Area → LayerTask → Layer_AI → SlotKill + SlotAI entities, wired with all cross-references. " +
        "Requires Workbench to be running with a world open in Edit mode. " +
        "Use for kill/clearArea/destroy tasks that spawn an AI group when a player enters the trigger area. " +
        "targetPrefab is the entity the player must eliminate (character for kill, object for destroy/clearArea). " +
        "aiGroupPrefab is the GROUP prefab spawned via SlotAI as the attacking force.",
      inputSchema: {
        taskType: z
          .enum(["kill", "clearArea", "destroy"])
          .describe("Objective type. Determines which LayerTask and Slot prefabs are used."),
        taskName: z
          .string()
          .describe(
            "Short identifier used as entity name prefix and task title (e.g. 'Eliminate_Patrol'). " +
            "No spaces — use underscores. All placed entity names derive from this."
          ),
        description: z
          .string()
          .describe("Task description shown to the player in the task list."),
        position: z
          .string()
          .optional()
          .describe("World position for the Area entity as 'x y z' (e.g. '1234 0 5678'). Omit to place at the current camera position."),
        targetPrefab: z
          .string()
          .describe(
            "Prefab path for the entity the player must kill/destroy/clear. " +
            "For 'kill' type this must be a CHARACTER prefab (e.g. '{GUID}Prefabs/Characters/Factions/OPFOR/USSR_Army/Character_USSR_Unarmed.et'). " +
            "For 'destroy' type this is a vehicle or object prefab. " +
            "For 'clearArea' type this is the object prefab to clear. " +
            "Use asset_search to find the GUID-prefixed path. " +
            "WARNING: do NOT pass a group prefab here — that causes a NULL pointer crash at runtime."
          ),
        aiGroupPrefab: z
          .string()
          .describe(
            "Prefab path for the AI group to spawn via SlotAI (e.g. '{GUID}Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et'). " +
            "This must be a GROUP prefab, not a character prefab. " +
            "Use asset_search to find the GUID-prefixed path."
          ),
        triggerRadius: z
          .number()
          .default(100)
          .describe("Radius in metres of the Area trigger that activates the objective. Default 100."),
        faction: z
          .string()
          .optional()
          .describe("Faction key that owns this task (e.g. 'US', 'USSR'). Optional."),
      },
    },
    async ({ taskType, taskName, description, position, targetPrefab, aiGroupPrefab, triggerRadius, faction }) => {
      const modeErr = requireEditMode(client, "create scenario objective");
      if (modeErr) {
        return { content: [{ type: "text" as const, text: modeErr + formatConnectionStatus(client) }] };
      }

      const p = PREFABS[taskType];
      const names = {
        area:      `${taskName}_Area`,
        layerTask: `${taskName}_LayerTask`,
        layerAI:   `${taskName}_Layer_AI`,
        slot:      `${taskName}_Slot`,
        slotAI:    `${taskName}_SlotAI`,
      };
      const placed: string[] = [];
      const propWarnings: string[] = [];

      const posResult = await resolvePosition(client, position, "scenario_create_objective");
      if ("error" in posResult) {
        return { content: [{ type: "text" as const, text: posResult.error }] };
      }
      const resolvedPosition = posResult.position;

      try {
        // 1. Place Area at position
        await client.call("EMCP_WB_CreateEntity", { prefab: AREA_PREFAB, name: names.area, position: resolvedPosition });
        placed.push(names.area);

        // 2-5. Place children at world origin, reparent with transformChildToParentSpace=false
        // so their local coords stay 0 0 0 (at parent's origin).
        await client.call("EMCP_WB_CreateEntity", { prefab: p.layerTask, name: names.layerTask });
        placed.push(names.layerTask);
        await client.call("EMCP_WB_ModifyEntity", { action: "reparent", name: names.layerTask, value: names.area });

        // SlotKill/SlotClearArea/SlotDestroy must be a DIRECT child of LayerTask (not inside Layer_AI).
        // GetSlotTask() only searches direct children of LayerTask for SCR_ScenarioFrameworkSlotTask.
        await client.call("EMCP_WB_CreateEntity", { prefab: p.slot, name: names.slot });
        placed.push(names.slot);
        await client.call("EMCP_WB_ModifyEntity", { action: "reparent", name: names.slot, value: names.layerTask });

        await client.call("EMCP_WB_CreateEntity", { prefab: LAYER_PREFAB, name: names.layerAI });
        placed.push(names.layerAI);
        await client.call("EMCP_WB_ModifyEntity", { action: "reparent", name: names.layerAI, value: names.layerTask });

        await client.call("EMCP_WB_CreateEntity", { prefab: SLOT_AI_PREFAB, name: names.slotAI });
        placed.push(names.slotAI);
        await client.call("EMCP_WB_ModifyEntity", { action: "reparent", name: names.slotAI, value: names.layerAI });

        // 6. Wire properties — Area trigger (m_fAreaRadius confirmed from game sample layers)
        await setEntityProp(client, propWarnings,names.area, "SCR_ScenarioFrameworkArea.m_fAreaRadius", String(triggerRadius));

        // 7. Wire properties — LayerTask title/description/faction
        await setEntityProp(client, propWarnings,names.layerTask, `${p.layerComp}.m_sTaskTitle`, taskName);
        await setEntityProp(client, propWarnings,names.layerTask, `${p.layerComp}.m_sTaskDescription`, description);
        if (faction) {
          await setEntityProp(client, propWarnings,names.layerTask, `${p.layerComp}.m_sFactionKey`, faction);
        }

        // 8. Wire Slot — what to spawn / kill
        // targetPrefab must be a character prefab for kill type (group prefab causes NULL pointer crash in SCR_TaskKill.OnGroupEmpty)
        await setEntityProp(client, propWarnings,names.slot, `${p.slotComp}.m_sObjectToSpawn`, targetPrefab);
        // Give the target a wait waypoint so it stands in place
        await setEntityProp(client, propWarnings,names.slot, `${p.slotComp}.m_sWPToSpawn`, "{531EC45063C1F57B}Prefabs/AI/Waypoints/AIWaypoint_Wait.et");
        // Activate only when player enters the area trigger (not on mission start)
        await setEntityProp(client, propWarnings,names.slot, `${p.slotComp}.m_eActivationType`, "ON_TRIGGER_ACTIVATION");

        // 9. Wire SlotAI — group to spawn, also trigger-activated
        await setEntityProp(client, propWarnings,names.slotAI, "SCR_ScenarioFrameworkSlotAI.m_sObjectToSpawn", aiGroupPrefab);
        await setEntityProp(client, propWarnings,names.slotAI, "SCR_ScenarioFrameworkSlotAI.m_eActivationType", "ON_TRIGGER_ACTIVATION");

        const lines = [
          `**Objective created: ${taskName}**`,
          ``,
          `Entities placed:`,
          ...placed.map(n => `  - ${n}`),
          ``,
          `Task type: ${taskType}`,
          `Position: ${resolvedPosition}`,
          `Trigger radius: ${triggerRadius}m`,
          `Target (SlotKill): ${targetPrefab}`,
          `AI group (SlotAI): ${aiGroupPrefab}`,
          faction ? `Faction: ${faction}` : "",
        ];

        if (propWarnings.length > 0) {
          lines.push(
            ``,
            `**Property warnings** (${propWarnings.length} properties could not be set — set them manually in Workbench):`,
            ...propWarnings,
            ``,
            `Cause: setProperty returns false when the component class is not compiled in the current`,
            `project context. Open the entity in the Workbench Property Editor to set these directly.`,
          );
        }

        lines.push(
          ``,
          `Next steps:`,
          `1. In Workbench, verify the hierarchy under ${names.area}.`,
          `2. Add more SlotAI entities under ${names.layerAI} for additional spawn points.`,
          `3. Use wb_entity_modify setProperty to adjust activation conditions or faction filters.`,
          `4. Save the world.`,
        );

        return {
          content: [{ type: "text" as const, text: lines.filter(l => l !== "").join("\n") + formatConnectionStatus(client) }],
        };

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const cleaned = await cleanupEntities(client, placed);
        return {
          content: [{
            type: "text" as const,
            text: [
              `**scenario_create_objective failed**`,
              `Error: ${msg}`,
              ``,
              cleaned.length > 0
                ? `Cleaned up ${cleaned.length} entities: ${cleaned.join(", ")}`
                : "No entities needed cleanup.",
            ].join("\n") + formatConnectionStatus(client),
          }],
        isError: true,
        };
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Conflict base placement tool
  // ---------------------------------------------------------------------------

  const CONFLICT_BASE_PREFAB   = "{2BCE96CD93121D01}Prefabs/Systems/MilitaryBase/ConflictBase_Base.et";
  const CONFLICT_SPAWN_PREFAB  = "{E7F4D5562F48DDE4}Prefabs/MP/Spawning/SpawnPoint_Base.et";

  // Faction-specific patrol prefabs (faction affiliation pre-baked — no property setting needed)
  // FIA has a known faction-specific GUID; US/USSR use base + property set via fixed setEntityProp
  const PATROL_PREFAB_BY_FACTION: Record<string, string> = {
    FIA: "{9273AB931008C271}Prefabs/Systems/AmbientPatrol/AmbientPatrolSpawnpoint_FIA.et",
  };
  const CONFLICT_PATROL_PREFAB_DEFAULT = "{1E4C8AD00BBB16AA}Prefabs/Systems/AmbientPatrol/AmbientPatrolSpawnpoint_Base.et";

  // Patrol offsets relative to base position (x, z)
  const PATROL_OFFSETS = [[30,0],[-30,0],[0,30],[0,-30],[25,25],[-25,-25]] as [number,number][];

  server.registerTool(
    "scenario_create_base",
    {
      description:
        "Place a complete Conflict military base setup in the live Workbench world — " +
        "one ConflictBase entity, ambient patrol spawnpoints, and a faction spawn point. " +
        "Use this to interactively add individual bases to an existing Conflict world. " +
        "For generating a full scenario from scratch (multiple bases + mission header) use scenario_create_conflict instead. " +
        "Requires Workbench running in Edit mode with a Conflict world open.",
      inputSchema: {
        baseName: z
          .string()
          .describe("Base name/callsign, e.g. 'BaseAlpha'. Used as entity name prefix and m_sBaseName property."),
        position: z
          .string()
          .optional()
          .describe("World position as 'x y z'. Omit to place at current camera position."),
        faction: z
          .string()
          .describe("Faction that starts as owner: 'US', 'USSR', 'FIA', or a custom faction key."),
        type: z
          .enum(["base", "MOB"])
          .optional()
          .describe(
            "Base type. 'base' (default) = standard contested base. " +
            "'MOB' = main operating base / HQ (seizing disabled, 3000 supplies, radio source)."
          ),
        patrolCount: z
          .number()
          .min(0)
          .max(6)
          .default(2)
          .describe("Number of ambient patrol spawnpoints to place around the base (0-6, default 2)."),
      },
    },
    async ({ baseName, position, faction, type, patrolCount }) => {
      const modeErr = requireEditMode(client, "create conflict base");
      if (modeErr) {
        return { content: [{ type: "text" as const, text: modeErr + formatConnectionStatus(client) }] };
      }

      const placed: string[] = [];
      const propWarnings: string[] = [];

      const posResult = await resolvePosition(client, position, "scenario_create_base");
      if ("error" in posResult) {
        return { content: [{ type: "text" as const, text: posResult.error }] };
      }
      const resolvedPosition = posResult.position;

      // Parse position for patrol offsets
      const posParts = resolvedPosition.trim().split(/\s+/);
      const px = parseFloat(posParts[0] ?? "0");
      const py = parseFloat(posParts[1] ?? "0");
      const pz = parseFloat(posParts[2] ?? "0");

      const names = {
        base:      `${baseName}_Base`,
        spawnPoint: `${baseName}_SpawnPoint`,
      };

      try {
        // 1. Place base entity
        await client.call("EMCP_WB_CreateEntity", { prefab: CONFLICT_BASE_PREFAB, name: names.base, position: resolvedPosition });
        placed.push(names.base);

        // 2. Wire base properties
        await setEntityProp(client, propWarnings,names.base, "SCR_CampaignMilitaryBaseComponent.m_sBaseName", baseName);
        await setEntityProp(client, propWarnings,names.base, 'SCR_FactionAffiliationComponent."faction affiliation"', faction);
        if (type === "MOB") {
          await setEntityProp(client, propWarnings,names.base, "SCR_CampaignMilitaryBaseComponent.m_bCanBeHQ", "1");
          await setEntityProp(client, propWarnings,names.base, "SCR_CampaignMilitaryBaseComponent.m_bDisableWhenUnusedAsHQ", "1");
          await setEntityProp(client, propWarnings,names.base, "SCR_CoverageRadioComponent.m_bIsSource", "1");
          await setEntityProp(client, propWarnings,names.base, "SCR_CampaignSeizingComponent.Enabled", "0");
        }

        // 3. Place patrol spawnpoints around base
        // Use faction-specific prefab where available (faction pre-baked), otherwise base + property set
        const patrolPrefab = PATROL_PREFAB_BY_FACTION[faction] ?? CONFLICT_PATROL_PREFAB_DEFAULT;
        const needsFactionProp = !(faction in PATROL_PREFAB_BY_FACTION);
        const count = Math.min(Math.max(patrolCount, 0), 6);
        const patrolNames: string[] = [];
        for (let i = 0; i < count; i++) {
          const [ox, oz] = PATROL_OFFSETS[i]!;
          const patrolPos = `${px + ox} ${py} ${pz + oz}`;
          const patrolName = `${baseName}_Patrol_${i + 1}`;
          await client.call("EMCP_WB_CreateEntity", { prefab: patrolPrefab, name: patrolName, position: patrolPos });
          placed.push(patrolName);
          patrolNames.push(patrolName);
          if (needsFactionProp) {
            await setEntityProp(client, propWarnings, patrolName, 'SCR_FactionAffiliationComponent."faction affiliation"', faction);
          }
        }

        // 4. Place spawn point
        await client.call("EMCP_WB_CreateEntity", { prefab: CONFLICT_SPAWN_PREFAB, name: names.spawnPoint, position: resolvedPosition });
        placed.push(names.spawnPoint);
        // m_sFaction is a root entity property on SCR_SpawnPoint, not inside a component
        await setEntityProp(client, propWarnings, names.spawnPoint, "m_sFaction", faction);

        const lines = [
          `**Conflict base created: ${baseName}**`,
          ``,
          `Entities placed:`,
          ...placed.map(n => `  - ${n}`),
          ``,
          `Type: ${type ?? "base"}`,
          `Faction: ${faction}`,
          `Position: ${resolvedPosition}`,
          `Patrol spawnpoints: ${count}`,
        ];

        if (propWarnings.length > 0) {
          lines.push(
            ``,
            `**Property warnings** (${propWarnings.length} properties could not be set — set manually in Workbench):`,
            ...propWarnings,
          );
        }

        lines.push(
          ``,
          `Next steps:`,
          `1. Select ${names.base} and snap to terrain.`,
          `2. Adjust patrol spawnpoint positions around the base perimeter.`,
          `3. Add ${names.base} name to the mission header m_aCampaignCustomBaseList.`,
          `4. Add SCR_DefenderSpawnerComponent entities inside base buildings for reinforcements.`,
          type !== "MOB" ? `5. Ensure at least one MOB per faction exists in the world for radio coverage.` : `5. MOB placed — verify radio coverage reaches contested bases.`,
        );

        return {
          content: [{ type: "text" as const, text: lines.join("\n") + formatConnectionStatus(client) }],
        };

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const cleaned = await cleanupEntities(client, placed);
        return {
          content: [{
            type: "text" as const,
            text: [
              `**scenario_create_base failed**`,
              `Error: ${msg}`,
              ``,
              cleaned.length > 0
                ? `Cleaned up ${cleaned.length} entities: ${cleaned.join(", ")}`
                : "No entities needed cleanup.",
            ].join("\n") + formatConnectionStatus(client),
          }],
        isError: true,
        };
      }
    }
  );
}
