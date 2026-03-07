# Capture & Hold Game Mode

---

## Overview

Faction-based multi-player game mode. Teams capture and hold areas for points.

---

## Setup Workflow

**Base worlds:**
- Everon: `worlds/CaptureAndHold/CAH_BaseWorld.ent`
- Arland: `worlds/CaptureAndHold/CAH_BaseWorld_Arland.ent`

**Steps:**
1. Open base world in World Editor.
2. File → New World → **Sub-scene (of current world)**.
3. File → Save World As → save to mod `Worlds/` folder.

**Required prefabs:**

| Prefab | Path |
|---|---|
| `GameMode_CaptureAndHold.et` | `Prefabs/MP/Modes/CaptureAndHold/` |
| `FactionManager_USxUSSR.et` | `Prefabs/MP/Managers/Factions/` |
| `LoadoutManager_USxUSSR.et` | `Prefabs/MP/Managers/Loadouts/` |
| `CaptureAndHoldArea_Major.et` | `Prefabs/MP/Modes/CaptureAndHold/Areas/` |
| `SpawnPoint_US.et` | `Prefabs/MP/Spawning/` |
| `SpawnPoint_USSR.et` | `Prefabs/MP/Spawning/` |

After placing `SCR_CaptureAndHoldArea`: adjust shape, then test.

---

## Mission Header

1. Resource Browser → mod root → create `Missions/` directory.
2. Right-click → Create Resource → Config File → name it → class: `SCR_MissionHeader`.
3. Set `World` field to your `.ent` file. Fill metadata fields.

---

## Key Settings

| Setting | Location |
|---|---|
| Score Limit | `GameMode_CaptureAndHold > SCR_ScoringSystemComponent > Scoring:Actions > Score Limit` |
| Time Ending | `GameMode_CaptureAndHold > SCR_CaptureAndHoldManager > End Game Duration` (seconds) |
| Kill Feed | Enable in `GameMode_CaptureAndHold` (off by default) |
| Garbage System | `GameMode_CaptureAndHold > SCR_BaseGameMode > Garbage System Config` → override `GarbageSystem.conf`. Set class filters, "only destroyed", Lifetime, min player distance |

---

## Conflict Game Mode (reference)

**Objective:** Capture and hold N strategic positions within radio range for a set duration.

**Radio Range:** Radiates from Main Operating Base (MOB). Extended by: communication stations, relay towers, Mobile Command Units (MCUs).

**Seizing:** Maintain superior military presence near a command tent. More troops = faster capture.

**Respawn Options:** MOB, fully deployed MCU, radio operators (if server allows).

**Supply System:**
- Every deployment costs supplies. Cost reduced 50% by Living Quarters.
- Supplies stored at command tents/supply depots. Replenished slowly at MOB.
- Logistics: load from supply depot onto truck → drive to base → unload via Construction Interface.

**Buildable Structures:**

| Structure | Function |
|---|---|
| Vehicle Maintenance Points | Request vehicles for local supplies |
| Fuel Depot | Refueling; requested vehicles arrive full |
| Ammunition Supply Point | Ammo resupply |
| Field Hospital | Replenish first aid; heal others |
| Radio Relay Station | Extends base radio range |
| Living Quarters | Spawns AI patrol; reduces deployment cost 50% |
| Mobile Command Unit | Truck-based respawn + radio range extension (one active at a time) |

**Ranks:** Earned by seizing/resupplying bases, supporting friendlies, eliminating enemies. Higher ranks unlock better vehicles. Friendly fire causes demotion.
