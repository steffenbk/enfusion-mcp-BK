# Arma Reforger / Enfusion — Knowledge Base Index

## Base Game Data
All base game prefabs, scripts, configs extracted to: `E:\Arma reforger data\extracted_files\`
Structure: `Prefabs/`, `scripts/`, `Configs/`, `Missions/`, `Assets/` etc.
Use Glob/Grep/Read on this path to find any base game prefab path or script.

---

Two tiers:
- **patterns/** — condensed, confirmed, hands-on notes. Read relevant category before writing code.
- **reference/** — full wiki docs. Read only when patterns are insufficient for detail.

---

## Patterns

### GameModes_And_Scenarios
| File | Contents |
|---|---|
| [scenario-framework.md](patterns/GameModes_And_Scenarios/scenario-framework.md) | SF prefab hierarchy (Area/Layer/Slot), activation types, task types, trigger types, logic entities, QRF, game mode setup. Confirmed working baseline: ON_INIT=3, DynamicDespawn, hierarchy must be physically parented. |

### Scripting_And_Core
| File | Contents |
|---|---|
| [enforceScript-language.md](patterns/Scripting_And_Core/enforceScript-language.md) | Language quirks (no ternary, switch/default), component header convention, BaseContainerProps, no closures |
| [entity-lifecycle.md](patterns/Scripting_And_Core/entity-lifecycle.md) | Lifecycle order, event masks, callqueue patterns, spawning entities, resource caching |
| [multiplayer-replication.md](patterns/Scripting_And_Core/multiplayer-replication.md) | Server guard, RPC limitations, particle replication, proxy optimisation, angular velocity not replicating, CRC mismatch from stale server process |

### Tools_And_Workbench
| File | Contents |
|---|---|
| [workbench-plugins.md](patterns/Tools_And_Workbench/workbench-plugins.md) | WorldEditorPlugin structure, ScriptDialog/ButtonAttribute pattern, GetAbsolutePath, FileIO.MakeDirectory, CreateEntityTemplate |
| [mcp-net-api.md](patterns/Tools_And_Workbench/mcp-net-api.md) | EnfusionMCP NetApiHandler skeleton, SetVariableValue, reading properties, array operations, GUID fix, wb_launch resolution |

### Vehicles_And_Physics
| File | Contents |
|---|---|
| [physics-transforms.md](patterns/Vehicles_And_Physics/physics-transforms.md) | Physics API, transform helpers, parenting, debug shapes |
| [damage-vehicles.md](patterns/Vehicles_And_Physics/damage-vehicles.md) | Vehicle damage patterns |

### Terrain_And_Environment
| File | Contents |
|---|---|
| [world-environment.md](patterns/Terrain_And_Environment/world-environment.md) | Particle effects, wind API, surface material detection, spatial query, vegetation destruction |

### Character_And_Animation
| File | Contents |
|---|---|
| [gadgets-actions.md](patterns/Character_And_Animation/gadgets-actions.md) | SCR_FlashlightComponent pitfalls, SetEmissiveMultiplier, ScriptedUserAction pattern |
| [animation/INDEX.md](patterns/Character_And_Animation/animation/INDEX.md) | Full animation graph system — AGF nodes, vehicle animation, PAP/SIGA, script integration. See local index for task routing. |

---

## Reference (full wiki docs — read on demand only)

### GameModes_And_Scenarios
| File | Contents |
|---|---|
| [arma_reforger_scenario_framework_kb.md](reference/GameModes_And_Scenarios/arma_reforger_scenario_framework_kb.md) | Full SF wiki reference — all components, properties, actions, getters, plugins, samples, dynamic despawn, save/load, QRF, debug menu |
| [Scenario_Framework_Setup_Tutorial.md](reference/GameModes_And_Scenarios/Scenario_Framework_Setup_Tutorial.md) | Step-by-step SF setup tutorial from the Bohemia wiki |

---

## How to Use

1. Read this index at session start to identify relevant files.
2. Read the relevant `patterns/` file(s) before writing or suggesting code.
3. Only read `reference/` files when patterns lack sufficient detail.
4. At session end, save new confirmed patterns to the correct category file.
   - If no category fits, create a new file and add it to this index.
   - Do not duplicate existing entries.
