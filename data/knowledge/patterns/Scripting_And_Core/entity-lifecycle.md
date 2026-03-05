# Entity Lifecycle, Events & Spawning

---

## Lifecycle Order — Critical

```
OnPostInit(owner)   → component is attached, world may not be fully loaded
EOnInit(owner)      → world is loaded, entity is fully in the world
EOnFrame(owner, dt) → every tick (only if EntityEvent.FRAME is set)
OnDelete(owner)     → entity being destroyed
```

### Key Rule: Schedule Deferred Work from OnPostInit, NOT EOnInit

`CallLater` called from inside `EOnInit` is unreliable — the callback may be silently dropped.

**Correct pattern:**
```c
override protected void OnPostInit(IEntity owner)
{
    super.OnPostInit(owner);
    GetGame().GetCallqueue().CallLater(Init, 500, false); // 500ms lets world finish loading
}

protected void Init()
{
    // safe to spawn entities, start repeating timers, etc.
    GetGame().GetCallqueue().CallLater(SpawnOne, m_fInterval * 1000, true);
}
```

---

## Event Masks

```c
SetEventMask(owner, EntityEvent.INIT);                     // enables EOnInit
SetEventMask(owner, EntityEvent.FRAME);                    // enables EOnFrame
SetEventMask(owner, EntityEvent.CONTACT);                  // enables EOnContact
SetEventMask(owner, EntityEvent.INIT | EntityEvent.FRAME); // combine with |
ClearEventMask(owner, EntityEvent.FRAME);                  // disable to save perf
```

---

## Callqueue Patterns

```c
// One-shot delayed call
GetGame().GetCallqueue().CallLater(MyMethod, delayMs, false);

// Repeating call
GetGame().GetCallqueue().CallLater(MyMethod, intervalMs, true);

// Cancel
GetGame().GetCallqueue().Remove(MyMethod);
```

Always cancel in `OnDelete` to avoid callbacks firing on a deleted entity.

**Multi-client decal spawning without RplComponent — confirmed pattern:**
Spawn decals locally on all clients by calling `SpawnEntityPrefab` from a deferred `CallLater`
in `OnPostInit`. Because the crater has `RplComponent (Broadcast)`, `OnPostInit` runs on every
client when the entity replicates. Decals need no `RplComponent` of their own.
Clean them up in `OnDelete` (also runs on all clients):
```c
override void OnPostInit(IEntity owner)
{
    super.OnPostInit(owner);
    m_aLocalDecals = new array<IEntity>();
    GetGame().GetCallqueue().CallLater(SpawnDecals, 100, false, owner); // all clients
    if (!Replication.IsServer()) return;
    // server-only work below...
}

override void OnDelete(IEntity owner)
{
    GetGame().GetCallqueue().Remove(SpawnDecals);
    foreach (IEntity decal : m_aLocalDecals) { if (decal) delete decal; }
    super.OnDelete(owner);
}
```

---

## Spawning Entities at Runtime

```c
Resource res = Resource.Load(m_rPrefab);
if (!res || !res.IsValid())
    return;

vector mat[4];
Math3D.MatrixIdentity4(mat);
mat[3] = spawnPosition;

EntitySpawnParams p = new EntitySpawnParams();
p.TransformMode = ETransformMode.WORLD;
p.Transform     = mat;

IEntity spawned = GetGame().SpawnEntityPrefab(res, owner.GetWorld(), p);
```

**Pitfall:** `SpawnEntityPrefab` called too early (e.g. directly in `EOnInit`) may silently fail.
Delay with `CallLater` from `OnPostInit`.

**Pitfall:** Entities spawned via `SpawnEntityPrefab` may not be immediately queryable
via `QueryEntitiesBySphere` — skip proximity checks for the first 1-2 spawns to let
the entity fully enter the world before trying to detect it.

---

## Resource Caching

```c
// Declare as ref member — NOT local variable
protected ref Resource m_NodeRes;

override protected void EOnInit(IEntity owner)
{
    m_NodeRes = Resource.Load(m_rPrefabPath);
}
```

Must be `ref` or GC drops the object before first use.
