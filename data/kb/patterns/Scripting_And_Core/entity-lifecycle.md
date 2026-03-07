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

---

## Entity Creation — Full Pattern

```c
[EntityEditorProps(category: "MyMod/Entities", description: "...", color: "0 0 255 255")]
class TAG_MyEntityClass : GenericEntityClass {}

class TAG_MyEntity : GenericEntity
{
    [Attribute(defvalue: "1", uiwidget: UIWidgets.Slider, desc: "Duration")]
    protected int m_iCycleDuration;

    void TAG_MyEntity(IEntitySource src, IEntity parent)
    {
        SetEventMask(EntityEvent.FRAME);
    }
}
```

- Class file must be in `scripts/Game` or it won't appear in World Editor Create tab.
- Entity class name must end with `Entity` suffix.
- Paired `EntityClass` declaration (`<Name>Class`) is required — omitting it makes the entity invisible in the editor.
- `EntityEditorProps` params: `category`, `color`/`color2`, `visible`, `style` (`"box"`,`"sphere"`,`"cylinder"`,`"capsule"`,`"pyramid"`,`"diamond"`), `sizeMin`/`sizeMax`, `dynamicBox`.

**Singleton pattern:**
```c
protected static TAG_MyEntity s_Instance;
void TAG_MyEntity(IEntitySource src, IEntity parent)
{
    if (s_Instance) { delete this; return; }
    s_Instance = this;
}
```

---

## Component Creation — Full Pattern

```c
[ComponentEditorProps(category: "MyMod", description: "...")]
class TAG_MyComponentClass : ScriptComponentClass {}

class TAG_MyComponent : ScriptComponent
{
    override protected void OnPostInit(IEntity owner)
    {
        super.OnPostInit(owner);
        SetEventMask(owner, EntityEvent.FRAME);  // note: owner param required for components
    }
}
```

- Component class name must end with `Component` suffix. File must be in `scripts/Game`.
- Paired `ComponentClass` declaration required.
- **Initialization goes in `OnPostInit`**, not the constructor.
- `SetEventMask` in a component takes `owner` as first param. In an entity it does not.
- `GetOwner()` works, but prefer the `owner` param passed to `EOn*` methods (guaranteed non-null).

**Spatial query from component:**
```c
owner.GetWorld().QueryEntitiesBySphere(origin, radius, MyCallback);
bool MyCallback(IEntity e) { return true; }  // true = include
```

---

## Full Lifecycle Table

| Phase | Entity | Component |
|---|---|---|
| Instantiation | Constructor | Constructor |
| | | `OnPostInit` |
| | `EOnInit` | `EOnInit` |
| WB edit | `_WB_SetTransform` | `_WB_SetTransform` |
| | `_WB_OnInit` | `_WB_OnInit` |
| | `_WB_MakeVisible` | — |
| WB loop | `_WB_AfterWorldUpdate` | `_WB_AfterWorldUpdate` |
| Sim init | `EOnActivate` | — |
| Sim loop | `EOnFrame` | `EOnFrame` |
| | `EOnDiag` (diag mode only) | `EOnDiag` |
| | `EOnFixedFrame` (30 Hz) | `EOnFixedFrame` |
| | `EOnSimulate` (60 Hz) | `EOnSimulate` |
| | `EOnPostSimulate` | `EOnPostSimulate` |
| | `EOnPhysicsMove` (60 Hz) | `EOnPhysicsMove` |
| | `EOnPostFrame` | `EOnPostFrame` |
| Destruction | `OnDelete` + Destructor | Destructor |

---

## Activeness (post-0.9.8)

- Since 0.9.8: setting `EntityEvent.FRAME` on a component automatically activates the parent entity — **do not manually set `EntityFlags.ACTIVE`**.
- Components are active by default (`EOnActivate` no longer called at spawn on components).
- Recommended activation/deactivation pattern:
```c
override void EOnActivate(IEntity owner)
{
    super.EOnActivate(owner);
    SetEventMask(owner, EntityEvent.FRAME);
}
override void EOnDeactivate(IEntity owner)
{
    super.EOnDeactivate(owner);
    ClearEventMask(owner, EntityEvent.FRAME);
}
```
- Each component manages its own event mask — do not rely on entity ACTIVE flag to propagate FRAME.

