import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

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

export function registerScenarioTools(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "scenario_create_objective",
    {
      description:
        "Place a complete Scenario Framework objective hierarchy in the live Workbench scene. " +
        "Creates Area → LayerTask → Layer_AI → SlotKill + SlotAI entities and wires all cross-references. " +
        "Requires Workbench to be running with a world open. " +
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

      async function cleanupPlaced(): Promise<string[]> {
        const cleaned: string[] = [];
        for (const entityName of placed) {
          try {
            await client.call("EMCP_WB_DeleteEntity", { name: entityName });
            cleaned.push(entityName);
          } catch {
            // Entity might not exist if creation itself failed
          }
        }
        return cleaned;
      }

      // setProperty: propertyPath = component class, propertyKey = property name.
      // Returns false (not an error) when the component class is unresolvable in the current
      // Workbench project context (e.g. base-game-only compiled classes). Collect as warnings.
      async function setProp(entityName: string, componentDotProp: string, value: string): Promise<void> {
        const dot = componentDotProp.lastIndexOf(".");
        const propertyPath = componentDotProp.slice(0, dot);
        const propertyKey  = componentDotProp.slice(dot + 1);
        const res = await client.call<Record<string, unknown>>("EMCP_WB_ModifyEntity", { action: "setProperty", name: entityName, propertyPath, propertyKey, value });
        if (res.status !== "ok") {
          propWarnings.push(`  ${entityName} ${componentDotProp} = ${value}  (${String(res.message ?? "failed")})`);
        }
      }

      // Resolve position — if not provided, query current camera position
      let resolvedPosition = position;
      if (!resolvedPosition) {
        const camRes = await client.call<{ status: string; position?: string; message?: string }>("EMCP_WB_GetCameraPos", {});
        if (camRes.status === "ok" && camRes.position) {
          resolvedPosition = camRes.position;
        } else {
          return {
            content: [{ type: "text" as const, text: `**scenario_create_objective failed**\nCould not get camera position: ${camRes.message ?? "unknown error"}. Pass an explicit 'position' parameter.` }],
          };
        }
      }

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
        await setProp(names.area, "SCR_ScenarioFrameworkArea.m_fAreaRadius", String(triggerRadius));

        // 7. Wire properties — LayerTask title/description/faction
        await setProp(names.layerTask, `${p.layerComp}.m_sTaskTitle`, taskName);
        await setProp(names.layerTask, `${p.layerComp}.m_sTaskDescription`, description);
        if (faction) {
          await setProp(names.layerTask, `${p.layerComp}.m_sFactionKey`, faction);
        }

        // 8. Wire Slot — what to spawn / kill
        // targetPrefab must be a character prefab for kill type (group prefab causes NULL pointer crash in SCR_TaskKill.OnGroupEmpty)
        await setProp(names.slot, `${p.slotComp}.m_sObjectToSpawn`, targetPrefab);
        // Give the target a wait waypoint so it stands in place
        await setProp(names.slot, `${p.slotComp}.m_sWPToSpawn`, "{531EC45063C1F57B}Prefabs/AI/Waypoints/AIWaypoint_Wait.et");
        // Activate only when player enters the area trigger (not on mission start)
        await setProp(names.slot, `${p.slotComp}.m_eActivationType`, "ON_TRIGGER_ACTIVATION");

        // 9. Wire SlotAI — group to spawn, also trigger-activated
        await setProp(names.slotAI, "SCR_ScenarioFrameworkSlotAI.m_sObjectToSpawn", aiGroupPrefab);
        await setProp(names.slotAI, "SCR_ScenarioFrameworkSlotAI.m_eActivationType", "ON_TRIGGER_ACTIVATION");

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
          content: [{ type: "text" as const, text: lines.filter(l => l !== "").join("\n") }],
        };

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const cleaned = await cleanupPlaced();
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
            ].join("\n"),
          }],
        };
      }
    }
  );
}
