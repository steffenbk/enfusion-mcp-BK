# Vehicle Modding

---

## Key Components

| Component | Role / Key Properties |
|---|---|
| `SCR_VehicleDamageMangerComponent` | `HP Max`, `HP Damaged` (smoke threshold), `Collision Multiplier`, `Collision Velocity Threshold`, `Wreck Model`, destruction/burning particle resources |
| `FuelManagerComponent` | `SCR_FuelNode` array (one per tank): `Fuel Type`, `Max Fuel`, `Initial Fuel Tank State` |
| `SCR_FuelConsumptionComponent` | `Fuel Consumption` in liters/hour at max power RPM |
| `VehicleWheeledSimulation` | Engine (`Max Power` kW, `Max Torque` Nm), Clutch, Gearbox, Differentials, Axles (`Max Steering Angle` degrees) |
| `SCR_MotorExhaustEffectGeneralComponent` | Exhaust particle effect resource reference |
| `SlotManagerComponent` | Attaches turrets/parts: `EntityPrefab`, `AttachType: RegisteringComponentSlotInfo` |
| `ActionsManagerComponent` | Contextual actions |
| `MeshObject` | Mesh + materials |

---

## Faction Affiliation

Create inherited variant → change `FactionAffiliationComponent.Faction` to new faction name.
Required even without retexture — AI and game mode systems rely on it.

---

## Component Icon Types (in Object Properties)

| Icon | Type |
|---|---|
| Engine icon | Engine component (deep in Enfusion code) |
| Gear icon | Game component (game code) |
| Mixed icon | Hybrid component (engine + script) |
| Script icon | Scripted component (fully scripted) |
| Custom icon | Editor scripted component |

---

## Pitfalls

- Vehicle navmesh: vehicles need `NavmeshVehicle` layer on wheels/body for AI pathfinding.
- `VehicleSimple` layer for rough vehicle-static collision (building hit detection without detailed physics).
- Do not use `UTM_` (trimesh) colliders for vehicle bodies — use `UBX_` (box) or `UCX_` (convex) only.
- Wheel colliders: `Wheel` preset = `FireGeometry + CharCollide` — characters are pushed by wheels.
