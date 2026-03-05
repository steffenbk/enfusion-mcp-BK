# Scenario Framework

Reference data derived from `Data006/Prefabs/Systems/ScenarioFramework/`.

---

## Game Mode Setup

Two base game mode prefabs exist:

| Prefab | Description |
|---|---|
| `GameModeSF.et` | Multiplayer — inherits `GameMode_Plain.et`, adds `SCR_GameModeSFManager`, `SignalsManagerComponent`, `SCR_CommunicationSoundComponent`. Sets `PlayerControllerPrefab` to `DefaultPlayerControllerMP_ScenarioFramework.et`. |
| `GameModeSF_SinglePlayer.et` | Single player — inherits `GameModeSF.et`, adds `SCR_DeathGameOverManagerComponent`, `SCR_RespawnSystemComponent` (with `SCR_MenuSpawnLogic`, faction forced to `"US"`), `SCR_TimeAndWeatherHandlerComponent`. Sets `m_bAllowFactionChange 0`, `m_fAutoReloadTime -1`, `m_bUseSpawnPreload 1`. |

---

## Core Hierarchy: Area → Layer → Slot

The framework is a **three-level prefab tree** placed in the world as child entities.

```
SCR_ScenarioFrameworkArea           (Area.et)
  └─ SCR_ScenarioFrameworkLayerBase (Layer.et / LayerTask*.et)
       └─ SCR_ScenarioFrameworkSlotBase (Slot*.et)
```

### Area (`Components/Area.et`)
- Component: `SCR_ScenarioFrameworkArea`
- Default `m_eActivationType ON_INIT` — activates at mission start.
- Acts as the root container; holds Layers as child entities.
- Key properties: `m_sTriggerResource`, `m_fAreaRadius`, `m_bOnce`, `m_aTriggerActions` (list of `SCR_ScenarioFrameworkActionBase`).
- ScriptInvokers: `m_OnTriggerActivated`, `m_OnAreaInit`.

### Layer (`Components/Layer.et`)
- Component: `SCR_ScenarioFrameworkLayerBase`
- Purely organisational — groups Slots under an Area.
- Key inherited properties: `m_SpawnChildren`, `m_sFactionKey`, `m_iRandomPercent`, `m_bEnableRepeatedSpawn`, `m_iRepeatedSpawnNumber`, `m_fRepeatedSpawnTimer`, `m_eActivationType`, `m_aActivationConditions`.

### LayerTask variants (`Components/LayerTask*.et`)
These are Layers that also own a task definition.

| Prefab | Component | Task prefab wired |
|---|---|---|
| `LayerTask.et` | `SCR_ScenarioFrameworkLayerTask` | `Tasks/Task.et` |
| `LayerTaskClearArea.et` | `SCR_ScenarioFrameworkLayerTaskClearArea` | `Tasks/TaskClearArea.et` |
| `LayerTaskDefend.et` | `SCR_ScenarioFrameworkLayerTaskDefend` | (+ `RplComponent`) |
| `LayerTaskDeliver.et` | `SCR_ScenarioFrameworkLayerTaskDeliver` | `Tasks/TaskDeliver.et` |
| `LayerTaskDestroy.et` | `SCR_ScenarioFrameworkLayerTaskDestroy` | `Tasks/TaskDestroy.et` |
| `LayerTaskKill.et` | `SCR_ScenarioFrameworkLayerTaskKill` | `Tasks/TaskKill.et` |
| `LayerTaskMove.et` | `SCR_ScenarioFrameworkLayerTaskMove` | `Tasks/TaskMove.et`, `m_bPlaceMarkerOnSubjectSlot 1` |

LayerTask prefabs carry `m_sTaskTitle` and `m_sTaskDescription` localization keys.

---

## Slot Prefabs (`Components/Slot*.et`)

Slots are leaves — they **spawn objects / AI / triggers** at their world position.

| Prefab | Component | Purpose |
|---|---|---|
| `Slot.et` | `SCR_ScenarioFrameworkSlotBase` | Generic object spawn. `m_sObjectToSpawn` = prefab path. |
| `SlotAI.et` | `SCR_ScenarioFrameworkSlotAI` | Spawns AI group. `m_sWPToSpawn` = waypoint prefab (default: `AIWaypoint_Defend.et`). `m_bSpawnAIOnWPPos 0`. |
| `SlotClearArea.et` | `SCR_ScenarioFrameworkSlotClearArea` | Spawns `TriggerDominance.et`, has `SCR_ScenarioFrameworkPluginTrigger`. |
| `SlotDefend.et` | `SCR_ScenarioFrameworkSlotDefend` | Spawns AI with defend waypoint. |
| `SlotDelivery.et` | `SCR_ScenarioFrameworkSlotDelivery` | Delivery zone. `m_sFactionKey "US"`, spawns `TriggerCharacterSlow.et`, plugin radius 5 m. Sets `m_sID` for delivery matching. |
| `SlotDestroy.et` | `SCR_ScenarioFrameworkSlotDestroy` | Target object slot. `m_sObjectToSpawn` = destructible prefab. |
| `SlotExtraction.et` | `SCR_ScenarioFrameworkSlotExtraction` | Extraction zone. Spawns `ScenarioFrameworkTrigger.et`, plugin: `SCR_ChimeraCharacter` filter, `m_fUpdateRate 2`. |
| `SlotKill.et` | `SCR_ScenarioFrameworkSlotKill` | Target AI to kill. Uses defend waypoint. |
| `SlotMarker.et` | `SCR_ScenarioFrameworkSlotMarker` | Map marker only, no spawn. |
| `SlotMoveTo.et` | `SCR_ScenarioFrameworkSlotExtraction` | Move-to destination (inherits SlotExtraction, radius 10 m). |
| `SlotPick.et` | `SCR_ScenarioFrameworkSlotPick` | Pickable item slot. `m_bCanBeGarbageCollected 0`. |
| `SlotPlayerTrigger.et` | `SCR_ScenarioFrameworkSlotTrigger` | Player-enters trigger. Spawns `TriggerCharacterSlow.et`. Plugin `m_bOnce 0`. |
| `SlotTask.et` | `SCR_ScenarioFrameworkSlotTask` | Attaches a task to the slot. |
| `SlotTrigger.et` | `SCR_ScenarioFrameworkSlotTrigger` | Generic trigger slot. Spawns `ScenarioFrameworkTrigger.et`. Plugin `m_eActivationPresence SPECIFIC_PREFAB_NAME`. |
| `SlotWaypoint.et` | `SCR_ScenarioFrameworkSlotWaypoint` | Waypoint marker slot. |

Key shared `SCR_ScenarioFrameworkSlotBase` properties:
- `m_sObjectToSpawn` — resource path of prefab to spawn.
- `m_aFactionSwitchedObjects` — per-faction object overrides.
- `m_sID` — unique string ID for cross-reference (delivery matching etc.).
- `m_bUseExistingWorldAsset` — reuse an already-placed world entity instead of spawning.
- `m_bCanBeGarbageCollected` — allow engine to despawn when not needed.
- `m_bRandomizePerFaction`, `m_eEntityCatalogType`, `m_aIncludedEditableEntityLabels`.

---

## Task Prefabs (`Tasks/`)

Standalone entities placed under the `TaskManager.et`.

| Prefab | Entity class | Map icon | Notes |
|---|---|---|---|
| `Task.et` | `SCR_ScenarioFrameworkTask` | (none) | Generic task base. |
| `TaskArea.et` | `SCR_ScenarioFrameworkTaskArea` | `Task_Move` | Move/area task. |
| `TaskClearArea.et` | `SCR_ScenarioFrameworkTaskClearArea` | `Task_Seize` | `m_bNotifyAssignment 1`, `m_bNotifyUnassign 1`. |
| `TaskDefend.et` | `SCR_TaskDefend` | `Task_Defend` | Faction 2 in MapDescriptor. |
| `TaskDeliver.et` | `SCR_TaskDeliver` | `Task_Unload` | |
| `TaskDestroy.et` | `SCR_TaskDestroyObject` | `Task_Sabotage` | Uses `SCR_IconImageset`. |
| `TaskExtract.et` | `SCR_ScenarioFrameworkTaskExtract` | `Task_Evac` | |
| `TaskKill.et` | `SCR_TaskKill` | `Task_Neutralize` | |
| `TaskMove.et` | `SCR_ScenarioFrameworkTaskArea` | `Task_Move` | |

All tasks use `SCR_MapDescriptorComponent` with `VisibleOnMap 0` by default.

### TaskManager (`Tasks/TaskManager.et`)
- Inherits `TaskManager_Editor.et`.
- Ships with one `SCR_ScenarioFrameworkTaskSupportEntity` child per task type (ClearArea, Defend, Deliver, Destroy, Extract, Kill, generic).
- Must be present in the scene for tasks to register.

---

## Triggers (`Triggers/`)

Trigger entities spawned **by Slots** (via `m_sObjectToSpawn`).

| Prefab | Entity class | Shape | Purpose |
|---|---|---|---|
| `ScenarioFrameworkTrigger.et` | `SCR_ScenarioFrameworkTriggerEntity` | Sphere r=5 | Generic SF trigger. `m_eActivationPresence SPECIFIC_PREFAB_NAME`. Has `RplComponent`. |
| `ScenarioFrameworkCharacterTrigger.et` | `SCR_CharacterTriggerEntity` | Sphere r=5 | Character-based SF trigger. `m_eActivationPresence ANY_CHARACTER`. Has `RplComponent`. |
| `TriggerAnyPlayerSlow.et` | `SCR_CharacterTriggerEntity` | Sphere r=5 | Player-only, `m_eActivationPresence PLAYER`. Slow update (5 s). |
| `TriggerCharacterSlow.et` | `SCR_CharacterTriggerEntity` | Sphere r=5 | `SCR_ChimeraCharacter` filter, `ANY_CHARACTER`. Has `RplComponent`. Used by delivery/extraction. |
| `TriggerDeliver.et` | `SCR_BaseTriggerEntity` | Sphere r=25 | `ChimeraCharacter` filter, update 3 s. No faction filter. |
| `TriggerDominance.et` | `SCR_FactionDominanceTriggerEntity` | Sphere r=50 | US faction, `More than 0.528` ratio. Update 2 s. Used by clear-area. |
| `TriggerExtraction.et` | `SCR_PlayersPresentTriggerEntity` | Sphere r=10 | US faction, `ChimeraCharacter` filter. Has `RplComponent`. Update 2 s. |

---

## Logic Entities (`Components/Logic*.et`)

Utility entities for wiring conditions, not containers for slots.

| Prefab | Entity class | Use |
|---|---|---|
| `LogicCounter.et` | `SCR_ScenarioFrameworkLogicCounter` | Count events before triggering next action. |
| `LogicOR.et` | `SCR_ScenarioFrameworkLogicOR` | Fire when any connected input fires. |
| `LogicSwitch.et` | `SCR_ScenarioFrameworkLogicSwitch` | Toggle between two outputs. |

---

## Actions (`SCR_ScenarioFrameworkActionBase` subclasses)

Actions are `BaseContainerObject` inline objects stored in `m_aTriggerActions` on Area/Layer/Slot. They fire when their parent's trigger activates.

Key built-in action subclasses (128+ total):
- `SCR_ScenarioFrameworkActionAssignTask` — assign a task to players.
- `SCR_ScenarioFrameworkActionAddTaskProgress` — increment task progress counter.
- `SCR_ScenarioFrameworkActionAddItemToInventory` — give item to character.
- `SCR_ScenarioFrameworkActionAI` — issue AI commands.
- `SCR_ScenarioFrameworkActionAddNotoriety` — adjust notoriety value.
- `SCR_ScenarioFrameworkAIActionSetRadioFrequency` — set AI radio freq.
- `SCR_ScenarioFrameworkActionAppendBriefingEntryText` — add text to briefing.
- `SCR_ScenarioFrameworkActionAttachToSlotManager` — attach entity to a slot.
- `SCR_ScenarioFrameworkActionBasedOnConditions` — conditional branch with `m_aActions` / `m_aFailedActions`.

Common base properties on all actions:
- `m_iMaxNumberOfActivations` — 0 = unlimited.
- `m_bDebug` — enable debug logging.

---

## QRF (Quick Reaction Force) System

A ready-made reactive AI response system.

### Prefabs
- `Compositions/QRFSpawnpoint.et` — single spawn slot, uses `SCR_ScenarioFrameworkQRFSlotAI`, `m_iGroupType 3`.
- `Compositions/QRFSpawnpointsLayer.et` — Layer containing multiple `QRFSpawnpoint` children. Default layer name referenced: `"QRFSpawnpointsLayer"`.

### Config (`Core/QRFDispacherAction.conf`)
Class: `SCR_ScenarioFrameworkActionQRFDispacher`

Key properties:
- `m_sQRFLayerName` — name of the QRF spawnpoints layer entity (`"QRFSpawnpointsLayer"`).
- `m_iNumberOfAvailableQRFWaves` — max waves (default 3).
- `m_fThreatLevelEscalation` — multiplier per wave (default 1.5).
- `m_fQRFSpawnDelay` — seconds before first spawn (default 15).
- `m_fQRFNextWaveDelay` — seconds between waves (default 120).
- `m_aGroupList` — array of `SCR_QRFGroupConfig` with `m_sGroupPrefab` and optional `m_iSpawnCost` (default 1).
- `m_aQRFMaxDistanceConfig` — per group type max spawn distances (INFANTRY 250 m, MOUNTED/VEHICLE 500 m, AIR 2000 m).
- `m_aWPConfig` — waypoints assigned per group type (GetOut for mounted, Move then SearchAndDestroy for infantry).
- `m_sQRFRequestedSoundEventName`, `m_sQRFSentSoundEventName`, `m_sSoundProjectFile`.

