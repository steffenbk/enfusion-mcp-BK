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

## DamageArea Prefab — Does Not Filter by Entity Type

`SCR_DotDamageArea` (used by `DamageArea_base.et`) applies DoT to ALL `SCR_DamageManagerComponent`
owners equally — vehicles, infantry, everything. It does not have an entity-type filter.

To apply different damage rates to vehicles vs infantry, skip spawning the DamageArea prefab when
a vehicle is detected nearby and apply direct scripted damage instead.
