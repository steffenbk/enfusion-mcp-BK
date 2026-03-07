# Damage & Vehicles

---

## Applying Scripted Fire Damage to Vehicles

### Vehicle Detection
Use `BaseVehicleControllerComponent` as the discriminator — common base for all driveable vehicles
(cars, tanks, APCs, helicopters, aircraft):

```c
BaseVehicleControllerComponent ctrl = BaseVehicleControllerComponent.Cast(ent.FindComponent(BaseVehicleControllerComponent));
if (!ctrl)
    return true; // not a vehicle
```

### Safe Damage-Over-Time Pattern
Use `HitZone.SetDamageOverTime(EDamageType.FIRE, dps)` on the **default hit zone only**.

```c
SCR_DamageManagerComponent dmgMgr = SCR_DamageManagerComponent.GetDamageManager(ent);
if (!dmgMgr)
    return;

HitZone hz = dmgMgr.GetDefaultHitZone();
if (hz && m_fDamageInterval > 0)
    hz.SetDamageOverTime(EDamageType.FIRE, m_fVehicleDamage / m_fDamageInterval);
```

**CONFIRMED CRASH:** Calling `SetDamageOverTime` via `GetAllHitZones()` or `GetAllHitZonesInHierarchy()`
crashes the engine (access violation at 0x0) because certain hit zone subtypes (blood zones,
physics-only zones, special vehicle sub-zones) do not support this method at the native level.
The script-level `if (hz)` null check does NOT protect against this — the object is non-null
but the native pointer it wraps is invalid.

**Rule: only call `SetDamageOverTime` on `GetDefaultHitZone()`.** It is the one zone the engine
guarantees is safe for scripted DoT calls.

### Always Clear DoT on Cleanup
`SetDamageOverTime` persists after the script entity that set it is deleted. Always zero it on death:

```c
HitZone hz = dmgMgr.GetDefaultHitZone();
if (hz)
    hz.SetDamageOverTime(EDamageType.FIRE, 0);
```

Call this in both the lifetime-expiry path and `OnDelete` (safety net for external deletion).

---

## Warhead Impact Damage — Prefab Overrides

### Replacing Inherited HE Explosion with Fire Explosion
`Warhead_Shell_HE.et` includes a full HE `ExplosionDamageContainer` (blast + fragmentation).
To replace it in a child prefab, add an override `ExplosionDamageContainer` block inside
`BaseTriggerComponent.PROJECTILE_EFFECTS`:

```
BaseTriggerComponent "{55129E81CBAA1390}" {
 PROJECTILE_EFFECTS {
  ExplosionDamageContainer "{5D8D1EB2400CDFFE}" : "{A0C3E936D43FA9E3}Prefabs/Weapons/Core/Damage/ExplosionContainer_Fire.conf" {
   TntEquivalent 0.05
  }
  SpawnPrefabEffect "{...}" {
   EffectPrefab "..."
  }
 }
}
```

- `ExplosionContainer_Fire.conf` GUID: `{A0C3E936D43FA9E3}` — incendiary + small blast, no fragmentation
- `TntEquivalent` controls blast radius: `0.175` = default fire, `0.05` = very small flash
- The override replaces the entire inherited `ExplosionDamageContainer` — no merge, full replace

---

## Correct Vehicle Fire System (SCR_FlammableHitZone)

`SetDamageOverTime` on vehicles is the wrong approach. Vehicles have a built-in fire system via
`SCR_FlammableHitZone` that handles smoke, particles, occupant damage, and destruction progression.

**Correct pattern:**
```c
SCR_FlammableHitZone flammable = SCR_FlammableHitZone.Cast(dmgMgr.GetDefaultHitZone());
if (!flammable)
{
    // Default hz may not be flammable — search all hit zones
    array<HitZone> allHz = {};
    dmgMgr.GetAllHitZones(allHz);
    foreach (HitZone candidate : allHz)
    {
        flammable = SCR_FlammableHitZone.Cast(candidate);
        if (flammable)
            break;
    }
}
if (flammable && dmgMgr.GetState() != EDamageState.DESTROYED)
{
    flammable.SetFireState(SCR_EBurningState.BURNING, -1);
    flammable.LockFireRate();
}
```

Note: Casting via `GetAllHitZones()` is safe — only `SetDamageOverTime` on non-leaf zones crashes.

---

## Character Fire Damage — HandleDamage Not SetDamageOverTime

`SetDamageOverTime(EDamageType.FIRE, dps)` does NOT reduce character health.
It registers the character with `FireDamageSystem`, but `UpdateFireDamage()` is an empty stub
in `SCR_DamageManagerComponent` — only overridden for vehicles.