Safe zone: `SCR_QRFSpawnSafeZone` attached per spawn slot to prevent spawning on top of players.

---

## Activation Types (`SCR_ScenarioFrameworkEActivationType`)

Set via `m_eActivationType` on Area and Layer (integer value set via MCP/setProperty):

| Value | Name | Meaning |
|---|---|---|
| 0 | SAME_AS_PARENT | Inherit activation from parent |
| 1 | ON_TRIGGER_ACTIVATION | Wait for a trigger slot child to fire |
| 2 | ON_AREA_TRIGGER_ACTIVATION | Wait for the Area's own trigger |
| 3 | ON_INIT | Fire immediately at init (default) |

**Trigger slot activation pattern:**
- Set Layer `m_eActivationType = 1` (ON_TRIGGER_ACTIVATION)
- Add `SlotPlayerTrigger.et` as a **sibling** of `SlotAI.et` under the same Layer
- Set `m_sFactionKey` on SlotPlayerTrigger to the faction that triggers it (e.g. `US`)
- When a BLUFOR player enters the trigger zone → Layer activates → SlotAI spawns

Trigger plugin `m_eActivationPresence` values seen:
- `SPECIFIC_PREFAB_NAME`
- `ANY_CHARACTER`
- `PLAYER`

---

## Typical Setup Pattern

1. Place `GameModeSF.et` (or `_SinglePlayer`) as the game mode entity.
2. Place `Tasks/TaskManager.et` in the scene.
3. Place an `Area.et` entity at the mission location.
4. Under it, add `Layer.et` children (or `LayerTask*.et` for tasks).
5. Under each Layer, add `Slot*.et` leaves with `m_sObjectToSpawn` pointing to the desired prefab.
6. Wire actions via `m_aTriggerActions` on Area/Layer/Slot.
7. For reactive AI, add a `QRFSpawnpointsLayer.et` and attach `SCR_ScenarioFrameworkActionQRFDispacher` as an action.

---

## Minimal Confirmed Spawn Setup (no tasks needed)

Confirmed working in testing:

```
Area1 (Area.et)                   — m_eActivationType=3 (ON_INIT), m_fAreaRadius=10+
  Layer1 (Layer.et)               — m_eActivationType=3 (ON_INIT)
    SlotAI1 (SlotAI.et)           — m_sObjectToSpawn=Prefabs/Characters/Campaign/Final/OPFOR/USSR_Army/Campaign_USSR_AI.et
                                    m_sFactionKey=USSR
```

**AI prefab confirmed working:** `Prefabs/Characters/Campaign/Final/OPFOR/USSR_Army/Campaign_USSR_AI.et`

### Trigger variant (BLUFOR walks in → OPFOR spawns):

```
Area1 (Area.et)                    — m_eActivationType=3 (ON_INIT)
  Layer1 (Layer.et)                — m_eActivationType=1 (ON_TRIGGER_ACTIVATION)
    SlotAI1 (SlotAI.et)            — m_sObjectToSpawn=..., m_sFactionKey=USSR
    SlotPlayerTrigger1 (SlotPlayerTrigger.et) — m_sFactionKey=US
```

Note: Area must itself be ON_INIT so it initialises the Layer.
The Layer waits for SlotPlayerTrigger to fire before spawning SlotAI.

---

## Sample: SF-Sample-ConditionalLogic

Demonstrates `SCR_ScenarioFrameworkActionBasedOnConditions` — branch logic that fires different
actions depending on whether conditions pass or fail.

### Pattern: Button-triggered conditional check

Each "station" in the sample is a `Layer.et` with two `m_aActivationActions`:
1. `SCR_ScenarioFrameworkActionOnUserActionEvent` on the button — resets the layer via
   `SCR_ScenarioFrameworkActionRestoreLayerToDefault` (with `m_bReinitAfterRestoration 1`) so it can be re-used.
2. Another `SCR_ScenarioFrameworkActionOnUserActionEvent` on the same button — runs
   `SCR_ScenarioFrameworkActionBasedOnConditions` to evaluate a condition, then spawns a Slot (indicator light)
   if the condition passes.

```
SCR_ScenarioFrameworkActionOnUserActionEvent   // button press
  m_Getter: SCR_ScenarioFrameworkGetEntityByName { m_sEntityName "GreenButton1" }
  m_iActionID: 0
  m_aActions:
    SCR_ScenarioFrameworkActionBasedOnConditions
      m_aActivationConditions: [ <condition> ]
      m_aActions: [ SCR_ScenarioFrameworkActionSpawnObjects { m_aNameOfObjectsToSpawnOnActivation "Slot1" } ]
```

Reset pattern (always paired with the condition check on the same button press):
```
SCR_ScenarioFrameworkActionRestoreLayerToDefault
  m_Getter: SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "LayerName" }
  m_bReinitAfterRestoration: 1
```

### Action: SCR_ScenarioFrameworkActionOnUserActionEvent

Listens for a UserAction interaction on a world entity. Fires `m_aActions` when the player performs
the action.

| Property | Description |
|---|---|
| `m_Getter` | Entity getter — typically `SCR_ScenarioFrameworkGetEntityByName` |
| `m_iActionID` | Index into the entity's `additionalActions` list (0 = first action) |
| `m_aActions` | Actions to run when the user action fires |

The target entity needs `ActionsManagerComponent` with `additionalActions` containing a
`SCR_BaseAudioScriptedUserAction` (or similar). Both Green and Red button props use
`SCR_BaseAudioScriptedUserAction` with a `UserActionContext` named `"Press"` and radius 0.7.

Button prop paths:
- Green: `{B4284D6D23F0C821}Assets/Structures/BuildingsParts/Electrical/Data/IndustrialUtilityPropSet_Button_Green_01.xob`
- Red: `{42240B79FDE73742}Assets/Structures/BuildingsParts/Electrical/Data/IndustrialUtilityPropSet_Button_Red_01.xob`

### Action: SCR_ScenarioFrameworkActionBasedOnConditions

Conditional branch. Evaluates `m_aActivationConditions`; if all pass, runs `m_aActions`;
if any fail, runs `m_aFailedActions` (optional).

### Action: SCR_ScenarioFrameworkActionSpawnObjects

Spawns named child Slot entities on demand (instead of at init).

| Property | Description |
|---|---|
| `m_aNameOfObjectsToSpawnOnActivation` | Array of Slot entity names to spawn |

Slot must have `m_eActivationType ON_TRIGGER_ACTIVATION` to wait for this manual spawn call.

### Action: SCR_ScenarioFrameworkActionDeleteEntity

Deletes a previously spawned entity.

| Property | Description |
|---|---|
| `m_Getter` | `SCR_ScenarioFrameworkGetSpawnedEntity { m_sLayerName "SlotName" }` |

### Action: SCR_ScenarioFrameworkActionRestoreLayerToDefault

Resets a Layer back to its default (unspawned) state so it can activate again.

| Property | Description |
|---|---|
| `m_Getter` | `SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "LayerName" }` |
| `m_bReinitAfterRestoration` | 1 = immediately re-initialise after restore (required for repeat use) |

### Action: SCR_ScenarioFrameworkActionMedical

Apply medical effects to a character.

| Property | Description |
|---|---|
| `m_Getter` | Entity getter (e.g. `SCR_ScenarioFrameworkGetPlayerEntity`) |
| `m_aMedicalActions` | Array of medical sub-actions |

Medical sub-actions seen:
- `SCR_ScenarioFrameworkMedicalActionAddFallDamage { m_fFallDamage 40 }` — apply fall damage
- `SCR_ScenarioFrameworkMedicalActionAddParticularBleeding { m_sHitZoneName "RArm" }` — bleed a specific hit zone

### Condition: SCR_ScenarioFrameworkMedicalCondition

Checks player medical state. Used inside `SCR_ScenarioFrameworkActionBasedOnConditions.m_aActivationConditions`.

| Property | Description |
|---|---|
| `m_Getter` | `SCR_ScenarioFrameworkGetPlayerEntity {}` |
| `m_aRequiredMedicalConditions` | Array of specific medical sub-conditions |

Medical sub-conditions seen:

| Class | Properties | What it checks |
|---|---|---|
| `SCR_ScenarioFrameworkMedicalConditionBleeding` | (none) | Player is bleeding anywhere |
| `SCR_ScenarioFrameworkMedicalConditionHealth` | `m_fHealthMinimum`, `m_fHealthMaximum` | Overall health in range. `m_bUseDefaultHealth 0` + `m_aHitZoneNames {"Blood"}` = blood level |
| `SCR_ScenarioFrameworkMedicalConditionTourniquet` | (none) | Player has a tourniquet applied |

Blood level check example (below 75%):
```
SCR_ScenarioFrameworkMedicalConditionHealth {
  m_fHealthMaximum 0.75
  m_bUseDefaultHealth 0
  m_aHitZoneNames { "Blood" }
}
```

### Condition: SCR_ScenarioFrameworkADSCondition

Checks whether the player is NOT aiming down sights. No extra properties — just the getter.

```
SCR_ScenarioFrameworkADSCondition {
  m_Getter SCR_ScenarioFrameworkGetPlayerEntity {}
}
```

### Getters

| Class | Properties | Returns |
|---|---|---|
| `SCR_ScenarioFrameworkGetEntityByName` | `m_sEntityName` | Named world entity |
| `SCR_ScenarioFrameworkGetLayerBase` | `m_sLayerBaseName` | Named Layer entity |
| `SCR_ScenarioFrameworkGetSpawnedEntity` | `m_sLayerName` | Entity spawned by a named Slot |
| `SCR_ScenarioFrameworkGetPlayerEntity` | (none) | Local player character |

---

## Sample: SF-Sample-DeliverWeaponsInVehicle

Demonstrates delivering items that are inside a vehicle to a trigger zone. Uses inventory counting
to complete the task only when the correct number of weapons are present.

### Hierarchy

```
Area1 (Area.et)
  LayerTask1 (LayerTask.et)        — owns the task, cleans up on finish
    SlotTask1 (SlotTask.et)        — task title/description
  Layer1 (Layer.et)                — spawns vehicle + delivery trigger
    Slot1 (Slot.et)                — spawns M1025 Humvee, adds 10x M16A2 to its inventory
    SlotTrigger1 (SlotTrigger.et)  — delivery zone, fires when vehicle with weapons enters
```

### Key pattern: Spawn vehicle then populate its inventory

`Slot1` spawns the vehicle via `m_sObjectToSpawn`, then immediately runs an `m_aActivationActions`
action to add items into that same spawned entity's inventory:

```
SCR_ScenarioFrameworkSlotBase {
  m_sObjectToSpawn "{4A71F755A4513227}Prefabs/Vehicles/Wheeled/M998/M1025.et"
  m_aActivationActions {
    SCR_ScenarioFrameworkActionAddItemToInventory {
      m_Getter SCR_ScenarioFrameworkGetSpawnedEntity { m_sLayerName "Slot1" }
      m_aPrefabFilter {
        SCR_ScenarioFrameworkPrefabFilterCountNoInheritance {
          m_sPrefabName "{3E413771E1834D2F}Prefabs/Weapons/Rifles/M16/Rifle_M16A2.et"
          m_iPrefabCount 10
        }
      }
    }
  }
}
```

Note: uses `SCR_ScenarioFrameworkPrefabFilterCountNoInheritance` (not `FilterCount`) when adding —
exact prefab match, no inheritance check.

### Key pattern: Vehicle-filtered trigger zone

`SlotTrigger1` uses `SCR_ScenarioFrameworkPluginTrigger` with a prefab filter so only the specific
vehicle type activates the trigger:

```
SCR_ScenarioFrameworkSlotTrigger {
  m_aPlugins {
    SCR_ScenarioFrameworkPluginTrigger {
      m_fAreaRadius 10
      m_aPrefabFilter {
        SCR_ScenarioFrameworkPrefabFilter {
          m_sSpecificPrefabName "{4A71F755A4513227}Prefabs/Vehicles/Wheeled/M998/M1025.et"
        }
      }
    }
  }
  m_aTriggerActions {
    SCR_ScenarioFrameworkActionCountInventoryItemsAndExecuteAction { ... }
  }
}
```

### Action: SCR_ScenarioFrameworkActionAddItemToInventory

Adds items to an entity's inventory on slot activation.

| Property | Description |
|---|---|
| `m_Getter` | Target entity (e.g. the spawned vehicle via `SCR_ScenarioFrameworkGetSpawnedEntity`) |
| `m_aPrefabFilter` | Which prefab and how many to add |

### Action: SCR_ScenarioFrameworkActionRemoveItemFromInventory

Removes items from an entity's inventory. Used in `m_aTriggerActionsOnFinish` on `LayerTask` to
clean up weapons after task completes.

| Property | Description |
|---|---|
| `m_Getter` | Target entity |
| `m_aPrefabFilter` | Which prefab and how many to remove |

### Action: SCR_ScenarioFrameworkActionCountInventoryItemsAndExecuteAction

Checks whether an entity's inventory contains the required items, then runs sub-actions if true.
Used in trigger actions to gate task completion on item count.

| Property | Description |
|---|---|
| `m_Getter` | Entity whose inventory to check |
| `m_aPrefabFilter` | Required prefab + count (`SCR_ScenarioFrameworkPrefabFilterCount`) |
| `m_aActionsToExecute` | Actions to run if count is satisfied |

### Action: SCR_ScenarioFrameworkActionChangeTaskState

Advances (completes) a task. Typically `m_iMaxNumberOfActivations 1` to fire only once.

