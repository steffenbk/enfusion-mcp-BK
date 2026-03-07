# ScriptInvoker — Typed Event System

---

## Core Pattern

Never use raw `ScriptInvoker` directly — always use typed variants.

```c
// 1. Declare the method signature type
void ScriptInvokerIntMethod(int i);
typedef func ScriptInvokerIntMethod;
typedef ScriptInvokerBase<ScriptInvokerIntMethod> ScriptInvokerInt;

// 2. Declare in class — create lazily on first access
protected ref ScriptInvokerInt m_OnMyEvent;

ScriptInvokerInt GetOnMyEvent()
{
    if (!m_OnMyEvent)
        m_OnMyEvent = new ScriptInvokerInt();
    return m_OnMyEvent;
}

// 3. Fire the event
if (m_OnMyEvent)
    m_OnMyEvent.Invoke(42);

// 4. Subscribe
thing.GetOnMyEvent().Insert(MyHandler);

// 5. Unsubscribe
thing.GetOnMyEvent().Remove(MyHandler);
```

- `ScriptInvokerVoid` — for events with no arguments.
- **Create invokers lazily** — never allocate as default field values (wastes memory on unused events).
- Circular subscription causes infinite loops.

---

## Common Pre-built Invokers (via EventHandlerManagerComponent)

| Event | Source Component |
|---|---|
| `OnDestroyed` | `DamageManagerComponent` |
| `OnCompartmentEntered` / `OnCompartmentLeft` | `BaseCompartmentManagerComponent` |
| `OnWeaponChanged` / `OnMuzzleChanged` | `BaseWeaponManagerComponent` |
| `OnProjectileShot` | `BaseMuzzleComponent` |
| `OnDayStart` / `OnNightStart` | `TimeAndWeatherManagerEntity` |
| `OnMagazineCountChanged` | `InventoryStorageManagerComponent` |
| `OnLightStateChanged` | `BaseLightManagerComponent` |
| `OnTurretReload` | `TurretControllerComponent` |

Access pattern:
```c
EventHandlerManagerComponent evtMgr = EventHandlerManagerComponent.Cast(
    entity.FindComponent(EventHandlerManagerComponent));
if (evtMgr)
    evtMgr.GetOnDestroyed().Insert(OnDestroyed);
```
