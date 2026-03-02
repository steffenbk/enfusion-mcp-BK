import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkbenchClient } from "../workbench/client.js";

const SF = "Prefabs/Systems/ScenarioFramework/Components";

const PREFABS: Record<string, Record<string, string>> = {
  kill: {
    layerTask: `{5AF3BFDA2EAE56EA}${SF}/LayerTaskKill.et`,
    slot:      `{C70DC6CBD1AAEC9A}${SF}/SlotKill.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotKill",
    layerComp: "SCR_ScenarioFrameworkLayerTaskKill",
  },
  clearArea: {
    layerTask: `{775C493CE872C3A5}${SF}/LayerTaskClearArea.et`,
    slot:      `{E53456990A756229}${SF}/SlotClearArea.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotClearArea",
    layerComp: "SCR_ScenarioFrameworkLayerTaskClearArea",
  },
  destroy: {
    layerTask: `{5AF3BFDA2EAE56EA}${SF}/LayerTaskDestroy.et`,
    slot:      `{7586595959BA2D99}${SF}/SlotDestroy.et`,
    slotComp:  "SCR_ScenarioFrameworkSlotDestroy",
    layerComp: "SCR_ScenarioFrameworkLayerTaskDestroy",
  },
};

const AREA_PREFAB    = `{3AAECFCAE1BE0189}${SF}/Area.et`;
const LAYER_PREFAB   = `{3AAECFCAE1BE0189}${SF}/Layer.et`;
const SLOT_AI_PREFAB = `{8D43830F02C3F114}${SF}/SlotAI.et`;

export function registerScenarioTools(server: McpServer, client: WorkbenchClient): void {
  server.registerTool(
    "scenario_create_objective",
    {
      description:
        "Place a complete Scenario Framework objective hierarchy in the live Workbench scene. " +
        "Creates Area → LayerTask → Layer_AI → SlotKill + SlotAI entities and wires all cross-references. " +
        "Requires Workbench to be running with a world open. " +
        "Use for kill/clearArea/destroy tasks that spawn an AI group when a player enters the trigger area.",
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
          .describe("World position for the Area entity as 'x y z' (e.g. '1234 0 5678')."),
        aiGroupPrefab: z
          .string()
          .describe(
            "Prefab path for the AI group to spawn (e.g. '{GUID}Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et'). " +
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
    async ({ taskType, taskName, description, position, aiGroupPrefab, triggerRadius, faction }) => {
      const p = PREFABS[taskType];
      const names = {
        area:      `${taskName}_Area`,
        layerTask: `${taskName}_LayerTask`,
        layerAI:   `${taskName}_Layer_AI`,
        slot:      `${taskName}_Slot`,
        slotAI:    `${taskName}_SlotAI`,
      };
      const placed: string[] = [];

      async function wb<T extends Record<string, unknown>>(handler: string, params: Record<string, unknown>): Promise<T> {
        return client.call<T>(handler, params);
      }

      try {
        // 1. Place Area at position
        await wb("EMCP_WB_CreateEntity", { prefab: AREA_PREFAB, name: names.area, position });
        placed.push(names.area);

        // 2. Place LayerTask (world root, then reparent)
        await wb("EMCP_WB_CreateEntity", { prefab: p.layerTask, name: names.layerTask });
        placed.push(names.layerTask);
        await wb("EMCP_WB_ModifyEntity", { action: "reparent", name: names.layerTask, value: names.area });

        // 3. Place Layer_AI (world root, then reparent under LayerTask)
        await wb("EMCP_WB_CreateEntity", { prefab: LAYER_PREFAB, name: names.layerAI });
        placed.push(names.layerAI);
        await wb("EMCP_WB_ModifyEntity", { action: "reparent", name: names.layerAI, value: names.layerTask });

        // 4. Place Slot (SlotKill/SlotDestroy/SlotClearArea) under Layer_AI
        await wb("EMCP_WB_CreateEntity", { prefab: p.slot, name: names.slot });
        placed.push(names.slot);
        await wb("EMCP_WB_ModifyEntity", { action: "reparent", name: names.slot, value: names.layerAI });

        // 5. Place SlotAI under Layer_AI
        await wb("EMCP_WB_CreateEntity", { prefab: SLOT_AI_PREFAB, name: names.slotAI });
        placed.push(names.slotAI);
        await wb("EMCP_WB_ModifyEntity", { action: "reparent", name: names.slotAI, value: names.layerAI });

        // 6. Wire properties — Area trigger
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.area,
          propertyPath: "SCR_ScenarioFrameworkArea.m_eActivationType", value: "ON_TRIGGER_ACTIVATION",
        });
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.area,
          propertyPath: "SCR_ScenarioFrameworkArea.m_fTriggerRadius", value: String(triggerRadius),
        });

        // 7. Wire properties — LayerTask title/description/faction
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.layerTask,
          propertyPath: `${p.layerComp}.m_sTaskTitle`, value: taskName,
        });
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.layerTask,
          propertyPath: `${p.layerComp}.m_sTaskDescription`, value: description,
        });
        if (faction) {
          await wb("EMCP_WB_ModifyEntity", {
            action: "setProperty", name: names.layerTask,
            propertyPath: `${p.layerComp}.m_sFactionKey`, value: faction,
          });
        }

        // 8. Wire Slot — what to spawn / kill
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.slot,
          propertyPath: `${p.slotComp}.m_sObjectToSpawn`, value: aiGroupPrefab,
        });

        // 9. Wire SlotAI — group to spawn
        await wb("EMCP_WB_ModifyEntity", {
          action: "setProperty", name: names.slotAI,
          propertyPath: "SCR_ScenarioFrameworkSlotAI.m_sObjectToSpawn", value: aiGroupPrefab,
        });

        return {
          content: [{
            type: "text" as const,
            text: [
              `**Objective created: ${taskName}**`,
              ``,
              `Entities placed:`,
              ...placed.map(n => `  - ${n}`),
              ``,
              `Task type: ${taskType}`,
              `Position: ${position}`,
              `Trigger radius: ${triggerRadius}m`,
              `AI group: ${aiGroupPrefab}`,
              faction ? `Faction: ${faction}` : "",
              ``,
              `Next steps:`,
              `1. In Workbench, verify the hierarchy under ${names.area}.`,
              `2. Add more SlotAI entities under ${names.layerAI} for additional spawn points.`,
              `3. Use wb_entity_modify setProperty to adjust activation conditions or faction filters.`,
              `4. Save the world.`,
            ].filter(l => l !== "").join("\n"),
          }],
        };

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{
            type: "text" as const,
            text: [
              `**scenario_create_objective failed**`,
              `Error: ${msg}`,
              ``,
              placed.length > 0
                ? `Entities already placed (clean up manually or delete them):\n${placed.map(n => `  - ${n}`).join("\n")}`
                : "No entities were placed.",
            ].join("\n"),
          }],
        };
      }
    }
  );
}