| Property | Description |
|---|---|
| `m_Getter` | `SCR_ScenarioFrameworkGetTask { m_sLayerTaskName "LayerTask1" }` |
| `m_iMaxNumberOfActivations` | 1 = complete once only |

### Prefab filters

| Class | Properties | Use |
|---|---|---|
| `SCR_ScenarioFrameworkPrefabFilter` | `m_sSpecificPrefabName` | Trigger activation filter (which entity type enters zone) |
| `SCR_ScenarioFrameworkPrefabFilterCount` | `m_sSpecificPrefabName`, `m_iPrefabCount` | Count check (inventory counting / remove) |
| `SCR_ScenarioFrameworkPrefabFilterCountNoInheritance` | `m_sPrefabName`, `m_iPrefabCount` | Add items — exact match, no subclass inheritance |

### SlotTask: task title/description

`SlotTask.et` (`SCR_ScenarioFrameworkSlotTask`) is a child of `LayerTask` and carries the display
strings only. No logic — just `m_sTaskTitle` and `m_sTaskDescription`.

### LayerTask: cleanup on finish

`SCR_ScenarioFrameworkLayerTask.m_aTriggerActionsOnFinish` fires when the task completes. Use it
to remove spawned items/entities that are no longer needed.

### Getter: SCR_ScenarioFrameworkGetTask

Retrieves a task by its LayerTask name. Used to drive `SCR_ScenarioFrameworkActionChangeTaskState`.

```
SCR_ScenarioFrameworkGetTask { m_sLayerTaskName "LayerTask1" }
```

---

## Sample: SF-Sample-DeliverWeaponsToCrate

Demonstrates delivering weapons by carrying them to a crate. Uses `SCR_ScenarioFrameworkPluginOnInventoryChange`
to detect when items are placed in the crate, and a `SlotMoveTo` to mark the destination on the map.

### Hierarchy

```
Area1 (Area.et)
  LayerTaskMove1 (LayerTaskMove.et)     — owns the task, cleans up M16s on finish
    SlotMoveTo1 (SlotMoveTo.et)         — destination marker + trigger, task title/desc with dynamic %1
  Layer1 (Layer.et)
    Slot1 (Slot.et)                     — references existing world crate, monitors inventory changes
```

### Key pattern: Monitor inventory changes on a crate

`Slot1` uses `m_bUseExistingWorldAsset 1` to reference an already-placed world entity (the crate)
instead of spawning a new one. It attaches a plugin to watch for inventory changes:

```
SCR_ScenarioFrameworkSlotBase {
  m_sObjectToSpawn "{377EB906F591E4BA}...AmmoBoxArsenal_Weapons_US.et"
  m_bUseExistingWorldAsset 1
  m_aPlugins {
    SCR_ScenarioFrameworkPluginOnInventoryChange {
      m_aActionsOnItemAdded {
        SCR_ScenarioFrameworkActionCountInventoryItemsAndExecuteAction {
          m_Getter SCR_ScenarioFrameworkGetSpawnedEntity { m_sLayerName "Slot1" }
          m_aPrefabFilter {
            SCR_ScenarioFrameworkPrefabFilterCount {
              m_sSpecificPrefabName "{1353C6EAD1DCFE43}...Handgun_M9.et"
              m_iPrefabCount 5
            }
          }
          m_aActionsToExecute {
            SCR_ScenarioFrameworkActionChangeTaskState { m_iMaxNumberOfActivations 1 }
            SCR_ScenarioFrameworkActionRemoveItemFromInventory { m_iMaxNumberOfActivations 1 }
          }
        }
      }
    }
  }
}
```

### Plugin: SCR_ScenarioFrameworkPluginOnInventoryChange

Attached to a `Slot` — fires actions when items are added/removed from the spawned entity's inventory.

| Property | Description |
|---|---|
| `m_aActionsOnItemAdded` | Actions fired when any item is added |
| `m_aActionsOnItemRemoved` | Actions fired when any item is removed |

### Key pattern: SlotMoveTo with custom trigger condition

`SlotMoveTo` spawns `ScenarioFrameworkCharacterTrigger.et` (`{47D49EA6A216CFD5}`) and uses
`SCR_ScenarioFrameworkPluginTrigger` with `m_eActivationPresence SPECIFIC_PREFAB_NAME` plus
`SCR_CustomTriggerConditionsSpecificPrefabCount` to fire only when a character carrying enough
items of a specific prefab enters the zone:

```
SCR_ScenarioFrameworkPluginTrigger {
  m_eActivationPresence SPECIFIC_PREFAB_NAME
  m_aCustomTriggerConditions {
    SCR_CustomTriggerConditionsSpecificPrefabCount {
      m_aPrefabFilter {
        SCR_ScenarioFrameworkPrefabFilterCount {
          m_sSpecificPrefabName "..."
          m_iPrefabCount 10
        }
      }
    }
  }
}
```

### Key pattern: Dynamic task description with %1 placeholder

Use `%1` in `m_sTaskDescription` and populate it at spawn time via `m_aActionsOnCreated`:

```
SCR_ScenarioFrameworkSlotExtraction {
  m_sTaskTitle "Deliver Weapons"
  m_sTaskDescription "Deliver %1 to the weapons crate"
  m_aActionsOnCreated {
    SCR_ScenarioFrameworkActionFeedParamToTaskDescription {
      m_aPrefabFilter {
        SCR_ScenarioFrameworkPrefabFilterCount {
          m_sSpecificPrefabName "{1353C6EAD1DCFE43}...Handgun_M9.et"
          m_iPrefabCount 5
        }
      }
    }
  }
}
```

The action reads the prefab name + count from the filter and formats it into the `%1` token.

### LayerTaskMove vs LayerTask

`LayerTaskMove.et` (`SCR_ScenarioFrameworkLayerTaskMove`) — use instead of `LayerTask` when
the task destination should appear on the map. Places a marker on the `SlotMoveTo` child automatically.

### m_bUseExistingWorldAsset

Set `m_bUseExistingWorldAsset 1` on a Slot when the target entity is already placed in the world
editor. `m_sObjectToSpawn` still names the prefab for identification. The slot registers the
existing entity and attaches its plugins/actions to it.

### WeaponsCrate prefab notes

`AmmoBoxArsenal_Weapons_US.et` has `SCR_ArsenalComponent` and `SCR_ResupplySupportStationComponent`
both `Enabled 0` when used as a delivery crate — disables resupply behaviour, keeps it as plain storage.

---

## Sample: SF-Sample-DetectPrefabInTrigger

Demonstrates detecting multiple specific prefab types simultaneously inside a trigger zone.
Uses `SCR_CustomTriggerConditionsSpecificPrefabCount` with multiple filters in one condition,
plus `m_bIncludeChildren` to match prefab variants/subclasses.

### Hierarchy

```
Area1 (Area.et)
  LayerTaskMove1 (LayerTaskMove.et)   — no cleanup actions
    SlotMoveTo1 (SlotMoveTo.et)       — requires 2x Ural AND 3x UAZ simultaneously in zone
  Layer1 (Layer.et)
    Slot1  — Ural4320 base
    Slot2  — Ural4320_ammo (child variant)
    Slot4/5/6 — UAZ469 x3
```

### Key pattern: Multiple prefab filters in one condition (AND logic)

Multiple `SCR_ScenarioFrameworkPrefabFilterCount` entries inside one
`SCR_CustomTriggerConditionsSpecificPrefabCount` — ALL must be satisfied simultaneously:

```
SCR_CustomTriggerConditionsSpecificPrefabCount {
  m_aPrefabFilter {
    SCR_ScenarioFrameworkPrefabFilterCount {
      m_sSpecificPrefabName "{4597626AF36C0858}Prefabs/Vehicles/Wheeled/Ural4320/Ural4320.et"
      m_bIncludeChildren 1
      m_iPrefabCount 2
    }
    SCR_ScenarioFrameworkPrefabFilterCount {
      m_sSpecificPrefabName "{259EE7B78C51B624}Prefabs/Vehicles/Wheeled/UAZ469/UAZ469.et"
      m_iPrefabCount 3
    }
  }
}
```

### m_bIncludeChildren on PrefabFilterCount

Set to `1` to match the named prefab AND any prefabs that inherit from it (e.g. `Ural4320_ammo.et`
counts toward the `Ural4320.et` filter). Without it, only exact prefab matches count.

### m_aActionsOnProgress on SlotMoveTo / SlotExtraction

Fires actions each time the trigger checks progress (partial count update). Used to show a hint:

```
m_aActionsOnProgress {
  SCR_ScenarioFrameworkActionShowHint {}
}
```

### Action: SCR_ScenarioFrameworkActionShowHint

Shows an in-game hint/notification to the player. No required properties in basic use.

### Grouping multiple Slots in a Layer ($grp)

When a Layer contains multiple Slots of the same base prefab they can share a `$grp` block
in the serialised `.et` file — functionally identical to listing them separately:

```
$grp GenericEntity : "{AA01691FDC4E9167}Prefabs/Systems/ScenarioFramework/Components/Slot.et" {
  Slot4 { ... }
  Slot5 { ... }
  Slot6 { ... }
}
```

---

## Sample: SF-Sample-DynamicDespawn

Demonstrates dynamic despawning — entities are automatically removed when no player is within
range, saving performance. Also shows `RANDOM_ONE` child selection on both Layer and LayerTaskDestroy.

### Hierarchy

```
Area_1 (Area.et)   m_bDynamicDespawn 1, m_iDynamicDespawnRange 30, m_fAreaRadius 5
  LayerTaskDestroy_1 (LayerTaskDestroy.et)   m_SpawnChildren RANDOM_ONE
    Layer1  →  SlotDestroy_1 (Ural4320 base)
    Layer2  →  SlotDestroy1  (Ural4320_ammo variant)
  RandomFlag (Layer.et)   m_SpawnChildren RANDOM_ONE
    Slot_1  (USSR flag)
    Slot_2  (US flag)
    Slot_3  (FIA flag)
  Layer3 (Layer.et)   m_bDynamicDespawn 1, m_iDynamicDespawnRange 30
    Slot1   (AntennaAirport static prop)
  AI (unnamed Layer)
    LargeGroup01-04  (Group_US_RifleSquad x4)
    SlotAI_Rifleman1/2  (Character_US_Rifleman x2)
    SlotAI_Group  (Group_US_FireTeam)
```

### Dynamic despawn properties

Set on `SCR_ScenarioFrameworkArea` or `SCR_ScenarioFrameworkLayerBase`:

| Property | Description |
|---|---|
| `m_bDynamicDespawn` | `1` = enable dynamic despawn for this node and its children |
| `m_iDynamicDespawnRange` | Metres — despawn when no player is within this range (30 in sample) |

Can be set at Area level (affects all children) or per-Layer (fine-grained). In this sample
`m_fAreaRadius 5` is also set on the Area — this is the area trigger radius, separate from despawn range.

### m_SpawnChildren RANDOM_ONE

Set on `SCR_ScenarioFrameworkLayerBase` (or LayerTask variants) to spawn exactly one randomly
chosen child instead of all children. Useful for randomising destroy targets or decoration.

### LayerTaskDestroy with RANDOM_ONE

Each child Layer contains a different `SlotDestroy` variant. `RANDOM_ONE` picks one per mission:

```
SCR_ScenarioFrameworkLayerTaskDestroy {
  m_SpawnChildren RANDOM_ONE
  m_sTaskTitle "#AR-CombatScenario_DestroyTask_B_Title"
  m_sTaskDescription "#AR-CombatScenario_DestroyTask_B_Description"
}
```

### SlotAI — individual characters vs groups

`SCR_ScenarioFrameworkSlotAI.m_sObjectToSpawn` accepts either:
- A **group prefab** (`Group_US_RifleSquad.et`, `Group_US_FireTeam.et`) — spawns full group
- A **character prefab** (`Character_US_Rifleman.et`) — spawns single soldier

Same `SlotAI.et` component for both — the prefab path determines the result.

### Localisation keys in task strings

Task title/description support `#`-prefixed localisation keys from the base game string table:
```
m_sTaskTitle "#AR-CombatScenario_DestroyTask_B_Title"
```
Custom mods use their own string table keys or plain text strings.

---

## Sample: SF-Sample-EndScreenBasedOnCompletedTasks

Demonstrates showing different end screens based on how many tasks were completed.
Uses `SCR_ScenarioFrameworkLogicCounter` + `SCR_ScenarioFrameworkActionInputOnTaskEventIncreaseCounter`
to count task completions, then selects end screen type via compare actions.

### Hierarchy (4 separate Area prefabs + LogicCounter child)

```
Extraction.et (Area, m_iRandomPercent 100)
  TaskExtraction_A (LayerTaskMove)  — m_aTriggerActionsOnFinish: EndMission
    ext_A (Layer)
      SlotDelivery_1  — m_aAssociatedTaskLayers "D_Documents", radius 15, m_bOnce 0
      SlotExtraction_1  — PLAYER trigger, countdown 10s, notification
      Slot_1  — US flag
  endScreenCounter (LogicCounter)  — m_iCountTo 4, child of Area entity

Documents.et (Area)
  D_Documents / D_Documents2 (LayerTaskDeliver x2, $grp)
    SlotPick1/2 — IntelligenceFolder, staged task title updates

Kill.et (Area, m_fAreaRadius 5)
  LayerTaskKill1 → Layer4 → SlotKill1 (Character_USSR_Unarmed)

Move.et (Area)
  LayerTaskMove1 → SlotMoveTo1 (PLAYER trigger)
```

### Key pattern: LogicCounter counts task completions → end screen

