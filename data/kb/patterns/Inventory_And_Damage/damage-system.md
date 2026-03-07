# Damage System

---

## Class Hierarchy

```
HitZoneContainerComponent
DamageManagerComponent                        (engine-side)
    SCR_DamageManagerComponent                (script-side)
ExtendedDamageManagerComponent                (engine-side)
    SCR_ExtendedDamageManagerComponent        (script-side)
        SCR_CharacterDamageManagerComponent   (script-side)
```

---

## Damage Flow

1. Damage received.
2. `DamageManagerComponent` checks: damage handling enabled, not hijacked, valid hit, entity alive.
3. Sends damage to hit zone → hit zone calculates effective damage.
4. Replicates over network (clients calculate locally, display effects).
5. Deals damage → hit zone triggers `OnDamage()` → propagates to parent hit zones → DamageManager `OnDamage()`.
6. If DamageState unchanged → exit.
7. If DamageState changed → hit zone `OnDamageStateChanged()` → DamageManager `OnDamageStateChanged()`.

---

## Scripting Callbacks

| Callback | When |
|---|---|
| `OnDamage()` | After damage dealt; propagates to parent hit zones and DamageManager |
| `OnDamageStateChanged()` | When damage state changes; hit zone first, then DamageManager |
| `OnHealthSet()` | When `SetHealth()` called directly |
| `OnDamageEffectAdded()` | Damage-over-time/effect added (ExtendedDamageManager only) |
| `OnDamageEffectRemoved()` | Damage-over-time/effect removed (ExtendedDamageManager only) |

---

## ExtendedDamageManagerComponent — Replaced API

These methods do NOT exist on `ExtendedDamageManagerComponent`:

| Old (DamageManagerComponent) | Replacement |
|---|---|
| `OnDamageOverTimeAdded()` | `OnDamageEffectAdded()` |
| `OnDamageOverTimeRemoved()` | `OnDamageEffectRemoved()` |
| `IsDamagedOverTime()` | `SCR_CharacterDamageManagerComponent.IsBleeding()` |
| `GetDamageOverTime()` | `SCR_RegeneratingHitZone.GetHitZoneDamageOverTime()` or `SCR_CharacterBloodHitZone.GetTotalBleedingAmount()` |

Access persistent effects: `GetPersistentEffects()`, `GetAllPersistentEffectsOnHitZone()`, `GetAllPersistentEffectsOfType()`.

---

## SetHealth() Warning

`HitZone.SetHealth()` bypasses the full damage flow:
- Does NOT trigger `OnDamage()` or set an instigator.
- ONLY calls `OnHealthSet()` and `OnDamageStateChanged()`.
- Use only when you need to force a state even with damage handling disabled.

**Forcing death correctly:** Use `HandleDamage()` with a realistic damage amount — not always `maxHealth`. This maintains the full callback chain and is compatible with mods that have custom HP/damage multipliers.

**Mod compatibility pitfall:** Always deal a "realistic" damage amount. Dealing `maxHealth` true damage kills any character regardless of mod HP values — a Terminator-mod character inside an exploding vehicle shouldn't always die.