**Correct pattern for characters:**
```c
// Call on each damage tick — dmg = dps * tick_interval
hz.HandleDamage(dps * TICK_INTERVAL, EDamageType.FIRE, null);
```

---

## QueryEntitiesBySphere — Deduplication Required

The sphere query returns **multiple child/bone entities per character/vehicle**. Without deduplication,
`HandleDamage` is called multiple times per entity per tick, massively multiplying damage.

**Pattern:**
```c
protected ref set<IEntity> m_DamagedThisTick = new set<IEntity>();

// In ApplyDamage():
m_DamagedThisTick.Clear();
world.QueryEntitiesBySphere(origin, radius, DamageQueryCallback, null, EQueryEntitiesFlags.ALL);

// In DamageQueryCallback():
IEntity root = ent;
IEntity parent = root.GetParent();
while (parent) { root = parent; parent = root.GetParent(); } // MUST use temp var — avoid null crash
if (m_DamagedThisTick.Contains(root)) return true;
m_DamagedThisTick.Insert(root);
```

**NULL crash pitfall:** `while (root.GetParent()) root = root.GetParent();` crashes when `GetParent()`
returns null (next iteration dereferences null `root`). Always store in a temp variable first.

---

## GetDamageManager on Vehicles — Use FindComponent

`SCR_DamageManagerComponent.GetDamageManager(owner)` can fail for some vehicle subtypes.
Prefer direct `FindComponent` which correctly handles all subclasses:

```c
// CORRECT — works for SCR_WheeledDamageManagerComponent, SCR_ArmorDamageManagerComponent, etc.
SCR_DamageManagerComponent dmgMgr = SCR_DamageManagerComponent.Cast(owner.FindComponent(SCR_DamageManagerComponent));

// RISKY — may fail for some vehicle types
SCR_DamageManagerComponent dmgMgr = SCR_DamageManagerComponent.GetDamageManager(owner);
```

---

## GetOnDamageStateChanged — Subscribing to Vehicle Destruction

```c
// Register (server-only):
SCR_DamageManagerComponent dmgMgr = SCR_DamageManagerComponent.Cast(owner.FindComponent(SCR_DamageManagerComponent));
dmgMgr.GetOnDamageStateChanged().Insert(OnDamageStateChanged);

// Callback signature — one param only:
protected void OnDamageStateChanged(EDamageState state)
{
    if (state != EDamageState.DESTROYED) return;
    // ...
}

// Cleanup in OnDelete:
dmgMgr.GetOnDamageStateChanged().Remove(OnDamageStateChanged);
```

---

## FireSpreadSpawner — Direction Set From Entity Transform

`FireSpreadSpawner.Init()` reads `mat[2]` (forward) and `mat[0]` (right) from the spawner entity's
world transform to set its spread direction. If spawned with an identity matrix, all spawners spread
in the same direction (world +Z).

**Fix when spawning multiple spawners programmatically:** give each one a random yaw rotation:

```c
float yaw = Math.RandomFloat(0, Math.PI2);
vector mat[4];
Math3D.MatrixIdentity4(mat);
mat[0] = Vector(Math.Cos(yaw),  0, Math.Sin(yaw));   // right
mat[2] = Vector(-Math.Sin(yaw), 0, Math.Cos(yaw));   // forward
mat[3] = pos;
```

---

## Staggering Multiple Entity Spawns

When spawning several prefabs at once (e.g. fire nodes on vehicle destruction), spawning all in one
frame looks fake. Pre-compute positions, then stagger via `CallLater` with increasing delays:

```c
// Pre-compute positions, store in arrays
m_aPendingPositions.Insert(pos);
int delayMs = i * (400 + Math.RandomInt(0, 400));   // 0ms, 400-800ms, 800-1600ms, etc.
GetGame().GetCallqueue().CallLater(SpawnNext, delayMs, false);

// In SpawnNext(): pop from front of array and spawn one entity
```

Always cancel pending calls in `OnDelete`: `GetGame().GetCallqueue().Remove(SpawnNext);`

---

## DamageArea Prefab — Does Not Filter by Entity Type

`SCR_DotDamageArea` (used by `DamageArea_base.et`) applies DoT to ALL `SCR_DamageManagerComponent`
owners equally — vehicles, infantry, everything. It does not have an entity-type filter.

To apply different damage rates to vehicles vs infantry, skip spawning the DamageArea prefab when
a vehicle is detected nearby and apply direct scripted damage instead.