`SCR_ScenarioFrameworkLogicCounter` placed as a child entity of an Area. Input action
`SCR_ScenarioFrameworkActionInputOnTaskEventIncreaseCounter` fires automatically on every task completion:

```
SCR_ScenarioFrameworkLogicCounter {
  m_aInputs {
    SCR_ScenarioFrameworkLogicInput {
      m_InputAction SCR_ScenarioFrameworkActionInputOnTaskEventIncreaseCounter {}
    }
  }
  m_iCountTo 4
  m_aOnIncreaseActions {
    SCR_ScenarioFrameworkActionCompareCounterAndExecute {
      m_eComparisonOperator EQUAL
      m_iValue 1
      m_aActions { SCR_ScenarioFrameworkActionSetMissionEndScreen { m_eGameOverType COMBATPATROL_DRAW } }
    }
    SCR_ScenarioFrameworkActionCompareCounterAndExecute {
      m_eComparisonOperator EQUAL
      m_iValue 2
      m_aActions { SCR_ScenarioFrameworkActionSetMissionEndScreen { m_eGameOverType COMBATPATROL_PARTIAL_SUCCESS } }
    }
    SCR_ScenarioFrameworkActionCompareCounterAndExecute {
      m_eComparisonOperator GREATER_OR_EQUAL
      m_iValue 3
      m_aActions { SCR_ScenarioFrameworkActionSetMissionEndScreen { m_eGameOverType COMBATPATROL_VICTORY } }
    }
  }
}
```

### Action: SCR_ScenarioFrameworkActionInputOnTaskEventIncreaseCounter

Placed in `SCR_ScenarioFrameworkLogicInput.m_InputAction`. Auto-increments parent LogicCounter
on every task completion. No properties needed.

### Action: SCR_ScenarioFrameworkActionCompareCounterAndExecute

| Property | Description |
|---|---|
| `m_eComparisonOperator` | `EQUAL`, `GREATER_OR_EQUAL`, `LESS_OR_EQUAL` |
| `m_iValue` | Value to compare against current counter |
| `m_aActions` | Actions to run if true |

### Action: SCR_ScenarioFrameworkActionSetMissionEndScreen

| Property | Description |
|---|---|
| `m_eGameOverType` | `COMBATPATROL_VICTORY`, `COMBATPATROL_PARTIAL_SUCCESS`, `COMBATPATROL_DRAW` |

### Action: SCR_ScenarioFrameworkActionEndMission

Ends the mission immediately. No properties. Used in `m_aTriggerActionsOnFinish` (extraction
completes = mission end) and in `m_aActionsOnProgress` on SlotPick as a failsafe.

### Action: SCR_ScenarioFrameworkActionIncrementCounter

Manually increments a named LogicCounter from any action context.

| Property | Description |
|---|---|
| `m_sCounterName` | Name of the LogicCounter entity to increment |

### Action: SCR_ScenarioFrameworkActionPlaySound

| Property | Description |
|---|---|
| `m_sSound` | Sound event name (e.g. `"SOUND_CPTEC"`) |

### SlotExtraction trigger plugin: countdown + notification

| Property | Description |
|---|---|
| `m_fActivationCountdownTimer` | Seconds player must stay in zone before trigger fires (10 in sample) |
| `m_bNotificationEnabled` | `1` = show UI notification when countdown starts |
| `m_sPlayerActivationNotificationTitle` | Notification text / localisation key |

### SlotDelivery: m_aAssociatedTaskLayers

Links a delivery zone to a named `LayerTaskDeliver` entity:
```
m_aAssociatedTaskLayers { "D_Documents" }
```

### LayerTaskDeliver: staged task description updates

| Property | Description |
|---|---|
| `m_sTaskTitle` / `m_sTaskDescription` | Before item picked up |
| `m_sTaskTitleUpdated` / `m_sTaskDescriptionUpdated` | After item picked up |

SlotPick also has `m_sTaskTitleUpdated1/2` and `m_sTaskDescriptionUpdated1/2` for additional stages.

### m_iRandomPercent

Probability (0–100) that this node spawns. `100` = always spawn. Lower values = probabilistic.
Set on Area, Layer, and Slot independently.

---

## Sample: SF-Sample-FactionSwitchedObject

Demonstrates spawning different prefabs depending on which faction is active.
`m_aFactionSwitchedObjects` provides per-faction overrides for `m_sObjectToSpawn`.

### Hierarchy

```
Area1 (Area.et)   m_sFactionKey "Invaders"
  LayerTaskKill1 (LayerTaskKill)
    SlotKill1 (SlotKill)   m_sFactionKey "Defenders"
                            m_sObjectToSpawn = CIV ConstructionWorker (fallback)
                            m_aFactionSwitchedObjects: FIA / USSR / US overrides
```

### Key pattern: m_aFactionSwitchedObjects

Array of `SCR_ScenarioFrameworkFactionSwitchedObject` on any Slot. At spawn time the framework
checks the active faction key and uses the matching override instead of `m_sObjectToSpawn`.
If no match, the default `m_sObjectToSpawn` is the fallback.

```
SCR_ScenarioFrameworkSlotKill {
  m_sFactionKey "Defenders"
  m_sObjectToSpawn "{6F5A71...}Character_CIV_ConstructionWorker_1.et"  // fallback
  m_aFactionSwitchedObjects {
    SCR_ScenarioFrameworkFactionSwitchedObject { m_sFactionKey "FIA"  m_sObjectToSpawn "{854C04...}Character_FIA_Unarmed.et" }
    SCR_ScenarioFrameworkFactionSwitchedObject { m_sFactionKey "USSR" m_sObjectToSpawn "{98EB9C...}Character_USSR_Unarmed.et" }
    SCR_ScenarioFrameworkFactionSwitchedObject { m_sFactionKey "US"   m_sObjectToSpawn "{2F912E...}Character_US_Unarmed.et" }
  }
}
```

### m_sFactionKey on Area vs Slot

- On `SCR_ScenarioFrameworkArea` — sets faction context for the whole area and children.
- On a Slot — overrides faction for that slot's spawn selection only.
- Slot key takes priority over Area key for that slot.

### Faction key strings seen

`"US"`, `"USSR"`, `"FIA"`, `"Invaders"`, `"Defenders"` — must match keys defined in the
FactionManager configuration of the game mode.

---

## Sample: SF-Sample-FinishTaskToCreateTask

Demonstrates task chaining — completing one task spawns the next.
Uses `SCR_ScenarioFrameworkLogicCounter` with `m_sTaskLayerName` to watch a specific task,
then calls `SCR_ScenarioFrameworkActionSpawnObjects` to activate the next LayerTask.

### Hierarchy (3 separate Area prefabs)

```
Area_A  — active on init
  Move1 (LayerTaskMove)   ON_INIT (default)
    SlotMoveTo1 — PLAYER trigger
  SpawnTasksCounterB (LogicCounter) — watches Move1, spawns Move2

Area_B
  Move2 (LayerTaskMove)   ON_TRIGGER_ACTIVATION — waits to be spawned
    SlotMoveTo2 — PLAYER trigger
  SpawnTasksCounterC (LogicCounter) — watches Move2, spawns Move3

Area_C
  Move3 (LayerTaskMove)   ON_TRIGGER_ACTIVATION — waits to be spawned
    SlotMoveTo3 — PLAYER trigger
```

### Key pattern: Task chaining via LogicCounter + SpawnObjects

LogicCounter is a sibling of the LayerTask inside the Area. `m_sTaskLayerName` filters
so it only fires when that specific task completes:

```
SCR_ScenarioFrameworkLogicCounter {
  m_aInputs {
    SCR_ScenarioFrameworkLogicInput {
      m_InputAction SCR_ScenarioFrameworkActionInputOnTaskEventIncreaseCounter {
        m_sTaskLayerName "Move1"    // only fires when Move1 completes
      }
    }
  }
  m_aActions {
    SCR_ScenarioFrameworkActionSpawnObjects {
      m_aNameOfObjectsToSpawnOnActivation { "Move2" }
    }
  }
}
```

`m_iCountTo` is NOT set — defaults to 1, fires immediately on first completion.

### m_sTaskLayerName on ActionInputOnTaskEventIncreaseCounter

Filters the task event to a specific named LayerTask. Without it, any task completion
increments the counter (as in EndScreen sample). With it, only the named task triggers it.

### ON_TRIGGER_ACTIVATION on LayerTask

Tasks with `m_eActivationType ON_TRIGGER_ACTIVATION` do NOT start on mission init.
They wait until `SCR_ScenarioFrameworkActionSpawnObjects` is called with their entity name.

### LogicCounter: m_aActions vs m_aOnIncreaseActions

| Property | When it fires |
|---|---|
| `m_aActions` | When counter reaches `m_iCountTo` (use for simple "fire once" chaining) |
| `m_aOnIncreaseActions` | On every increment — use with `CompareCounterAndExecute` for branching |

---

## Sample: SF-Sample-GenericTask

Demonstrates a generic/custom task completed by interacting with a named world entity.
Uses `SCR_ScenarioFrameworkActionOnUserActionEvent` on a SlotTask to watch for a player
interaction, shows a hint, completes the task, then ends the mission after a delay.

### Hierarchy

```
Area1 (Area.et)
  LayerTask1 (LayerTask.et)   m_bPlaceMarkerOnSubjectSlot 1
    SlotTask1 (SlotTask.et)   task title/desc, activation action on toilet interact
namedToilet — plain world entity (Toilet_01.et), referenced by name
```

### Key pattern: SlotTask with UserAction on an existing world entity

`SlotTask` is not just a title holder — it can carry `m_aActivationActions` that run when
the slot activates. Here it watches a named world entity for a user interaction:

```
SCR_ScenarioFrameworkSlotTask {
  m_sTaskTitle "Flush the toilet"
  m_sTaskDescription "Not everyone has the capacity to do it."
  m_aActivationActions {
    SCR_ScenarioFrameworkActionOnUserActionEvent {
      m_Getter SCR_ScenarioFrameworkGetEntityByName { m_sEntityName "namedToilet" }
      m_aActions {
        SCR_ScenarioFrameworkActionShowHint { m_iMaxNumberOfActivations 1  m_sTitle "..."  m_sText "..."  m_iTimeout 2 }
        SCR_ScenarioFrameworkActionChangeTaskState {
          m_Getter SCR_ScenarioFrameworkGetTask { m_sLayerTaskName "LayerTask1" }
        }
      }
    }
  }
  m_aActionsOnFinished {
    SCR_ScenarioFrameworkActionWaitAndExecute {
      m_iDelayInSeconds 2
      m_aActions {
        SCR_ScenarioFrameworkActionEndMission { m_eOverriddenGameOverType VICTORY }
      }
    }
  }
}
```

### Action: SCR_ScenarioFrameworkActionShowHint (with properties)

Full properties when used with custom text:

| Property | Description |
|---|---|
| `m_sTitle` | Hint title text |
| `m_sText` | Hint body text |
| `m_iTimeout` | Seconds before hint auto-dismisses (2 in sample) |
| `m_iMaxNumberOfActivations` | 1 = show only once |

### Action: SCR_ScenarioFrameworkActionWaitAndExecute

Delays execution of child actions by a set time.

| Property | Description |
|---|---|
| `m_iDelayInSeconds` | Minimum delay in seconds |
| `m_iDelayInSecondsMax` | Maximum delay (0 = exact, no randomness) |
| `m_aActions` | Actions to run after delay |

### Action: SCR_ScenarioFrameworkActionEndMission (with game over type)

| Property | Description |
|---|---|
| `m_eOverriddenGameOverType` | `VICTORY`, `DEFEAT`, etc. — overrides default end screen type |

Note: in EndScreen sample this was used without properties (just ends mission). Here
`m_eOverriddenGameOverType VICTORY` explicitly sets the win state.

### SlotTask: m_aActionsOnFinished

Fires when the task associated with this SlotTask is marked complete. Use for post-task
cleanup, delays, end mission triggers, etc.

### LayerTask: m_bPlaceMarkerOnSubjectSlot

Setting `m_bPlaceMarkerOnSubjectSlot 1` on `LayerTask` places a map marker at the SlotTask
position. Normally used on `LayerTaskMove` but works on plain `LayerTask` too.

### namedToilet — referencing a plain world entity by name

The toilet is a plain `GenericEntity` placed in the world with no SF components. The SF system
finds it purely by entity name via `SCR_ScenarioFrameworkGetEntityByName`. Any world entity
with a name can be used as an interaction target this way — no SF prefab required.

---

## Sample: SF-Sample-MortarStrike

Demonstrates scripted AI behaviour using SF waypoints — AI gets into a mortar vehicle, then
fires an artillery support waypoint at a target position. Uses `SCR_ScenarioFrameworkActionAI`
with chained waypoint callbacks.

### Hierarchy

```
Area1 (Area.et)
  Layer1 (Layer.et)
    SlotAI1 (SlotAI.et)   — spawns US Rifleman, assigned AI actions on activation
    GetInMortar (SlotWaypoint.et)   — waypoint: GetInNearest
    TargetPosition (SlotWaypoint.et) — waypoint: ArtillerySupport, m_iTargetShotCount 4
```

### Key pattern: SCR_ScenarioFrameworkActionAI with chained waypoints

`SCR_ScenarioFrameworkActionAI` is placed in `m_aActivationActions` on a `SlotAI`. It assigns
waypoints to the spawned AI group. Waypoints are referenced by `SlotWaypoint` entity names via
`SCR_ScenarioFrameworkGetLayerBase`:

```
SCR_ScenarioFrameworkActionAI {
  m_aAIActions {
    SCR_ScenarioFrameworkAIAddWaypoint {
      m_Getter SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "GetInMortar" }
      m_bAddOnTopOfQueue 1
      m_bClearPreviousWaypoints 1
    }
    SCR_ScenarioFrameworkAIActionOnWaypointCompleted {
      m_Getter SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "GetInMortar" }
      m_aActionsOnWaypointCompleted {
        SCR_ScenarioFrameworkActionAI {
          m_aAIActions {
            SCR_ScenarioFrameworkAIAddWaypoint {
              m_Getter SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "TargetPosition" }
            }
          }
        }
      }
    }
  }
}
```

### AI action: SCR_ScenarioFrameworkAIAddWaypoint

Assigns a waypoint from a `SlotWaypoint` to the AI group.

| Property | Description |
|---|---|
| `m_Getter` | Points to the `SlotWaypoint` entity via `GetLayerBase` |
| `m_bAddOnTopOfQueue` | `1` = insert at front of waypoint queue |
| `m_bClearPreviousWaypoints` | `1` = clear existing waypoints first |

### AI action: SCR_ScenarioFrameworkAIActionOnWaypointCompleted

Listens for a specific waypoint to be completed, then fires `m_aActionsOnWaypointCompleted`.
Used to chain sequential waypoints without timers.

| Property | Description |
|---|---|
| `m_Getter` | The `SlotWaypoint` to watch |
| `m_aActionsOnWaypointCompleted` | Actions to run when that waypoint is done |

### SlotWaypoint waypoint types

`SCR_ScenarioFrameworkSlotWaypoint.m_Waypoint` holds the waypoint behaviour object:

| Class | Properties | Behaviour |
|---|---|---|
| `SCR_ScenarioFrameworkWaypointGetInNearest` | (none) | AI gets into the nearest vehicle |
| `SCR_ScenarioFrameworkWaypointArtillerySupport` | `m_iTargetShotCount` | AI fires artillery at the slot position N times |
| `SCR_ScenarioFrameworkWaypointPatrol` | (none) | Move to slot position (patrol point) |
| `SCR_ScenarioFrameworkWaypointCycle` | (none) | Loop back to start of waypoint list |

### SlotWaypoint as position marker

`SlotWaypoint` entities double as world-space position markers. Their `coords` in the `.et` file
is the waypoint destination. `TargetPosition` is placed at coords `42.203 -0.706 191.327` —
that is where the mortar rounds will land.

---

## Sample: SF-Sample-PatrollingGroup

Demonstrates a looping patrol using `m_WaypointSet` on `SlotAI` combined with `SlotWaypoint`
patrol points and a `WaypointCycle` to loop indefinitely.

### Hierarchy

```
Area_A (Area.et)
  AI_group (Layer)
    Patrol1 (Layer)
      SlotAI1 (SlotAI)   — Group_US_SentryTeam, m_WaypointSet pointing to "CycleWaypoint", m_bSpawnAIOnWPPos 1
  Patrol_Waypoints (Layer)
    SlotWaypoint1  — WaypointPatrol (point 1)
    SlotWaypoint2  — WaypointPatrol (point 2)
    SlotWaypoint3  — WaypointPatrol (point 3)
    CycleWaypoint  — WaypointCycle  (loop back)
```

### Key pattern: m_WaypointSet on SlotAI

Instead of assigning waypoints via `SCR_ScenarioFrameworkActionAI` at activation, set
`m_WaypointSet` directly on the SlotAI component to pre-wire a waypoint set at design time:

```
SCR_ScenarioFrameworkSlotAI {
  m_sObjectToSpawn "{3BF36BDEEB33AEC9}Prefabs/Groups/BLUFOR/Group_US_SentryTeam.et"
  m_WaypointSet SCR_ScenarioFrameworkWaypointSet {
    m_aLayerName {
      "CycleWaypoint"    // name of the SlotWaypoint that starts/anchors the set
    }
  }
  m_bSpawnAIOnWPPos 1   // spawn AI at the first waypoint position rather than slot position
}
```

### m_bSpawnAIOnWPPos

When `1`, the AI group spawns at the position of the first waypoint in the set rather than at
the `SlotAI` entity position. Useful when the SlotAI is placed for organisational purposes
but the patrol should start at a specific map location.

### Looping patrol with WaypointCycle

Place `SlotWaypoint` entities with `WaypointPatrol` for each patrol point, then add one
`SlotWaypoint` with `WaypointCycle` at the end. The AI walks patrol points in order, then
the Cycle waypoint resets back to the first waypoint, creating an infinite loop.

Order is determined by the sequence the waypoints appear in the `m_WaypointSet.m_aLayerName`
list OR by the order they are serialised in the Layer. The `CycleWaypoint` must be last.

### SlotWaypoint waypoint order

Waypoints are executed in the order they appear as children of the parent Layer (serialisation
order in the `.et` file). Place `WaypointCycle` as the final child to close the loop.

---

## Sample: SF-Sample-RepeatedTask

Demonstrates a task that automatically resets and re-spawns after completion, creating an
infinite repeating task loop. Uses `SCR_ScenarioFrameworkActionRestoreLayerToDefault` with
`m_bReinitAfterRestoration 1` in `m_aTriggerActionsOnFinish` after a short delay.

### Hierarchy

```
Area1 (Area.et)   m_fAreaRadius 75
  LayerTaskKill1 (LayerTaskKill)
    SlotKill1 (SlotKill)   Character_USSR_Unarmed, m_sWPToSpawn AIWaypoint_Wait.et
```

### Key pattern: Self-resetting task

`m_aTriggerActionsOnFinish` on the LayerTask resets itself after a 2-second delay:

```
SCR_ScenarioFrameworkLayerTaskKill {
  m_aTriggerActionsOnFinish {
    SCR_ScenarioFrameworkActionWaitAndExecute {
      m_iDelayInSeconds 2
      m_iDelayInSecondsMax 0
      m_aActions {
        SCR_ScenarioFrameworkActionRestoreLayerToDefault {
          m_Getter SCR_ScenarioFrameworkGetLayerBase { m_sLayerBaseName "LayerTaskKill1" }
          m_bReinitAfterRestoration 1
        }
      }
    }
  }
}
```

The layer restores to its default (despawned) state, then `m_bReinitAfterRestoration 1`
immediately re-initialises it — spawning a new AI target and creating a new task. This repeats
indefinitely each time the task is completed.

### SlotKill: m_sWPToSpawn

Sets the waypoint assigned to the kill target AI. `AIWaypoint_Wait.et` makes the target stand
still instead of moving around, making it easier to find.

```
SCR_ScenarioFrameworkSlotKill {
  m_sObjectToSpawn "{98EB9CDD85B8C92C}...Character_USSR_Unarmed.et"
  m_sWPToSpawn "{531EC45063C1F57B}Prefabs/AI/Waypoints/AIWaypoint_Wait.et"
}
```

Waypoint prefab GUIDs:
- `AIWaypoint_Wait.et` — `{531EC45063C1F57B}`
- `AIWaypoint_Defend.et` — default for SlotKill if `m_sWPToSpawn` not set

---

## Sample: SF-Sample-SafeSpawning

Demonstrates that `SCR_ScenarioFrameworkSlotAI` has built-in safe spawning — it automatically
finds a valid spawn position for AI that avoids spawning on top of players, inside walls, or in
water. The sample places SlotAI entities in various challenging locations to show this works
automatically.

### Hierarchy

```
Area1 (Area.et)
  SlotAIOffice      — inside building, elevated (y 5.668)
  SlotAIOutdoor     — open ground
  SlotAIForested    — forested area
  SlotAIWaterPier   — near water / pier (y -2.157)
  SlotAIUnderground — underground / bunker area (y 4.946)
  SlotAIRoofSniper  — rooftop position (y 11.017)
  SlotAIValley      — valley terrain
FibonacciPreview    — SpherePointGeneratorPreview debug utility (workbench-only)
```

No special properties are set on any SlotAI — safe spawning is the default behaviour.

### Safe spawning: how it works (built-in)

`SCR_ScenarioFrameworkSlotAI` internally uses a Fibonacci sphere point generator to find
candidate spawn positions around the slot coordinate. It tests each candidate and picks
the first safe position (no collision with geometry, not in water, not occupied by a player).

This means:
- You do NOT need to configure any safe-spawn properties for basic use.
- Place the `SlotAI` anywhere — the framework will find a valid nearby position at runtime.
- The slot `coords` is the centre of the search, not the guaranteed spawn point.

### SpherePointGeneratorPreview utility

`{97C6D7F202008C25}Prefabs/Systems/ScenarioFramework/Utilities/SpherePointGeneratorPreview.et`

A Workbench-only debug entity that visualises the Fibonacci sphere candidate points around
a position. Has no runtime effect. Useful for understanding the search pattern.

Component: `SCR_SpherePointGeneratorPreviewComponent`

Key properties (debug/visualisation only):
- `m_aSphereRadii` — radii of the spheres to preview
- `m_iMaxPoints` — max candidate points to show
- `m_fSpacing` — spacing between points
- `m_bHueShiftByIndex` — colour-code points by index

### AI group prefabs seen in this sample

| Prefab | GUID |
|---|---|
| `Group_US_RifleSquad.et` | `{DDF3799FA1387848}` |
| `Group_US_FireTeam.et` | `{84E5BBAB25EA23E5}` |
| `Group_US_LightFireTeam.et` | `{FCF7F5DC4F83955C}` |
| `Group_US_SniperTeam.et` | `{D807C7047E818488}` |
| `Group_US_SentryTeam.et` | `{3BF36BDEEB33AEC9}` |

---

## Sample: SF-Sample-Subtasks

Demonstrates subtask hierarchy: a parent `LayerTaskMove` owns child `LayerTaskMove` entities
marked as subtasks. The parent task displays a progress bar and a subtasks description. All
non-optional subtasks must be completed for the parent to complete.

### Key properties on `SCR_ScenarioFrameworkLayerTaskMove`

| Property | Type | Notes |
|---|---|---|
| `m_bProgressBar` | bool | Shows progress bar on parent task (counts completed subtasks) |
| `m_sSubtasksDescription` | string | Header text shown above the subtask list (parent only) |
| `m_bIsSubtask` | bool | Marks this layer as a child subtask of its parent layer |
| `m_bIsOptional` | bool | Subtask is optional — parent can complete without it |

### Hierarchy pattern

```
Area1 (Area.et)
  LayerTaskMove1  ← parent task (m_bProgressBar 1, m_sSubtasksDescription set)
    LayerTaskMove2  ← subtask (m_bIsSubtask 1)
      SlotMoveTo2
    LayerTaskMove3  ← subtask (m_bIsSubtask 1)
      SlotMoveTo3
    LayerTaskMove4  ← optional subtask (m_bIsSubtask 1, m_bIsOptional 1)
      SlotMoveTo4
    SlotMoveTo1     ← parent's own move-to slot (direct child of parent layer)
```

- Parent completes when SlotMoveTo1 (main trigger) AND all non-optional subtasks are done.
- Optional subtask (Move 4) contributes to progress bar but does not block parent completion.
- Each subtask is a full `LayerTaskMove` with its own `SlotMoveTo` (SCR_ScenarioFrameworkSlotExtraction
  + SCR_ScenarioFrameworkPluginTrigger radius 4 + ScenarioFrameworkCharacterTrigger spawned object).

### SlotMoveTo / SlotExtraction trigger setup

```
SlotMoveTo (SlotMoveTo.et)
  SCR_ScenarioFrameworkSlotExtraction
    m_aPlugins
      SCR_ScenarioFrameworkPluginTrigger { m_fAreaRadius 4 }
    m_sObjectToSpawn  {47D49EA6A216CFD5}Prefabs/Systems/ScenarioFramework/Triggers/ScenarioFrameworkCharacterTrigger.et
```

`SlotMoveTo.et` uses `SCR_ScenarioFrameworkSlotExtraction` (not `SCR_ScenarioFrameworkSlotBase`)
with a character trigger plugin — the trigger fires when a character enters the radius.

---

## Sample: SF-Sample-TaskClearArea

Demonstrates `LayerTaskClearArea` + `SlotClearArea`. The task completes when all enemy AI in
the area are eliminated.

### Hierarchy

```
Area_A (Area.et)
  m_iRandomPercent 100
  m_fAreaRadius 75
  LayerTaskClearArea_1 (LayerTaskClearArea.et)
    Layer1 (Layer.et)  m_iRandomPercent 100
      SlotClearArea1 (SlotClearArea.et)
        SCR_ScenarioFrameworkSlotClearArea
          SCR_ScenarioFrameworkPluginTrigger
            m_fAreaRadius 75
            m_aSpecificClassNames { "SCR_ChimeraCharacter" }
            m_sActivatedByThisFaction "US"
    Layer_AI (Layer.et)
      SlotAI1/2/3 → Character_USSR_Unarmed.et
```

### Key properties on `SCR_ScenarioFrameworkSlotClearArea` (GUID `{5A633AF525D5B972}`)

Uses `SCR_ScenarioFrameworkPluginTrigger` (ClearArea variant GUID `{5A633AF5368D26A3}`) — different
GUID from the standard trigger plugin.

| Property | Notes |
|---|---|
| `m_fAreaRadius` | Radius of the detection zone — match to Area's `m_fAreaRadius` |
| `m_aSpecificClassNames` | Class filter for enemies to track, e.g. `"SCR_ChimeraCharacter"` |
| `m_sActivatedByThisFaction` | Faction that "owns" / activates the check, e.g. `"US"` |

**Prefab GUIDs**
- `SlotClearArea.et` — `{E53456990A756229}`
- `LayerTaskClearArea.et` — `{CDC0845AD90BA073}`
- `Character_USSR_Unarmed.et` — `{98EB9CDD85B8C92C}`

