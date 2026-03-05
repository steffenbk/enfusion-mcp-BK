# Arma Reforger: Scenario Framework — Knowledge Base

> **Source:** Bohemia Interactive Community Wiki  
> **URL:** https://community.bistudio.com/wiki/Arma_Reforger:Scenario_Framework  
> **Purpose:** MCP Knowledge Base Reference

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Basic Hierarchy](#basic-hierarchy)
4. [GameMode Manager Settings](#gamemode-manager-settings)
5. [Components](#components)
   - [Area](#area)
   - [Layer](#layer)
   - [LayerTask Types](#layertask-types)
   - [Slot Types](#slot-types)
6. [Shared Attributes](#shared-attributes)
7. [Plugins](#plugins)
8. [Logic Entities](#logic-entities)
9. [Getters](#getters)
10. [Actions](#actions)
11. [Dynamic Spawn/Despawn](#dynamic-spawndespawn)
12. [Faction Aliases](#faction-aliases)
13. [Save and Load](#save-and-load)
14. [QRF System](#qrf-system)
15. [Debug Menu](#debug-menu)
16. [Samples Reference](#samples-reference)
17. [Compositions](#compositions)
18. [1.1.0 Structural Changes](#110-structural-changes)

---

## Overview

The **Scenario Framework** provides scenario creators a simple way to build scenarios in the **World Editor** without scripting knowledge. The primary workflow is drag-and-drop of components with attribute configuration. Scripting knowledge allows further extension.

---

## Prerequisites

Use the **Game Mode Setup** World Editor Plugin with the `ScenarioFramework.conf` template.

### Required Prefabs

| Prefab | Purpose |
|--------|---------|
| `GameModeSF.et` | Core game mode |
| `SCR_AIWorld.et` | AI world setup |
| `FactionManager_USxUSSR.et` | Faction management |
| `LoadoutManager_USxUSSR.et` | Loadout management |
| `RadioManager.et` | Radio system |
| `PerceptionManager.et` | AI perception |
| `ScriptedChatEntity.et` | Chat system |
| `TaskManager.et` | Task management |

**Mission Header required:** `SCR_MissionHeaderCombatOps`

---

## Basic Hierarchy

```
Area
 └─ Layer / LayerTask
      └─ Slot / SlotTask / SlotAI / SlotTrigger
           └─ (Logic entities: LogicCounter, LogicOR, LogicSwitch)
```

| Level | Entity | Role |
|-------|--------|------|
| 1 | **Area** | Top-level container; handles Dynamic Spawn/Despawn and triggers |
| 2 | **Layer** | Hierarchical divider; can contain other layers or slots |
| 2 | **LayerTask** | Task-focused layer; manages task creation and workflow |
| 3 | **Slot** | Spawns prefabs; lowest level of hierarchy |
| 3 | **SlotTask** | Works with LayerTask for task-specific behavior |
| — | **Logic** | Receive inputs and activate further actions (Counter, OR, Switch) |

---

## GameMode Manager Settings

Primary component: **`SCR_GameModeSFManager`** on the `GameModeSF.et` prefab.

### Tasks

| Property | Description |
|----------|-------------|
| `Task Types Available` | Which task types can be randomly generated on start |
| `Max Number Of Tasks` | Max tasks spawned via random generation |
| `After Tasks Init Actions` | Actions activated after task generation finishes |

### Debug *(v1.1.0)*

| Property | Description |
|----------|-------------|
| `Core Areas` | Areas essential to the scenario; always spawn alongside Debug Areas |
| `Debug Areas` | Areas that spawn instead of random generation (for debugging) |

### Dynamic Spawn/Despawn *(v1.2.0)*

| Property | Description |
|----------|-------------|
| `Dynamic Despawn` | Enables/disables Dynamic Despawn globally (default: false) |
| `Update Rate` | How often spawn/despawn checks occur |
| `Voice Over Data Config` | Global voice over config for all VO actions *(v1.2.0)* |

---

## Components

All components are found in: `Prefabs/Scenario Framework/Components`

---

### Shared Attributes

#### Children Category

| Property | Options | Description |
|----------|---------|-------------|
| `Spawn Children` | `ALL`, `RANDOM_ONE`, `RANDOM_MULTIPLE`, `RANDOM_BASED_ON_PLAYER_COUNT` | Controls how many child layers spawn |
| `Random Percent` | number | Random chance for `RANDOM_MULTIPLE` |
| `Enable Repeated Spawn` | bool | Enables repeated spawning of children |
| `Repeated Spawn Number` | int (-1 = unlimited) | How many times children can respawn |
| `Repeated Spawn Timer` | float (-1 = disabled) | Frequency of repeated spawning |

#### Asset Category

| Property | Description |
|----------|-------------|
| `Faction Key` | Faction for this layer (default: "US"); propagates to children unless overridden |
| `Can Be Garbage Collected` *(v1.1.0)* | Whether spawned entity can be garbage-collected (default: true) |

#### Debug Category

| Property | Description |
|----------|-------------|
| `Show Debug Shapes During Runtime` | Shows colored sphere at layer position during play |
| `Show Debug Shapes In Workbench` | Shows colored sphere in World Editor |

#### Activation Category

**Activation Types:**

| Type | Behavior |
|------|----------|
| `SAME_AS_PARENT` | Activates same way as parent layer |
| `ON_TRIGGER_ACTIVATION` | Activated by trigger or trigger-type actions |
| `ON_AREA_TRIGGER_ACTIVATION` | Activated when parent area's trigger fires |
| `ON_INIT` | Activated immediately after creation |
| `ON_TASKS_INIT` | Activates after random task generation triggers |
| `CUSTOM1–4` | For modder-defined custom activation |

| Property | Description |
|----------|-------------|
| `Exclude From Dynamic Despawn` | Layer spawns but is never despawned by the system |

#### Activation Conditions *(v1.2.0)*

Conditions evaluated in order on init. All must pass (or use specified logic):

| Condition | Key Properties |
|-----------|----------------|
| `Character In Vehicle Condition` *(v1.2.0)* | Getter |
| `Day Time Condition` | Only During Day (bool) |
| `Day Time Hour Condition` | Min Hour, Max Hour |
| `Weather Condition` | Min/Max Wind Speed, Min/Max Rain Intensity |
| `Variable Value Condition` *(v1.2.6)* | Variable Name, Variable Value To Check |
| `Entity Damage State Condition` *(v1.2.1)* | Getter, Damage State |
| `AI Threat State Condition` *(v1.2.1)* | Entity, AI Threat State |
| `Entity Distance Condition` *(v1.2.1)* | Getter A, Getter B, Min/Max Distance |
| `Medical Condition` *(v1.2.1)* | Getter, Bleeding, Health, Tourniquet sub-conditions |
| `Task Status Condition` *(v1.2.1)* | Getter (LayerTask), Acceptable Task States |

**Activation Condition Logic** *(v1.2.1)*: `AND`, `OR`, `NOT`, `XOR`

#### OnActivation Category

| Property | Description |
|----------|-------------|
| `Activation Actions` | Actions executed in order after layer fully spawns |

---

### Area

Extends all Shared Attributes with:

| Property | Description |
|----------|-------------|
| `Dynamic Despawn` | Enable/disable Dynamic Spawn/Despawn for this area |
| `Dynamic Despawn Range` | Distance at which at least one observer triggers spawn/despawn |
| `Trigger Actions` | Actions executed when the Area's trigger activates |
| `Trigger Resource` | Which trigger prefab to use |
| `Area Radius` | Radius of the area trigger |
| `Once` | If true, trigger activates only once |

---

### Layer

No additional attributes beyond Shared Attributes.

---

### LayerTask Types

#### Common Task Properties

| Property | Description |
|----------|-------------|
| `Task Title` | Name shown in player task list |
| `Task Description` | Description shown in player task list |
| `Task Prefab` | Which task prefab to spawn |
| `Place Marker On Subject Slot` | Whether map marker appears on task subject slot |
| `Override Object Display Name` | Rename the task entity for display purposes |

**OnTaskFinished:**

| Property | Description |
|----------|-------------|
| `Trigger Actions On Finish` | Actions executed after task completes |

#### LayerTask Types Summary

| LayerTask | Paired Slot | Notes |
|-----------|-------------|-------|
| `LayerTask` (generic) | Any | Controlled entirely via Actions |
| `LayerTaskMove` | `SlotMoveTo` | Task Move |
| `LayerTaskDestroy` | `SlotDestroy` | Task Destroy |
| `LayerTaskKill` | `SlotKill` | Task Kill |
| `LayerTaskDefend` | `SlotDefend` | Task Defend (area or entity) |
| `LayerTaskClearArea` | `SlotClearArea` | Task Clear Area |
| `LayerTaskDeliver` | `SlotPick` + `SlotDelivery` | Task Deliver |

#### LayerTaskDefend Additional Properties

| Property | Description |
|----------|-------------|
| `Trigger Name` | Name of slot spawning the trigger |
| `Countdown Title Text` | Text above countdown number |
| `Defend Time` | Duration in seconds (-1 = indefinite) |
| `Display Countdown HUD` | Show countdown HUD |
| `Faction Settings` | Defender/Attacker factions with FactionKey and Count Only Players |
| `Min Defender Percentage Ratio` | Minimum defender ratio to succeed |
| `Attacker Layer Names` | Layers containing attacker AI (AI only) |
| `Earlier Evaluation` | Can finish before countdown if all attackers eliminated |
| `Delayed Evaluation` | Must eliminate all attackers to succeed |

#### LayerTaskDeliver Additional Properties

| Property | Description |
|----------|-------------|
| `Task Title Updated` | New title when task updates |
| `Task Description Updated` | New description when task updates |
| `Intel Map Marker Update Delay` | Delay between task marker position updates |

---

### Slot Types

#### Slot (generic)

| Property | Description |
|----------|-------------|
| `Object To Spawn` | Prefab to spawn |
| `Faction Switched Objects` *(v1.2.1)* | Spawn different prefab based on Faction Key |
| `ID` | Unique name for identification via Getters |
| `Use Existing World Asset` | Use existing world entity instead of spawning new |
| `Override Object Display Name` | Override display name for task purposes |

**Randomization:**

| Property | Description |
|----------|-------------|
| `Randomize Per Faction` | Randomize per Faction Key (overrides Object To Spawn) |
| `Entity Catalog Type` | Catalog type for random spawn |
| `Include Editable Entity Labels` | Labels to include in random pool |
| `Exclude Editable Entity Labels` | Labels to exclude from random pool |
| `Include Only Selected Labels` | If true, only spawn from included labels |

**Composition:**

| Property | Description |
|----------|-------------|
| `Ignore Orient Children To Terrain` | Skip terrain orientation for spawned composition |

#### SlotAI

| Property | Description |
|----------|-------------|
| `Balance On Players Count` | Scale AI group size to current player count |
| `Min Units In Group` | Minimum AIs after balancing |
| `AI Group Formation` | Group formation |
| `AI Skill` | Combat skill level |
| `AI Combat Type` | Combat behavior type |
| `Perception Factor` | Detection speed multiplier |
| `Group Prefab` | Default group prefab |
| `Waypoint Set` *(v1.1.0)* | Layer name containing waypoints |
| `Spawn AI on WP Pos` | Spawn AI at first waypoint position |
| `WP To Spawn` | Default waypoint if no Waypoint Set defined |

#### SlotTask

| Property | Description |
|----------|-------------|
| `Task Title` | Override parent LayerTask title |
| `Task Description` | Override parent LayerTask description |
| `Task Execution Briefing` | Text for Briefing Execution section |
| `Task Intro Voiceline` *(v1.1.0)* | StringID for intro VO |
| `Finish Conditions` *(v1.2.1)* | Conditions checked when finishing task |
| `Finish Condition Logic` *(v1.2.1)* | Boolean logic for finish conditions |

#### Slot Task Types

| Slot | Works With | Description |
|------|-----------|-------------|
| `SlotMoveTo` | `LayerTaskMove` | Spawns trigger for movement task |
| `SlotDestroy` | `LayerTaskDestroy` | Listens for entity destruction (including flooding) |
| `SlotKill` | `LayerTaskKill` | Like SlotDestroy but for AI characters |
| `SlotDefend` | `LayerTaskDefend` | Can spawn trigger (area) or entity (target defend) or both |
| `SlotClearArea` | `LayerTaskClearArea` | Spawns TriggerDominance |
| `SlotPick` | `LayerTaskDeliver` | Spawns item to be delivered |
| `SlotDelivery` | `LayerTaskDeliver` | Spawns TriggerCharacterSlow for item detection |
| `SlotExtraction` | `LayerTaskMove` | SlotMove variant with countdown mechanics |
| `SlotTrigger` | Any | Spawns trigger prefabs |
| `SlotPlayerTrigger` *(v1.2.0)* | Any | Pre-configured for player detection |
| `SlotMarker` *(v1.1.0)* | Any | Handles map markers (Marker Custom / Marker Military) |
| `SlotWaypoint` *(v1.1.0)* | SlotAI | Handles AI waypoints |

#### SlotWaypoint — Available Waypoints

Animation, Artillery Support, Attack, Capture Relay, Cycle, Defend, Defend CP, Defend Hierarchy, Defend Large, Defend Large CO, Deploy Smoke, Follow, Forced Move, Get In, Get In Nearest, Get Out, Heal, Loiter CO, Move, Observation Point, Open Gate, Patrol, Patrol Hierarchy, Scout, Search And Destroy, Smart Action, Suppress, User Action, Wait

**Cycling Waypoints:** Use the `Cycle` waypoint and either:
- Input layer name into "Layers With Waypoints To Cycle"
- Leave empty to auto-cycle all non-cycle waypoints in parent layer

---

## Plugins

Plugins attach additional functionality to slots.

| Plugin | Description |
|--------|-------------|
| `OnDestroyEvent` | Executes actions on asset destruction |
| `OnInventoryChange` | Executes actions on item add/remove from inventory |
| `SpawnPoint` *(v1.1.0)* | Spawn point properties + actions on use |
| `Trigger` | Configure spawned trigger attributes |

### Trigger Plugin Key Properties

| Property | Description |
|----------|-------------|
| `Area Radius` | Trigger coverage radius |
| `Activation Presence` | `PLAYER`, `ANY_CHARACTER`, `SPECIFIC_CLASS`, `SPECIFIC_PREFAB_NAME` |
| `Specific Entity Names` *(v1.3.0)* | Named entities to detect (OR combined) |
| `Specific Class Names` | Classnames to detect (OR combined) |
| `Prefab Filter` | Prefab filters (OR combined) |
| `Activated By This Faction` | Faction assignment (also filters presence check) |
| `Custom Trigger Conditions` | Specific Class Name Count, Specific Prefab Count |
| `Search Vehicle Inventory` | Detect entities inside vehicle inventories |
| `Once` | Activate only once vs. every time conditions are true |
| `Activate On Empty` *(v1.3.0)* | Activate when trigger is empty |
| `Update Rate` | Check frequency |
| `Minimum Players Needed Percentage` | Min player percentage for PLAYER presence |
| `Activation Countdown Timer` | How long conditions must hold before firing |
| `Notification Enabled` | Show notification |
| `Enable Audio` | Play audio |
| `Entity Entered Actions` *(v1.2.1)* | Actions on entity entering trigger |
| `Entity Left Actions` *(v1.2.1)* | Actions on entity leaving trigger |
| `Finished Actions` *(v1.2.1)* | Actions when all conditions met and trigger finishes |

---

## Logic Entities

### Shared Logic Attributes

**Input → Input Action:** Increases counter when conditions are true.

| Sub-type | Description |
|----------|-------------|
| `On Task Event Increase Counter` | Increase based on task event; optional Task Layer Name filter |
| `Check Entities In Trigger` | Increase based on entity count in trigger vs. comparison operator |
| `Check Entities In Area Trigger` | Same but targets Area instead of SlotTrigger |

**Comparison Operators:** `LESS_THAN`, `LESS_OR_EQUAL`, `GREATER_THEN`, `GREATER_OR_EQUAL`, `EQUAL`

### LogicCounter

Stores a count and executes actions on activation (reaching target count) or on increase.

| Property | Description |
|----------|-------------|
| `Count To` | Target count to trigger OnActivate actions |

### LogicOR / LogicSwitch

> ⚠️ Placeholder — planned features, not yet implemented.

---

## Getters

Getters retrieve entities or values for use in Actions.

| Getter | Returns | Key Properties |
|--------|---------|----------------|
| `GetArea` | `IEntity` | Area Name |
| `GetAreaTrigger` | `IEntity` | Area Name |
| `GetArrayOfPlayers` *(v1.2.0)* | `array<IEntity>` | Faction Keys (optional filter) |
| `GetClosestPlayerEntity` | `IEntity` | Getter (reference entity), Faction Keys |
| `GetCountEntitiesInTrigger` | `int` | Trigger Name |
| `GetEntityByName` | `IEntity` | Entity Name |
| `GetLastFinishedTaskEntity` | `IEntity` | — |
| `GetLayerBase` | `IEntity` | Layer Base Name |
| `GetLayerTask` | `IEntity` | Layer Base Name |
| `GetListEntitiesInTrigger` | `array<IEntity>` | Trigger Name |
| `GetPlayerEntity` | `IEntity` | — (first player; 1-player scenarios) |
| `GetArrayOfPlayers` *(v1.1.0)* | `array<IEntity>` | Faction Keys (optional filter) |
| `GetRandomLayerBase` *(v1.1.0)* | `array<IEntity>` | Name Of Layers list |
| `GetSpawnedEntity` | `IEntity` | Layer Name (Slot/SlotAI/SlotTrigger etc.) |
| `GetTask` | `IEntity` | Layer Task Name |
| `GetTopParentEntity` *(v1.3.0)* | `IEntity` | Getter |
| `GetVoiceOverActorEntity` *(v1.2.0)* | `IEntity` | Actor enum, Actor Entity |

---

## Actions

All actions share:
- **`Max Number of Activations`** — default -1 (unlimited); restrict as needed.
- If a single empty Getter exists, action auto-uses the slot's spawned entity.

### ActionAI *(v1.1.0)*

Target: `SlotAI` (via `GetLayerBase`) or auto-uses attached slot's AIs.

| Action | Description |
|--------|-------------|
| `Add Waypoint` | Add waypoint to AI queue |
| `On Waypoint Completed` | Execute actions when waypoint completes |
| `On Threat State Changed` *(v1.2.0)* | Execute actions on threat state change |
| `Set Max Autonomous Distance` *(v1.2.0)* | Set max investigation distance |
| `Set Skill` | Change AI skill in runtime |
| `Set Combat Type` | Change combat type in runtime |
| `Set Hold Fire` | Enable/disable hold fire |
| `Set Perception Factor` | Change perception speed |
| `Set Formation` | Change group formation |
| `Set Character Stance` | Change character stance |
| `Set Movement Type` | Change movement type |
| `Shoot Flare` *(v1.2.1)* | Order AI to shoot flare at target |

### ActionMedical

Target: `ChimeraCharacter`

| Action | Description |
|--------|-------------|
| `Add Particular Bleeding` | Bleed specific hit zone |
| `Add Random Bleeding` | Add random bleeding |
| `Remove All Bleedings` | Remove all bleedings |
| `Remove Group Bleeding` | Remove bleeding from hit zone group |
| `Set Bleeding Rate` | Set bleed rate |
| `Set Blood` | Set blood level |
| `Set Permit Unconsciousness` | Toggle unconsciousness |
| `Set Regeneration Rate` | Set regen rate |
| `Set Resilience` | Set unconsciousness resilience |
| `Set Saline Bagged Group` | Toggle saline bag on hit zone group |
| `Set Tourniquetted Group` | Toggle tourniquet on hit zone group |

### General Actions (Selected)

| Action | Version | Description |
|--------|---------|-------------|
| `Add Item To Inventory` | — | Add prefab items to entity inventory |
| `Add Score To CAH Faction` | v1.3.0 | Add score in Capture and Hold |
| `Append Briefing Entry Text` | — | Append text to briefing entry |
| `Change Layer Activation Type` | — | Change activation type at runtime |
| `Change Task State` | — | Change task state (uses `GetTask`) |
| `Change Task Title Or Description` | v1.2.1 | Update task title/description at runtime |
| `Change Time` | v1.3.0 | Change in-game time |
| `Change Trigger Activation Presence` | — | Change trigger presence type |
| `Change User Action Visibility` | v1.3.0 | Show/hide user actions |
| `Change Weather` | v1.3.0 | Change weather preset |
| `Compare Counter And Execute` | — | Compare counter value and run actions |
| `Count Inventory Items And Execute Action` | — | Count items and conditionally execute |
| `Damage Wheels` | v1.1.0 | Set vehicle wheel health |
| `Delete Entity` | — | ⚠️ Delete entity (irreversible) |
| `End Mission` | — | End mission with game-over type |
| `Action Based On Conditions` | v1.2.0 | Execute actions based on condition check |
| `Execute Function` | — | Call methods on objects (advanced/scripting) |
| `Fail Task If Vehicles In Trigger Destroyed` | — | Fail task if trigger vehicles are destroyed |
| `Feed Param To Task Description` | v1.1.0 | Feed prefab count params to task description |
| `Increment Counter` | — | Increment LogicCounter by 1 |
| `Decrease Logic Counter` | v1.2.0 | Decrease LogicCounter by 1 |
| `On User Action Event` | v1.2.0 | Listen to and react to user actions |
| `Voice Over Play Line` | v1.2.0 | Play single VO line |
| `Voice Over Play Sequence` | v1.2.0 | Play VO sequence |
| `Intro Voiceline Based On Tasks` | v1.1.0 | Play voiceline based on generated tasks |
| `Random Action` | v1.2.1 | Select and execute one random sub-action |
| `Kill Entity` | — | ⚠️ Kill entity (irreversible) |
| `Lock or Unlock All Target Vehicles In Trigger` | — | Lock/unlock vehicles in trigger |
| `Lock or Unlock Vehicle` | — | Lock/unlock specific vehicle |
| `Loop Over Not Randomly Selected Layers` | v1.1.0 | Act on layers not selected by `GetRandomLayerBase` |
| `On Compartment Entered Or Left` | v1.1.0 | Trigger actions on vehicle entry/exit |
| `On Engine Started Or Stop` | v1.1.0 | Trigger actions on engine state change |
| `Play Music` | — | Play music (requires MusicManager) |
| `Play Sound` | — | Play sound at player position |
| `Play Sound On Entity` | — | Play sound at entity position |
| `Prepare Area From Dynamic Despawn` | — | Add area to dynamic spawn/despawn |
| `Prepare Layer From Dynamic Despawn` | v1.3.0 | Add layer to dynamic spawn/despawn |
| `Process Voiceline Enum And String` | v1.1.0 | Process VO enum for intro voiceline |
| `Remove Area From Dynamic Despawn` | — | Remove area from dynamic spawn/despawn |
| `Remove Layer From Dynamic Despawn` | v1.3.0 | Remove layer from dynamic spawn/despawn |
| `Remove Item From Inventory` | — | ⚠️ Remove and delete items from inventory |
| `Reset Counter` | — | Reset counter to 0 |
| `Set Briefing Entry Text` | — | Set briefing text |
| `Set Briefing Entry Text Based On Generated Tasks` | — | Dynamically set briefing text by tasks |
| `Set Entity Position` | — | Teleport entity to coordinates |
| `Set Entity Scale` | — | Set entity scale |
| `Set Execution Entry Text Based On Generated Tasks` | — | Set execution text by generated tasks |
| `Set Faction to CAH Area` | v1.3.0 | Set faction for Capture and Hold area |
| `Set Fuel Consumption` | v1.2.1 | Set fuel consumption rates |
| `Set Fuel Percentage` | v1.1.0 | Set fuel percentage |
| `Set Supply Percentage` | v1.2.0 | Set supply percentage |
| `Set Signal` | v1.2.0 | Set signal value on entity |
| `Create Variable` | v1.2.0 | Create a named variable |
| `Set Variable` | v1.2.0 | Set a named variable value |
| `Get Variable Value` | v1.2.0 | Retrieve a named variable |
| `Item Safeguard` | v1.2.0 | Protect important items from garbage collection |
| `Set Mission End Screen` | — | Set mission end screen type |
| `Set Vehicle Cruise Speed` | — | Set vehicle max cruise speed (AI only) |
| `Show Hint` | — | Display hint with title, text, and timeout |
| `Show Popup Notification` | v1.1.0 | Display popup notification |
| `Spawn Closest Object From List` | — | Spawn the nearest layer from a list |
| `Spawn Objects` | — | Spawn layers by name (`ON_TRIGGER_ACTIVATION`) |
| `Spawn Objects Based On Distance` | v1.1.0 | Spawn objects filtered by distance |
| `Toggle Engine` | v1.1.0 | Start/stop entity engine |
| `Toggle Light` | v1.1.0 | Toggle entity lights |
| `Wait And Execute` | — | Delay actions with optional randomization and looping |

---

## Dynamic Spawn/Despawn

- Operates on **Areas**; saves performance by only spawning nearby content.
- Default check interval: **4 seconds** (configurable on `SCR_GameModeSFManager`).
- Spawning is staggered to prevent stutters.
- Each Area has a **range**; if any player is within range, Area and `SAME_AS_PARENT` children spawn.
- **`Exclude From Dynamic Despawn`** on a layer prevents it from despawning once spawned (e.g., spawn points, occupied vehicles).
- AI and Slot positions are saved; killed AI / destroyed vehicles are not respawned.
- Randomization results are saved across despawn/spawn cycles.

---

## Faction Aliases *(v1.2.1)*

Create aliases for faction keys that can be changed in World Editor or by server admins via Mission Header.

### Configuration Steps

1. Add `SCR_FactionAliasComponent` to `FactionManager` in world.
2. Create aliases and assign default Faction Keys.
3. Mirror setup in Mission Header.
4. Use Faction Aliases instead of Faction Keys in Scenario Framework.
5. Use Randomization with Faction Catalogs or `Faction Switched Objects` for faction-specific spawning.

---

## Save and Load

Requires `SCR_SaveLoadComponent` on GameMode + `SCR_ScenarioFrameworkStruct` added to it.

Serialization saves **only changes from Workbench defaults**.

### Serialized Data

| Category | Saved Data |
|----------|-----------|
| **Basics** | In-game time, weather state, scenario ended flag |
| **Layer** | Randomly spawned objects, randomly spawned children, task states, termination status, Repeated Spawn Number |
| **Area** | Inherits Layer data + ON_TASKS_INIT selection, delivery point, attached LayerTask |
| **Logic** | Counter value, termination status |

---

## QRF System

**QRF (Quick Reaction Force)** — Responds to player actions by sending escalating reaction forces.

### Setup Steps

1. Create an **Area** for QRF to monitor.
2. Open the `SCR_ScenarioFrameworkArea` component on the Area.
3. In **Activation Actions**, add `SCR_ScenarioFrameworkActionQRFDispacher` (or use pre-made config).
4. Configure QRF groups and costs.
5. Drag/drop QRF spawn point layer prefab onto the Area.
6. Copy spawn point layer name → paste into **QRF Layer Name** field.
7. Move spawn point to desired location (use **Snap to Ground**).
8. Configure spawn point: what spawns, minimum player distance.
9. Add more spawn point prefabs to QRF layer if needed.

---

## Debug Menu *(v1.2.1)*

### Enabling

1. Open Debug Menu → **Systems > Systems diag** → set to `basic`
2. Change System points to `FixedFrame`
3. Tick **SCR_ScenarioFrameworkSystem**
4. *(Must repeat every game launch)*
5. Find **ScenarioFramework** category in debug menu root.

### Debug Tools

| Tool | Description |
|------|-------------|
| **Tasks** | List active tasks; inspect Area/LayerTask/SlotTask; finish or restore tasks |
| **Registered Areas** | List valid areas; inspect area (opens Layer Inspector) |
| **Debug Areas** | View/add/remove Debug Area entries; preview task combinations; reinit framework |
| **Layer Inspector** | Inspect any layer: init status, termination, spawn progress, hierarchy, plugins/actions/conditions; teleport; restore defaults |
| **Action Inspector** | Inspect actions on a layer; enable debug breakpoints; re-init/activate actions |
| **Logic Inspector** | Inspect logic entities; enable debug breakpoints; view/modify counter values |
| **Plugin Inspector** | Inspect plugins on a layer; enable debug breakpoints; control trigger periodic queries |
| **Condition Inspector** | Inspect conditions on a layer; enable debug breakpoints; check condition true/false |

---

## Log Messages

| Prefix | Severity | Meaning |
|--------|----------|---------|
| *(none)* | Info | Normal operation messages |
| `(W)` | Warning | Improper usage; hints at misconfiguration |
| `(E)` | Error | Technical failure; may not be user fault |

All messages contain the word **"Scenario Framework"**.

---

## Samples Reference

Located in `/worlds/ScenarioFramework/Samples/`

| Sample | Goal |
|--------|------|
| `TaskMove` | Basic movement task (Area → LayerTaskMove → SlotMoveTo) |
| `TaskKill` | Kill target task (Area → LayerTaskKill → SlotKill) |
| `TaskExfil` | Extraction task with countdown (SlotExtraction, 20s timer) |
| `TaskDestroyRock` | Destroy world entity using `Use Existing World Asset` |
| `TaskDestroy` | Destroy spawned vehicle (Area → LayerTaskDestroy → SlotDestroy) |
| `TaskDeliverIntel` | Deliver specific intel item to trigger |
| `TaskDefendTarget` | Defend entity for countdown duration |
| `TaskDefendArea` | Hold area majority against repeated enemy waves |
| `TaskDefendAreaAndTarget` | Combine area and target defense simultaneously |
| `TaskClearArea` | Clear area using TriggerDominance |
| `PatrollingGroup` | AI patrol on cycled waypoints (indefinite) |
| `FinishTaskToCreateTask` | Sequential tasks via LogicCounter + Spawn Objects |
| `EndScreenBasedOnCompletedTasks` | Dynamic end screen based on task completion count |
| `DynamicDespawn` | Dynamic Spawn/Despawn with random task and flag selection |
| `DetectPrefabInTrigger` | Detect specific prefab counts in trigger (Custom Trigger Conditions) |
| `DeliverWeaponsToCrate` | Count weapons in crate inventory via OnInventoryChange plugin |
| `DeliverWeaponsInVehicle` | Deliver weapons via vehicle; detect in vehicle inventory |
| `GenericTask` *(v1.2.0)* | User action–triggered task (toilet flush example) |
| `Waypoints` *(v1.2.0)* | Sequence of different AI waypoints with actions on completion |
| `LastStand` | Sequential defend stages; each unlocked by previous stage finish |
| `TutorialFull` | Full mission walkthrough combining multiple framework features |

---

## Compositions

Pre-built Scenario Framework component groups for quick scenario building.

Available as compositions for each sample task type:

- TaskMove, TaskKill, TaskExfil, TaskDestroy
- TaskDeliverVehicles, TaskDeliverIntel
- TaskDefendTarget, TaskDefendAreaAndTarget, TaskDefendArea
- TaskClearArea

---

## 1.1.0 Structural Changes

> ⚠️ A **Scenario Framework Update Plugin** is provided to automatically migrate 1.0.0 scenarios.

### Key Changes

| Old | New | Status |
|-----|-----|--------|
| `Waypoint Group Names` | `Waypoint Set` | Deprecated; will be removed in future version |
| Normal Slots for waypoints | `SlotWaypoint` (specialized) | New — full waypoint attribute API |

### Cycling Waypoints (New Method)

1. Select **Cycle** waypoint type.
2. Either:
   - Input the layer name containing SlotWaypoints into `Layers With Waypoints To Cycle`
   - OR leave empty to auto-cycle all non-cycle waypoints in the parent layer.

---

## Quick Reference: Hierarchy Checklist

```
✅ GameModeSF.et placed in world
✅ SCR_AIWorld.et placed
✅ FactionManager_USxUSSR.et placed
✅ LoadoutManager_USxUSSR.et placed
✅ TaskManager.et placed
✅ SCR_MissionHeaderCombatOps set in Mission Header
✅ Area created and positioned
✅ LayerTask added under Area (choose type based on task)
✅ Slot/SlotTask added under LayerTask
✅ Faction Key set appropriately
✅ Activation Type set correctly
✅ Actions/Getters configured as needed
```

---

*Last updated from wiki snapshot: July 22, 2025*
