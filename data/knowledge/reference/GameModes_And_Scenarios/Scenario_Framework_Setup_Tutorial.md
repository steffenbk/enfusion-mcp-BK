# Scenario Framework Setup Tutorial – Arma Reforger

**Category:** Arma Reforger / Modding / Scenario / Tutorials  
**Source:** [Bohemia Interactive Community Wiki](https://community.bistudio.com/wiki/Arma_Reforger:Scenario_Framework_Setup_Tutorial)

> This tutorial shows how to setup ScenarioFramework for a new world and create a simple scenario. It is recommended to also read through the [Scenario Framework documentation](https://community.bistudio.com/wiki/Arma_Reforger:Scenario_Framework).

---

## World Setup

1. Open **World Editor** and load the world of your choice via **File > Load World** (`Ctrl + O`).  
   - This tutorial uses: `enfusion://WorldEditor/worlds/Arland/Arland.ent`

2. Create a new world via **File > New World** (`Ctrl + N`).  
   - In the popup, select **"Sub-scene (of current world)"** and click **OK**.

3. Save the file via **File > Save World** (`Ctrl + S`).  
   - Follow the same directory structure as Arma Reforger:  
     `MyModDirectory\worlds\WorldName\WorldName.ent`

---

## Scenario Framework Setup

Open the **Game Mode Setup** plugin via **Plugins > Game Mode Setup**.

1. Use the `..` button in the **Template** field to target:  
   `enfusion://ResourceManager/~ArmaReforger:Configs/Workbench/GameModeSetup/ScenarioFramework.conf`  
   Click **Next**.

2. **World Scan** screen: For a clean world copy, click **Skip**.

3. **World Configuration** screen: Click **Create entities** to generate all required entities.

4. **World Configuration Completed** screen: Review any issues, then click **Next**.

5. **Mission Header** screen: Click **Create header** so the scenario appears in the main menu's scenario list. Click **Next**, then **Close**.

The created entities will appear in the current layer.

---

## Scenario Framework Usage

### Spawn Area Creation

Before creating tasks and workflows, add a spawn for the player.

1. Create a layer named **"Start"** by right-clicking on the world's subscene in the **Hierarchy** panel.
2. Set it as the active layer: right-click > **"Set as active"** (or double-click).
3. Add a **Scenario Framework Area** by dragging from:  
   `ArmaReforger/Prefabs/Systems/ScenarioFramework/Components/`  
   Prefab: `Area.et`  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/ScenarioFramework/Components/Area.et`

4. Drag a **Layer** and drop it onto the Area in the Hierarchy panel (making it a child entity).

5. Drag a **Slot** onto the Layer. The hierarchy should look like:
   ```
   Start*
   └── Area1          (Area / GenericEntity)
       └── Layer1     (Layer / GenericEntity)
           └── Slot1  (Slot / GenericEntity)
   ```

6. Select **Slot1** in the Hierarchy tab → find the `SCR_ScenarioFrameworkSlotBase` component in the **Object Properties** panel.

7. Under **Asset**, click `..` for **Object To Spawn** and assign:  
   `SpawnPoint_US.et`  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/MP/Spawning/SpawnPoint_US.et`

8. Press `Ctrl + S` to save. Test with the **Play button** (`F5`).

---

### Adding Arsenal and Vehicle Slots

Add additional Slots under the same Layer:

- **Arsenal Box:**  
  `ArsenalBox_US.et`  
  `enfusion://ResourceManager/~ArmaReforger:Prefabs/Props/Military/Arsenal/ArsenalBoxes/US/ArsenalBox_US.et`

- **Vehicle (standard):**  
  `M1025.et`  
  `enfusion://ResourceManager/~ArmaReforger:Prefabs/Vehicles/Wheeled/M998/M1025.et`

- **Vehicle (camo):**  
  `M1025_MERDC.et`  
  `enfusion://ResourceManager/~ArmaReforger:Prefabs/Vehicles/Wheeled/M998/M1025_MERDC.et`

Final Start layer hierarchy:
```
Start
└── Area1            (Area / GenericEntity)
    └── Layer1       (Layer / GenericEntity)
        ├── ArsenalBox  (Slot / GenericEntity)
        ├── Humvee      (Slot / GenericEntity)
        └── SpawnPoint  (Slot / GenericEntity)
```

---

### Add a Move Task

1. Create a layer named **"FirstTask"** and set it as active.
2. Create an **Area** at a suitable location (drag from Components folder).
3. Instead of a plain Layer, drag and drop:  
   `LayerTaskMove.et`  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskMove.et`  
   into the new Area.

4. Drag and drop a **SlotMoveTo** into the LayerTaskMove:  
   `SlotMoveTo.et`  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotMoveTo.et`

5. The slot's larger sphere visualises the **trigger radius** for the Task Move.

6. Launch the game (`F5`), open the map, and open the **Task List** (`J`) to see the task. Moving your character into the trigger completes the objective.

---

### Add a Random Destroy Task

Triggered after completing the Move Task.

1. Create a layer named **"SecondTask"** and set it as active.
2. Create a new **Area**.
3. Add a `LayerTaskDestroy.et` under the Area hierarchy:  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskDestroy.et`

4. Select the `SCR_ScenarioFrameworkLayerTaskDestroy` component and set:
   - **Spawn Children** → `RANDOM_ONE`
   - **Activation Type** → `ON_TRIGGER_ACTIVATION`

5. Add **two Layers** under the LayerTaskDestroy hierarchy.

6. Under each Layer, add a `SlotDestroy.et`:  
   `enfusion://ResourceManager/~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotDestroy.et`

7. Assign **Object To Spawn** for each SlotDestroy:
   - **SlotDestroy1:** `UAZ469.et`  
     `enfusion://ResourceManager/~ArmaReforger:Prefabs/Vehicles/Wheeled/UAZ469/UAZ469.et`
   - **SlotDestroy2:** `Ural4320_transport_covered.et`  
     `enfusion://ResourceManager/~ArmaReforger:Prefabs/Vehicles/Wheeled/Ural4320/Ural4320_transport_covered.et`

8. Go back to **FirstTask** layer → select **LayerTaskMove1** → click its `SCR_ScenarioFrameworkLayerTask` component → under **OnTaskFinished**, click `+` to add an action:
   - Search for **"SpawnObjects"** → select `SCR_ScenarioFrameworkActionSpawnObjects`
   - Expand the action → click `+` under **Name Of Objects To Spawn On Activation**
   - Input `LayerTaskDestroy1` as the first item

> **Result:** Task Destroy will not spawn until Task Move is completed. With `RANDOM_ONE` and two child layers, it randomly picks one of the two SlotDestroy options, reducing repetitiveness.

---

### Add a Game Over

1. In **OnTaskFinished** on **LayerTaskDestroy1**, add an **EndMission** action.
2. Tick the **Override Game Over Type** checkbox.
3. Set **Game Over Type** to `FACTION_VICTORY_SCORE` — this ends the mission upon completing Task Destroy.

---

## Key Prefab Reference

| Asset | Path |
|---|---|
| ScenarioFramework config | `~ArmaReforger:Configs/Workbench/GameModeSetup/ScenarioFramework.conf` |
| Area | `~ArmaReforger:Prefabs/ScenarioFramework/Components/Area.et` |
| LayerTaskMove | `~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskMove.et` |
| LayerTaskDestroy | `~ArmaReforger:Prefabs/ScenarioFramework/Components/LayerTaskDestroy.et` |
| SlotMoveTo | `~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotMoveTo.et` |
| SlotDestroy | `~ArmaReforger:Prefabs/ScenarioFramework/Components/SlotDestroy.et` |
| SpawnPoint_US | `~ArmaReforger:Prefabs/MP/Spawning/SpawnPoint_US.et` |
| ArsenalBox_US | `~ArmaReforger:Prefabs/Props/Military/Arsenal/ArsenalBoxes/US/ArsenalBox_US.et` |
| M1025 (Humvee) | `~ArmaReforger:Prefabs/Vehicles/Wheeled/M998/M1025.et` |
| UAZ469 | `~ArmaReforger:Prefabs/Vehicles/Wheeled/UAZ469/UAZ469.et` |
| Ural4320 (covered) | `~ArmaReforger:Prefabs/Vehicles/Wheeled/Ural4320/Ural4320_transport_covered.et` |

---

*Retrieved from the Bohemia Interactive Community Wiki. See [Scenario Framework documentation](https://community.bistudio.com/wiki/Arma_Reforger:Scenario_Framework) for more details.*