### Notes
- AI spawned as individual characters (not groups) via `SlotAI`.
- `m_fAreaRadius` on `SCR_ScenarioFrameworkArea` and on the plugin trigger should match.

---

## Sample: SF-Sample-TaskDefendArea

Demonstrates `LayerTaskDefend` + `SlotDefend`. Defenders must hold the area for a set duration
against repeating attacker waves. The defend countdown starts when the named trigger is activated.

### Hierarchy

```
Area_A (Area.et)
  m_fAreaRadius 55
  Task_Defend (LayerTaskDefend.et)
    SCR_ScenarioFrameworkLayerTaskDefend
      m_sTaskPrefab  TaskDefend.et
      m_sTriggerName "myNamedTrigger"
      m_sCountdownTitleText "DEFEND AREA"
      m_fDefendTime 60
      m_fMinDefenderPercentageRatio 0.51
      m_aFactionSettings
        SCR_ScenarioFrameworkTaskDefendAttackingFaction  m_sFactionKey "USSR"
        SCR_ScenarioFrameworkTaskDefendDefendingFaction  m_sFactionKey "US"
      m_aAttackerLayerNames { "Attacker_USSR" }
    Defender_US (Layer.et)  m_iRandomPercent 100
      Slot1 (Slot.et) → Tripod_M122_MG_M60.et  (defender equipment)
      myNamedTrigger (SlotPlayerTrigger.et)
        SCR_ScenarioFrameworkSlotTrigger
          SCR_ScenarioFrameworkPluginTrigger
            m_fAreaRadius 150
            m_eActivationPresence ANY_CHARACTER
      Slot_Defend (SlotDefend.et)
        SCR_ScenarioFrameworkSlotDefend
          m_sObjectToSpawn  ScenarioFrameworkCharacterTrigger.et
    Attacker_USSR (Layer.et)
      m_bEnableRepeatedSpawn 1
      m_iRepeatedSpawnNumber 2
      m_fRepeatedSpawnTimer 15
      SlotAI1/2/3 → Character_USSR_Unarmed.et  (m_bEnableRepeatedSpawn 1 each)
```

### Key properties on `SCR_ScenarioFrameworkLayerTaskDefend` (GUID `{5C52E161174024CB}`)

| Property | Notes |
|---|---|
| `m_sTaskPrefab` | Task prefab to use — `TaskDefend.et` `{888DC29A0B4F3F20}` |
| `m_sTriggerName` | Name of the `SlotPlayerTrigger` entity that starts the countdown |
| `m_sCountdownTitleText` | Text shown in the defend countdown HUD |
| `m_fDefendTime` | Seconds defenders must hold the area |
| `m_fMinDefenderPercentageRatio` | Min ratio of defenders that must be alive (0.51 = majority) |
| `m_aFactionSettings` | Array of attacking + defending faction keys |
| `m_aAttackerLayerNames` | Layer name(s) containing attacker AI — used to track attacker spawns |

### Repeated spawn on attacker layer

`SCR_ScenarioFrameworkLayerBase` supports repeated AI waves:
- `m_bEnableRepeatedSpawn 1` — enables wave respawning on the layer
- `m_iRepeatedSpawnNumber` — number of times to respawn (2 = two additional waves)
- `m_fRepeatedSpawnTimer` — delay in seconds between waves (15s here)

Also set `m_bEnableRepeatedSpawn 1` on each `SCR_ScenarioFrameworkSlotAI` within the layer.

### Named trigger pattern

`SlotPlayerTrigger` is placed as a named entity (`myNamedTrigger`) inside the defender layer.
`SCR_ScenarioFrameworkLayerTaskDefend.m_sTriggerName` references it by entity name.
The trigger uses `m_eActivationPresence ANY_CHARACTER` — fires when any character enters radius.

### Prefab GUIDs

| Prefab | GUID |
|---|---|
| `LayerTaskDefend.et` | `{775C493CE872C3A5}` |
| `SlotDefend.et` | `{E123BAC59A9B3D5F}` |
| `SlotPlayerTrigger.et` | `{D183AFE8DAF9793D}` |
| `TaskDefend.et` (task prefab) | `{888DC29A0B4F3F20}` |

---

## Sample: SF-Sample-TaskDefendAreaAndTarget

Identical structure to `SF-Sample-TaskDefendArea` with one key difference: `SlotDefend` now
also spawns a friendly character (the "target") that must survive, and has `m_sFactionKey` set.

### Difference from TaskDefendArea

In `SF-Sample-TaskDefendArea`, `SlotDefend` only spawns a trigger:
```
SCR_ScenarioFrameworkSlotDefend {
  m_sObjectToSpawn  ScenarioFrameworkCharacterTrigger.et
}
```

In `SF-Sample-TaskDefendAreaAndTarget`, `SlotDefend` spawns a friendly character AND sets a faction:
```
SCR_ScenarioFrameworkSlotDefend {
  m_sFactionKey "US"
  m_sObjectToSpawn  {2F912ED6E399FF47}Prefabs/Characters/Factions/BLUFOR/US_Army/Character_US_Unarmed.et
}
```

### `m_sFactionKey` on `SCR_ScenarioFrameworkSlotDefend`

Setting `m_sFactionKey` on `SlotDefend` associates the spawned object with a faction.
This makes the framework track that character as the "target" — if it dies, the task fails.
Without it (TaskDefendArea), only the area/timer condition matters.

### Full hierarchy (same as TaskDefendArea except SlotDefend)

```
Area_A (Area.et)  m_fAreaRadius 75
  Task_Defend (LayerTaskDefend.et)
    SCR_ScenarioFrameworkLayerTaskDefend  (same properties as TaskDefendArea)
    Defender_US (Layer.et)
      Slot1           → Tripod_M122_MG_M60.et
      myNamedTrigger  (SlotPlayerTrigger) radius 150  ANY_CHARACTER
      Slot_Defend     (SlotDefend.et)
        m_sFactionKey "US"
        m_sObjectToSpawn  Character_US_Unarmed.et   ← the target to protect
    Attacker_USSR (Layer.et)  repeated spawn x2 / 15s
      SlotAI1/2/3     → Character_USSR_Unarmed.et
```

**Character_US_Unarmed.et** — `{2F912ED6E399FF47}`

---

## Sample: SF-Sample-TaskDefendTarget

The minimal defend variant — protect only a target character, no area control, no attacker
layer, no named trigger. The countdown starts immediately on spawn.

### Hierarchy

```
Area_A (Area.et)  m_fAreaRadius 75
  Task_Defend (LayerTaskDefend.et)
    SCR_ScenarioFrameworkLayerTaskDefend
      m_sTaskTitle "Task Defend Target"
      m_sTaskPrefab  TaskDefend.et
      m_sCountdownTitleText "DEFEND TARGET"
      m_fDefendTime 15
      (no m_aFactionSettings, no m_sTriggerName, no m_aAttackerLayerNames)
    Slot_Defend (SlotDefend.et)
      SCR_ScenarioFrameworkSlotDefend
        m_sFactionKey "US"
        m_sObjectToSpawn  Character_US_Unarmed.et
```

### Comparison: three defend task variants

| Feature | TaskDefendArea | TaskDefendAreaAndTarget | TaskDefendTarget |
|---|---|---|---|
| `m_sTriggerName` | yes (starts countdown) | yes | no (starts immediately) |
| `m_aFactionSettings` | yes | yes | no |
| `m_aAttackerLayerNames` | yes | yes | no |
| `m_fMinDefenderPercentageRatio` | yes | yes | no |
| `SlotDefend.m_sFactionKey` | no | yes | yes |
| `SlotDefend` spawns character | no (trigger only) | yes | yes |
| Attacker layer | yes | yes | no |
| `m_fDefendTime` | 60s | 60s | 15s |

### Key insight
`m_sTriggerName` absence means countdown begins as soon as the layer spawns.
`m_aFactionSettings` / `m_aAttackerLayerNames` are optional — omit them for a pure
"survive N seconds" task with no managed attackers.

---

## Sample: SF-Sample-TaskDeliverIntel

Demonstrates `LayerTaskDeliver` with `SlotPick` (item pickup) + `SlotDelivery` (dropoff zone).
Two new slot types. Task title/description update in two stages as the player picks up and delivers.

### Hierarchy

```
DeliverIntel (Area.et)
  m_sTriggerResource ""
  TaskDeliverIntel (LayerTaskDeliver.et)
    SCR_ScenarioFrameworkLayerTaskDeliver
      m_sTaskTitle "#AR-CombatScenario_Intel_Title"
      m_sTaskDescription "#AR-CombatScenario_Intel_Description_A"
      m_bPlaceMarkerOnSubjectSlot 1
      m_sTaskTitleUpdated "Deliver Intel"
      m_sTaskDescriptionUpdated "#AR-CombatScenario_Intel_Description_D"
    SlotDelivery1 (SlotDelivery.et)
      SCR_ScenarioFrameworkSlotDelivery
        SCR_ScenarioFrameworkPluginTrigger  m_fAreaRadius 15  m_bOnce 0
        m_sObjectToSpawn  ScenarioFrameworkCharacterTrigger.et
        m_aAssociatedTaskLayers { "TaskDeliverIntel" }
    SlotPick1 (SlotPick.et)
      SCR_ScenarioFrameworkSlotPick
        m_sObjectToSpawn  IntelligenceFolder_E_01.et
        m_sTaskTitle / m_sTaskDescription        ← shown before pickup
        m_sTaskTitleUpdated1 / m_sTaskDescriptionUpdated1  ← shown after pickup
        m_sTaskTitleUpdated2 / m_sTaskDescriptionUpdated2  ← shown after delivery
```

### `SCR_ScenarioFrameworkSlotPick` (GUID `{5A2283FD60F69A1A}`)

Spawns a world item the player must pick up. Drives three-stage task text:

| Property | Stage | Notes |
|---|---|---|
| `m_sTaskTitle` / `m_sTaskDescription` | Initial | Before item is picked up |
| `m_sTaskTitleUpdated1` / `m_sTaskDescriptionUpdated1` | After pickup | Player is carrying the item |
| `m_sTaskTitleUpdated2` / `m_sTaskDescriptionUpdated2` | After delivery | Task completed text |

`m_sObjectToSpawn` — the item prefab to place in the world (e.g. `IntelligenceFolder_E_01.et`).

**`SlotPick.et`** — `{9F70B00322910AED}`

### `SCR_ScenarioFrameworkSlotDelivery` (GUID `{59F51EA7A10294D2}`)

The dropoff zone. Triggers when the player (carrying the item) enters the radius.

| Property | Notes |
|---|---|
| `SCR_ScenarioFrameworkPluginTrigger` | Defines the delivery zone radius (`m_fAreaRadius 15`) |
| `m_bOnce 0` | Plugin trigger can fire more than once (set 0 for repeatable delivery) |
| `m_sObjectToSpawn` | Trigger entity spawned to detect player entry |
| `m_aAssociatedTaskLayers` | Layer name(s) this delivery slot is linked to — must match the `LayerTaskDeliver` entity name |

**`SlotDelivery.et`** — `{4C2EF5C1E53FE511}`

### `SCR_ScenarioFrameworkLayerTaskDeliver` (GUID `{5A6513F48903E7DA}`)

| Property | Notes |
|---|---|
| `m_bPlaceMarkerOnSubjectSlot 1` | Puts a map/world marker on the `SlotPick` location |
| `m_sTaskTitleUpdated` / `m_sTaskDescriptionUpdated` | Updated text shown after pickup (layer-level override) |

**`LayerTaskDeliver.et`** — `{88821DCA414AF4C7}`

### Notes
- `m_sTriggerResource ""` on `SCR_ScenarioFrameworkArea` — empty string clears the default trigger resource.
- `m_aAssociatedTaskLayers` on `SlotDelivery` must reference the **entity name** of the `LayerTaskDeliver`
  (not the prefab name) so the delivery links back to the correct task.
- `IntelligenceFolder_E_01.et` — `{6D56FED1E55A8F84}`

---

## Sample: SF-Sample-TaskDestroy

Demonstrates `LayerTaskDestroy` + `SlotDestroy`. Spawns a vehicle as the destroy target plus
sibling `Slot` entities with weapons for the player to use. No task title configured — uses defaults.

### Hierarchy

```
Area_A (Area.et)  m_fAreaRadius 75
  LayerTaskDestroy1 (LayerTaskDestroy.et)
    Layer1 (Layer.et)  m_iRandomPercent 100
      SlotDestroy1 (SlotDestroy.et)
        SCR_ScenarioFrameworkSlotDestroy
          m_sObjectToSpawn  UAZ469.et   ← the target to destroy
      Slot1 (Slot.et) → Launcher_RPG7.et   ← player equipment
      Slot2 (Slot.et) → Launcher_RPG7.et
      Slot4 (Slot.et) → Launcher_RPG7.et
      Slot5 (Slot.et) → Launcher_RPG7.et
```

### `SCR_ScenarioFrameworkSlotDestroy` (GUID `{5A22E1D6276BD209}`)

Only property needed: `m_sObjectToSpawn` — the prefab to spawn as the destruction target.
The framework automatically tracks destruction of this object and completes the task when it is destroyed.

No special trigger needed — `SlotDestroy` monitors the spawned entity's health/destruction state directly.

### Prefab GUIDs

| Prefab | GUID |
|---|---|
| `LayerTaskDestroy.et` | `{5EDF39860639027D}` |
| `SlotDestroy.et` | `{7586595959BA2D99}` |
| `UAZ469.et` | `{259EE7B78C51B624}` |
| `Launcher_RPG7.et` | `{7A82FE978603F137}` |

---