---

## Event Handlers (EOnPhysicsMove Warning)

`EOnPhysicsMove` may be called from a **non-main thread**. Never modify other entities inside this callback.

---

## ScriptInvoker (Events)

- Prefer typed invokers from `SCR_ScriptInvokerHelper` with `typedef` signatures over raw `ScriptInvoker`.
- **Create invokers lazily** (on first access via getter) — never as default field values.

**Common game events (via EventHandlerManagerComponent):**

| Event | Source |
|---|---|
| `OnDestroyed` | `DamageManagerComponent` |
| `OnCompartmentEntered/Left` | `BaseCompartmentManagerComponent` |
| `OnWeaponChanged` / `OnMuzzleChanged` | `BaseWeaponManagerComponent` |
| `OnProjectileShot` | `BaseMuzzleComponent` |
| `OnDayStart` / `OnNightStart` | `TimeAndWeatherManagerEntity` |
| `OnMagazineCountChanged` | `InventoryStorageManagerComponent` |
| `OnLightStateChanged` | `BaseLightManagerComponent` |
| `OnTurretReload` | `TurretControllerComponent` |

---

## User Actions (ActionsManagerComponent)

Required components on entity for user actions to work:
- `ActionsManagerComponent`
- `RplComponent`
- `MeshObject` with valid mesh
- `RigidBody` with Model Geometry enabled

**Scripted action base class:** `ScriptedUserAction`
```c
override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity) { }
override bool CanBeShownScript(IEntity user) { return true; }
override bool CanBePerformedScript(IEntity user) { return true; }
override bool HasLocalEffectOnlyScript() { return true; }
```
Script location: `Scripts/Game/generated/UserAction/Modded/TAG_MyAction.c`

Note: `ActionsManagerComponent` ≠ `ActionManager` — the former handles entity interactions, the latter handles input bindings.

---

## LOD

- LOD0 = highest quality. Higher number = lower quality at greater distance.
- Naming in FBX: append `_LODn` to mesh object names.
- LOD0→LOD1 switches based on object sphere size, triangle count, FOV, graphics settings.
- Ideal triangle reduction per step: ~50%.
- LOD Factors multiply effective triangle count for switching only (not actual geometry). Inherited through prefab hierarchy.
- Debug: `Alt+Win → Scene/Colorize objects LODs` in Diag Menu.

---

## Collision Layers Reference

Key layer presets (set via `usage` custom property in FBX):

| Preset | Use |
|---|---|
| `Building` / `BuildingFire` / `BuildingFireView` | Buildings |
| `Prop` / `PropFireView` | Props |
| `ItemFireView` | Small items (no character collision) |
| `Vehicle` / `VehicleFire` / `VehicleFireView` | Vehicles |
| `Wheel` | Vehicle wheels |
| `Door` / `DoorFireView` | Doors |
| `Tree` / `TreeFireView` | Tree trunks |
| `Bush` | Soft bush parts |
| `Ladder` | Ladders |
| `Weapon` | Weapons (no character collision) |
| `Terrain` | Terrain mesh |

Named layers: `Static`, `Dynamic`, `Character`, `CharCollide`, `CharNoCollide`, `FireGeometry`, `ViewGeometry`, `Projectile`, `Vehicle`, `Navmesh`, `Ragdoll`, `Foliage`, `Terrain`, `Water`, `Camera`.

---

## Environment Metrics (all values in cm)

| Action | Prone | Crouch | Stand |
|---|---|---|---|
| Pass under | 70 | 150 | 195 |
| Cover | 55 | 115 | 185 |
| Shoot over | 5 | 65 | 125 |
| Vault/Climb threshold | — | — | 145 |

Vehicles: small clearance ≥340 wide, large ≥440. Buildings: ceiling 270–330, door 125×237 (handle at 115). Stairs: max 45° slope, 19 cm step height. Ladder: 32 cm step height, 44 cm wide.