## Sample: SF-Sample-TaskDestroyRock

Same structure as `SF-Sample-TaskDestroy` but the target is an **existing world asset** (a rock
already placed in the world) rather than a freshly spawned entity. Also shows `%1` placeholder
in task description and `SCR_ScenarioFrameworkLayerTaskDestroy` component on the layer.

### Key differences from TaskDestroy

**`SCR_ScenarioFrameworkSlotDestroy`:**
```
m_sObjectToSpawn  "{38CC50480D29CCFD}PrefabLibrary/.../Granite_Boulder_01.et"
m_bUseExistingWorldAsset 1
```
`m_bUseExistingWorldAsset 1` — do not spawn; instead find the nearest existing world entity
matching `m_sObjectToSpawn` and track it for destruction.

**`SCR_ScenarioFrameworkLayerTaskDestroy`** (GUID `{5A6513F41BA457C8}`) on the layer:
```
m_sTaskTitle "Destroy Target"
m_sTaskDescription "Destroy Target %1"
```
`%1` in task description is replaced at runtime with the target entity name/identifier.
This component exists on `LayerTaskDestroy` (not just inherited defaults).

### `RockToDestroy.et` — the world asset

```
SCR_IndestructibleEnvironmentalEntity  (base: Granite_Boulder_01.et)
  SCR_DestructionMultiPhaseComponent
    m_fBaseHealth 850
    DamageThreshold 250
    "Explosive multiplier" 90   ← RPG/explosive damage multiplier
  RplComponent                  ← replicated (required for destruction tracking)
```

The rock is a `SCR_IndestructibleEnvironmentalEntity` with `SCR_DestructionMultiPhaseComponent`
and `RplComponent`. Replication is required — `SlotDestroy` cannot track destruction of
non-replicated entities.

### Hierarchy

```
Area1 (Area.et)
  LayerTaskDestroy1 (LayerTaskDestroy.et)
    SCR_ScenarioFrameworkLayerTaskDestroy
      m_sTaskTitle "Destroy Target"
      m_sTaskDescription "Destroy Target %1"
    Layer1 (Layer.et)
      SlotDestroy1 (SlotDestroy.et)
        m_sObjectToSpawn  Granite_Boulder_01.et
        m_bUseExistingWorldAsset 1
      Slot1/2/4/5 → Launcher_RPG7.et
```

---

## Sample: SF-Sample-TaskExfil

Demonstrates `SlotExtraction` with full countdown + notification properties, `TaskExtract.et`
task prefab, and `EndMission` on finish. Also shows `m_sTriggerResource` on `SCR_ScenarioFrameworkArea`.

### Hierarchy

```
Area_A (Area.et)
  SCR_ScenarioFrameworkArea
    m_sTriggerResource  ScenarioFrameworkCharacterTrigger.et   ← area-level trigger resource
  LayerTaskMove1 (LayerTaskMove.et)
    SCR_ScenarioFrameworkLayerTaskMove
      m_sTaskTitle "Task Exfil"
      m_sTaskPrefab  TaskExtract.et  {6829FAD588965A88}
      m_aTriggerActionsOnFinish
        SCR_ScenarioFrameworkActionEndMission   ← end mission on exfil complete
    SlotExtraction1 (SlotExtraction.et)
      SCR_ScenarioFrameworkSlotExtraction
        SCR_ScenarioFrameworkPluginTrigger
          m_fAreaRadius 10
          m_fMinimumPlayersNeededPercentage 0.75
          m_fActivationCountdownTimer 5
          m_bNotificationEnabled 1
          m_sPlayerActivationNotificationTitle "#AR-CombatScenario_ExfilTrigger_Notification"
          m_bEnableAudio 1
          m_sCountdownAudio "SOUND_RESPAWNMENU"
        m_sObjectToSpawn  ScenarioFrameworkCharacterTrigger.et
```

### Full `SCR_ScenarioFrameworkPluginTrigger` properties on `SlotExtraction`

| Property | Value | Notes |
|---|---|---|
| `m_fAreaRadius` | 10 | Radius of the extraction zone |
| `m_fMinimumPlayersNeededPercentage` | 0.75 | Fraction of alive players that must be in zone to start countdown |
| `m_fActivationCountdownTimer` | 5 | Seconds players must remain in zone before extraction completes |
| `m_bNotificationEnabled` | 1 | Show notification when players enter zone |
| `m_sPlayerActivationNotificationTitle` | localization key | Text shown in the notification |
| `m_bEnableAudio` | 1 | Play audio during countdown |
| `m_sCountdownAudio` | `"SOUND_RESPAWNMENU"` | Audio event key played during countdown |

### `m_sTriggerResource` on `SCR_ScenarioFrameworkArea`

Sets the default trigger prefab used by this area's slots. When set, slots within the area
that do not override `m_sObjectToSpawn` will use this trigger resource.
Set to `""` to clear the default (seen in TaskDeliverIntel).

### Prefab GUIDs

| Prefab | GUID |
|---|---|
| `SlotExtraction.et` | `{9C47DECB98FDA4DA}` |
| `TaskExtract.et` | `{6829FAD588965A88}` |

---

## Sample: SF-Sample-TaskKill

Minimal kill task — `LayerTaskKill` with a single `SlotKill`. No task title set; uses default
task title from the prefab. Confirms the baseline `SlotKill` + `AIWaypoint_Wait` pattern.

### Hierarchy

```
Area_A (Area.et)  m_fAreaRadius 75
  LayerTaskKill1 (LayerTaskKill.et)
    SCR_ScenarioFrameworkLayerTaskKill  m_iRandomPercent 100
    SlotKill1 (SlotKill.et)
      SCR_ScenarioFrameworkSlotKill
        m_sObjectToSpawn  Character_USSR_Unarmed.et
        m_sWPToSpawn  AIWaypoint_Wait.et
```

### Prefab GUIDs

| Prefab | GUID |
|---|---|
| `LayerTaskKill.et` | `{2008B4EE6C4D528E}` |
| `SlotKill.et` | `{C70DC6CBD1AAEC9A}` |
| `SCR_ScenarioFrameworkLayerTaskKill` component | `{5B02763B6A6D6C4B}` |
| `SCR_ScenarioFrameworkSlotKill` component | `{5B02763C1EAA0BF1}` |
| `AIWaypoint_Wait.et` | `{531EC45063C1F57B}` |

---

## Sample: SF-Sample-TaskMove

The absolute baseline move task. `LayerTaskMove` + `SlotMoveTo` with no properties configured
beyond debug shapes. `SCR_ScenarioFrameworkPluginTrigger` is present but empty (all defaults).

### Hierarchy

```
Area_A (Area.et)
  LayerTaskMove1 (LayerTaskMove.et)
    SCR_ScenarioFrameworkLayerTaskMove  (no title/description — uses defaults)
    SlotMoveTo1 (SlotMoveTo.et)
      SCR_ScenarioFrameworkSlotExtraction
        SCR_ScenarioFrameworkPluginTrigger  {}   ← empty = all defaults
        m_sObjectToSpawn  ScenarioFrameworkCharacterTrigger.et
```

### Notes
- `SlotMoveTo.et` uses `SCR_ScenarioFrameworkSlotExtraction` as its component (not a dedicated SlotMove component).
- An empty `SCR_ScenarioFrameworkPluginTrigger {}` block is valid — uses default radius and presence settings.
- No `m_fAreaRadius` set means the trigger uses its default radius.

### Prefab GUIDs

| Prefab | GUID |
|---|---|
| `LayerTaskMove.et` | `{246BEC080F393398}` |
| `SlotMoveTo.et` | `{A44004A770A5D8BE}` |
| `SCR_ScenarioFrameworkLayerTaskMove` component | `{5A2283E9F84958A1}` |

---

## Sample: SF-Sample-Waypoints

The most complex waypoint sample. Demonstrates a full multi-step AI route using chained
`AIAddWaypoint` + `AIActionOnWaypointCompleted` actions: GetIn helicopter → fly → GetOut →
move on foot → open gate → GetIn UAZ → drive → GetOut UAZ.

Also introduces `m_sID` on `SlotBase` for named entity referencing, `WaypointGetIn` (named
vehicle) vs `WaypointGetInNearest`, `WaypointGetOut`, `WaypointMove`, and `WaypointOpenGate`.

### Hierarchy

```
Area1 (Area.et)
  Layer1 (Layer.et)
    SlotAI1 → Group_US_FireTeam.et
      m_aActivationActions
        WaitAndExecute (1s delay)
          ActionAI
            AIAddWaypoint → GetInHeli  (m_bClearPreviousWaypoints 1)
            AIActionOnWaypointCompleted → GetInHeli
              ActionAI
                AIAddWaypoint → GetOutHeli
                AIActionOnWaypointCompleted → GetOutHeli
                  ActionAI
                    AIAddWaypoint → MoveWP
                    AIActionOnWaypointCompleted → MoveWP
                      ActionAI
                        AIAddWaypoint → OpenGate
                        AIActionOnWaypointCompleted → OpenGate
                          ActionAI
                            AIAddWaypoint → GetInUAZ
                            AIActionOnWaypointCompleted → GetInUAZ
                              ActionAI
                                AIAddWaypoint → MoveWP
                                AIActionOnWaypointCompleted → MoveWP
                                  ActionAI
                                    AIAddWaypoint → GetOutUAZ
    Slot1 → UH1H.et  (m_sID "namedHeli")
    Slot3 → UAZ469.et
  Waypoints (Layer.et)
    GetInHeli   (SlotWaypoint) → WaypointGetIn        m_sEntityName "namedHeli"
    GetOutHeli  (SlotWaypoint) → WaypointGetOut       m_fCompletionRadius 10
    MoveWP      (SlotWaypoint) → WaypointMove         m_fCompletionRadius 10, m_eAIWaypointCompletionType All
    OpenGate    (SlotWaypoint) → WaypointOpenGate     m_sStaticEntityName "BarGate"
    GetInUAZ    (SlotWaypoint) → WaypointGetInNearest m_fCompletionRadius 10, m_bDriverAllowed 1
    GetOutUAZ   (SlotWaypoint) → WaypointGetOut       m_fCompletionRadius 10
```

### Named entity pattern: `m_sID`

`SCR_ScenarioFrameworkSlotBase.m_sID` assigns a name to the spawned entity at runtime.
`WaypointGetIn.m_sEntityName` references that name to target a specific vehicle.

```
Slot1 (Slot.et)
  SCR_ScenarioFrameworkSlotBase
    m_sObjectToSpawn  UH1H.et
    m_sID "namedHeli"       ← assigns runtime name

GetInHeli (SlotWaypoint.et)
  WaypointGetIn
    m_sEntityName "namedHeli"   ← matches m_sID above
```

### Extended SlotWaypoint types table

| Waypoint class | GUID | Key properties |
|---|---|---|
| `WaypointPatrol` | `{5F1A98EEB541C386}` / `{5F1A98EEA416913A}` / `{5F1A98EEA8BE37C6}` | patrol point |
| `WaypointCycle` | `{5F1A98EEBAF88E76}` | loops back to start of waypoint set |
| `WaypointGetInNearest` | `{60E870CBD72267EB}` | get in nearest vehicle; `m_fCompletionRadius`, `m_bDriverAllowed` |
| `WaypointArtillerySupport` | `{62AE875506818539}` | mortar/artillery; `m_iTargetShotCount` |
| `WaypointGetIn` | `{60E8BDE1BE4C852D}` | get in specific named vehicle; `m_sEntityName` |
| `WaypointGetOut` | `{60E870CCE037E638}` | exit vehicle; `m_fCompletionRadius` |
| `WaypointMove` | `{60E870CD06C0247C}` | move to position; `m_fCompletionRadius`, `m_eAIWaypointCompletionType` |
| `WaypointOpenGate` | `{60E870DEB70E6B28}` | open a gate/door; `m_sStaticEntityName` |

### `m_eAIWaypointCompletionType` on `WaypointMove`

Controls which group members must reach the waypoint before it is considered complete:
- `All` — all members must arrive (used here)
- (other values exist, e.g. `Leader`)

### `WaypointOpenGate` — `m_sStaticEntityName`

References a world-placed static entity by name (e.g. `"BarGate"`).
`BarGate.et` in the world is a `StaticModelEntity` based on `BarGate_01.et`.

### `BarGate.et` world asset
```
StaticModelEntity : BarGate_01.et {07F043DD6AACCD0B}
```

### Vehicle GUIDs
| Prefab | GUID |
|---|---|
| `UH1H.et` | `{70BAEEFC2D3FEE64}` |
| `UAZ469.et` | `{259EE7B78C51B624}` |

---

## Prefab Path Reference

| Prefab | GUID |
|---|---|
| `GameModeSF.et` | `{ECEEDB2D3737204B}` |
| `GameModeSF_SinglePlayer.et` | (inherits above) |
| `Components/Area.et` | `{59E8CDC50969206E}` component |
| `Components/Layer.et` | `{5A2283EA2A0B4B14}` component |
| `Components/SlotAI.et` | `{5A26B3E02AC77BA0}` component |
| `Tasks/TaskManager.et` | `{87208DAD6F3C0DE2}` (base) |
| `Triggers/ScenarioFrameworkTrigger.et` | `{DA58C3DF4455555E}` |
| `Triggers/TriggerCharacterSlow.et` | `{47D49EA6A216CFD5}` |
| `Triggers/TriggerDominance.et` | `{2CB3F93211D06F83}` |
| `Triggers/TriggerExtraction.et` | `{374...}` |
| `Compositions/QRFSpawnpointsLayer.et` | `{5F9FFF4BF027B3A3}` (base Layer) |

---

## GenericTask

A fully manual task type — provides task UI and hierarchy but has **no built-in completion logic**.
All state changes (activation, progression, completion) must be driven externally.

### Hierarchy

```
Area
  └─ LayerTask (Generic)
       └─ SlotTask (GenericTask)
```

### When to use

- Script-controlled objectives
- Counter-based objectives (e.g. capture multiple items)
- Multi-phase missions
- Hidden or narrative-driven objectives
- Variable-based completion logic
- Complex trigger chains

### Key differences vs specialised tasks

| Feature | GenericTask | Specialised (Move/Destroy/Kill/etc.) |
|---|---|---|
| Automatic completion | No | Yes |
| Entity listeners | No | Yes |
| Full manual control | Yes | Limited |
| Complex workflows | Yes | Sometimes |

### Completion

Must be triggered by one of:
- `SCR_ScenarioFrameworkActionChangeTaskState` (most common)
- Logic entities (`LogicCounter`, `LogicOR`, `LogicSwitch`)
- Finish Conditions + Finish Condition Logic (AND / OR / XOR / NOT)
- Scripted state changes

If no completion logic is defined the task remains active indefinitely.

### Configurable task UI properties

- `m_sTaskTitle`
- `m_sTaskDescription`
- Task Execution Briefing
- Intro Voiceline
- Finish Conditions / Finish Condition Logic

### Supports all standard Layer properties

`ON_INIT` / `ON_TRIGGER_ACTIVATION` activation types, `m_aActivationConditions`,
`m_SpawnChildren` (ALL / RANDOM_ONE / RANDOM_MULTIPLE), dynamic spawn/despawn,
`m_sFactionKey`, plugins, activation actions.

---

## Pattern: Player-Triggered Ambush Spawner (CONFIRMED WORKING)

Player walks into zone → USSR AI groups spawn with Search & Destroy.

### Hierarchy

```
Area1 (Area.et)  — ON_INIT=3, DynamicDespawn=1
  TriggerAmbush (SlotPlayerTrigger.et)  — child of Area1 (NOT Layer1!)
    SCR_ScenarioFrameworkSlotTrigger
      m_sObjectToSpawn  {47D49EA6A216CFD5}Prefabs/Systems/ScenarioFramework/Triggers/TriggerCharacterSlow.et
      m_sFactionKey  US
      m_aTriggerActions
        SCR_ScenarioFrameworkActionSpawnObjects
          m_aNameOfObjectsToSpawnOnActivation { "Layer1" }  ← set manually in UI
  Layer1 (Layer.et)  — ON_TRIGGER_ACTIVATION=1, child of Area1
    SlotAI_1 (SlotAI.et)
      m_sObjectToSpawn  Prefabs/Groups/OPFOR/Group_USSR_LightFireTeam.et
      m_sFactionKey  USSR
      m_sWPToSpawn  WP_SearchAndDestroy
    SlotAI_2 (SlotAI.et)
      m_sObjectToSpawn  Prefabs/Groups/OPFOR/Group_USSR_MachineGunTeam.et
      m_sFactionKey  USSR
      m_sWPToSpawn  WP_SearchAndDestroy
```

### Critical rules

1. **TriggerAmbush must be a child of Area1, NOT Layer1.** If TriggerAmbush is under
   Layer1 and Layer1 has `ON_TRIGGER_ACTIVATION`, the trigger never gets initialized
   (chicken-and-egg — Layer1 can't activate without a trigger, trigger can't fire without
   being active). The trigger slot must be a direct child of Area1 (or another always-active layer).

2. **`m_sObjectToSpawn` on the trigger slot is mandatory.** Without it there is no physical
   trigger volume in the world — nothing can detect the player.
   Use `{47D49EA6A216CFD5}Prefabs/Systems/ScenarioFramework/Triggers/TriggerCharacterSlow.et`
   for a 5 m sphere that detects any character.

3. **`m_aNameOfObjectsToSpawnOnActivation` must be set manually in Workbench UI.**
   The MCP API cannot set string arrays (`SetVariableValue` returns false / `CreateObjectArrayVariableMember`
   returns false for string arrays). Set the layer name in the UI directly.

4. **`SCR_GameModeSFManager.m_bDynamicDespawn=1` on the GameMode is required** — nothing spawns without it.

### Debug tools

Fully compatible with Task Inspector, Layer Inspector, Logic Inspector, Action Inspector —
supports manual finish, state inspection, restore to default, and runtime testing.

### Best practices

- Always define explicit Finish Conditions or Actions — task will hang otherwise.
- Use Logic entities for multi-step objectives.
- Use Variables to track state across phases.
- Use clear naming conventions in the layer hierarchy.

---

## MCP / Workbench Entity Creation — Known Pitfalls

Prefab GUIDs used in `wb_entity_create` must be exact. Wrong GUIDs cause **silent failures** —
the tool reports success but the entity does not appear (or appears as a default entity).

**Confirmed working GUIDs** (from Prefab Path Reference section above):
- Area: `{59E8CDC50969206E}` (component GUID — use full prefab path for entity creation)
- SlotAI component: `{5A26B3E02AC77BA0}`
- TaskManager base: `{87208DAD6F3C0DE2}`

**Workaround:** `wb_entity_create` cannot place base game SF prefabs reliably — all formats tried
(GUID prefix, `enfusion://`, `~ArmaReforger:` short form) result in silent failures.
Always instruct the user to drag from the Resource Browser instead.

Confirmed correct Resource Browser paths (from BI wiki):
- `ArmaReforger/Prefabs/ScenarioFramework/Tasks/TaskManager.et`
- `ArmaReforger/Prefabs/ScenarioFramework/Components/Area.et`
- `ArmaReforger/Prefabs/ScenarioFramework/Components/Layer.et`
- `ArmaReforger/Prefabs/ScenarioFramework/Components/SlotAI.et`
- `ArmaReforger/Prefabs/ScenarioFramework/Components/SlotPlayerTrigger.et`
- `ArmaReforger/Prefabs/ScenarioFramework/Components/LayerTaskKill.et`
- `ArmaReforger/Prefabs/Scenario Framework/GameModeSF.et` (note the space in folder name)

**Faction keys** (`m_sFactionKey`) cannot be set via the `wb_entity_modify setProperty` tool —
`SetVariableValue` returns false for this property. Must be set manually in the Attribute panel.

---

## World & Scenario Bootstrap (Official Tutorial Pattern)

### Sub-scene setup

1. Open base world via **File > Load World** (`Ctrl+O`).
2. Create sub-scene via **File > New World** → select **"Sub-scene (of current world)"** → OK.
3. Save following the convention: `MyModDirectory\worlds\WorldName\WorldName.ent`

### Bootstrapping SF entities via Game Mode Setup plugin

Use **Plugins > Game Mode Setup** — this is the correct way to place all required SF entities at once.

Steps:
1. Template field → `..` → select:
   `~ArmaReforger:Configs/Workbench/GameModeSetup/ScenarioFramework.conf`
   Click **Next**.
2. **World Scan** screen → click **Skip** (for a clean/new world).
3. **World Configuration** screen → click **Create entities** — places GameMode, TaskManager, and all required entities in the active layer.
4. **World Configuration Completed** → review issues → **Next**.
5. **Mission Header** screen → click **Create header** (makes scenario appear in main menu) → **Next** → **Close**.

> This is the recommended alternative to manually dragging individual prefabs. Avoids missing required entities.

---

## Common Scenario Patterns (Official Tutorial)

### Minimal spawn area hierarchy

```
Start (layer, set as active)
└── Area1          (Area.et)
    └── Layer1     (Layer.et)
        ├── SpawnPoint  (Slot.et — Object To Spawn: SpawnPoint_US.et)
        ├── ArsenalBox  (Slot.et — Object To Spawn: ArsenalBox_US.et)
        └── Humvee      (Slot.et — Object To Spawn: M1025.et)
```

### Chaining tasks with OnTaskFinished → SpawnObjects

To make Task B activate only after Task A completes:

1. Select **LayerTaskA** → `SCR_ScenarioFrameworkLayerTask` component → **OnTaskFinished** → add action:
   - `SCR_ScenarioFrameworkActionSpawnObjects`
   - Under **Name Of Objects To Spawn On Activation** → add entry: `LayerTaskB`
2. Set **LayerTaskB** `m_eActivationType` → `ON_TRIGGER_ACTIVATION` (waits for the spawn call).

This is the standard sequential task chain pattern.

### Random destroy task (RANDOM_ONE child selection)

```
Area
└── LayerTaskDestroy   m_SpawnChildren RANDOM_ONE, m_eActivationType ON_TRIGGER_ACTIVATION
    ├── Layer1
    │    └── SlotDestroy1  (UAZ469.et)
    └── Layer2
         └── SlotDestroy2  (Ural4320_transport_covered.et)
```

On activation, exactly one of the two child Layers spawns — reduces repetitiveness.

### Game Over action on task finish

In **OnTaskFinished** on the final LayerTask:
- Add action: search **"EndMission"** in action picker
- Tick **Override Game Over Type**
- Set **Game Over Type** → `FACTION_VICTORY_SCORE`

---

## Confirmed Resource Paths (`~ArmaReforger:` short form)

| Asset | Path |
|---|---|
| SF config (Game Mode Setup) | `~ArmaReforger:Configs/Workbench/GameModeSetup/ScenarioFramework.conf` |
| Area | `~ArmaReforger:Prefabs/ScenarioFramework/Components/Area.et` |
| Layer | `~ArmaReforger:Prefabs/ScenarioFramework/Components/Layer.et` |
| LayerTaskMove | `~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskMove.et` |
| LayerTaskDestroy | `~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskDestroy.et` |
| SlotMoveTo | `~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotMoveTo.et` |
| SlotDestroy | `~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotDestroy.et` |
| Slot (generic) | `~ArmaReforger:Prefabs/ScenarioFramework/Components/Slot.et` |
| SpawnPoint_US | `~ArmaReforger:Prefabs/MP/Spawning/SpawnPoint_US.et` |
| ArsenalBox_US | `~ArmaReforger:Prefabs/Props/Military/Arsenal/ArsenalBoxes/US/ArsenalBox_US.et` |
| M1025 (Humvee) | `~ArmaReforger:Prefabs/Vehicles/Wheeled/M998/M1025.et` |
| M1025_MERDC | `~ArmaReforger:Prefabs/Vehicles/Wheeled/M998/M1025_MERDC.et` |
| UAZ469 | `~ArmaReforger:Prefabs/Vehicles/Wheeled/UAZ469/UAZ469.et` |
| Ural4320 (covered) | `~ArmaReforger:Prefabs/Vehicles/Wheeled/Ural4320/Ural4320_transport_covered.et` |

---

## MCP Workbench Placement — Verified GUIDs (from live layer files)

These GUIDs are confirmed from `TESTING CLAUD` sample layer files. Use these with `wb_entity_create`.

| Prefab | GUID |
|--------|------|
| `Area.et` | `{C72F956E4AC6A6E7}` |
| `Layer.et` | `{5F9FFF4BF027B3A3}` |
| `LayerTaskKill.et` | `{2008B4EE6C4D528E}` |
| `LayerTaskClearArea.et` | `{CDC0845AD90BA073}` |
| `LayerTaskDestroy.et` | `{5EDF39860639027D}` |
| `SlotKill.et` | `{C70DC6CBD1AAEC9A}` |
| `SlotAI.et` | `{8D43830F02C3F114}` |
| `SlotClearArea.et` | `{E53456990A756229}` |
| `SlotDestroy.et` | `{7586595959BA2D99}` |

**Area trigger radius property:** `m_fAreaRadius` (NOT `m_fTriggerRadius`).

---

## MCP setProperty for SF Components

`wb_entity_modify setProperty` requires **two separate parameters**:
- `propertyPath` = component class name (e.g. `SCR_ScenarioFrameworkArea`)
- `propertyKey` = property name (e.g. `m_fAreaRadius`)

Passing the dotted form `"SCR_ScenarioFrameworkArea.m_fAreaRadius"` as `propertyPath` alone silently fails — `propertyKey` is required and must not be empty.

`SetVariableValue` returns false (not an error) when the entity was placed with the wrong GUID (e.g. using `{3AAECFCAE1BE0189}` = `Layer_Base.et` instead of the correct `Area.et` GUID). Always use the verified GUIDs above.

---

## MCP Entity Placement — Reparenting & Local Coords

**Rule:** Create child SF entities at world origin (`0 0 0`), then reparent using `ParentEntity(parent, child, false)`.

- `transformChildToParentSpace=false` keeps the child's local coords as `0 0 0` (sits at parent's origin).
- `transformChildToParentSpace=true` converts world pos to local — a child at world `0 0 0` with parent at `1872 37 1913` gets local `-1872 -37 -1913`, which is wrong.

**Correct sequence for each child:**
1. `wb_entity_create` (no position — defaults to world `0 0 0`)
2. `wb_entity_modify reparent` → child's local coords stay `0 0 0`

**What the entity inspector shows:** Local coords, not world. So `0 0 0` in inspector = correct (child is at parent's origin). The Area itself shows its world position.

**SlotKill vs SlotAI prefab types:**
- `SlotKill.m_sObjectToSpawn` → **character prefab** (e.g. `Character_USSR_Unarmed.et`). Using a group prefab causes `SCR_TaskKill.OnGroupEmpty` NULL pointer crash at runtime.
- `SlotAI.m_sObjectToSpawn` → **group prefab** (e.g. `Group_USSR_LightFireTeam.et`).
- `SlotKill.m_sWPToSpawn` → set to `{531EC45063C1F57B}Prefabs/AI/Waypoints/AIWaypoint_Wait.et` so the target stands in place.
