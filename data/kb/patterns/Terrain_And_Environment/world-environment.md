# World, Environment & Effects

---

## Particle Effects

```c
ParticleEffectEntitySpawnParams ptcParams = new ParticleEffectEntitySpawnParams();
ptcParams.TransformMode = ETransformMode.WORLD;
ptcParams.PlayOnSpawn   = true;
ptcParams.Parent        = owner;       // particle follows the entity
ptcParams.AutoTransform = true;
owner.GetWorldTransform(ptcParams.Transform);

ParticleEffectEntity ptc = ParticleEffectEntity.SpawnParticleEffect(m_rParticleEffect, ptcParams);
```

**Looping a particle that doesn't have a built-in loop:**
No script-accessible loop flag exists. Workaround: store the reference and respawn on a timer:
```c
GetGame().GetCallqueue().CallLater(RestartParticle, m_fLoopInterval * 1000, true);

protected void RestartParticle()
{
    if (m_Particle)
    {
        SCR_EntityHelper.DeleteEntityAndChildren(m_Particle);
        m_Particle = null;
    }
    PlayParticle(GetOwner());
}
```

---

## Wind API

```c
// Correct pattern — confirmed from game source (SCR_WindDirectionEditorAttribute):
ChimeraWorld world = ChimeraWorld.CastFrom(owner.GetWorld()); // Cast not supported — must use CastFrom
TimeAndWeatherManagerEntity weatherMgr = world.GetTimeAndWeatherManager();
if (weatherMgr)
{
    float windSpeed  = weatherMgr.GetWindSpeed();     // m/s
    float windDirDeg = weatherMgr.GetWindDirection(); // degrees, "blows FROM" (meteorological)
}
```

**CONFIRMED WORKING approach — use `LocalWeatherSituation.GetLocalWindSway()` for direction:**
```c
LocalWeatherSituation lws = new LocalWeatherSituation();
if (weatherMgr.TryGetCompleteLocalWeather(lws, 1.0, owner.GetOrigin()))
{
    vector windSwayRaw = lws.GetLocalWindSway();
    float wx = windSwayRaw[0];
    float wz = windSwayRaw[2];
    float wLenSq = wx * wx + wz * wz;
    float wLen = Math.Pow(wLenSq, 0.5);
    if (wLen > 0.0001)
    {
        vector windDir = Vector(-(wx / wLen), 0, -(wz / wLen)); // negate — sway points INTO wind, we want downwind direction
    }
}
```
- `GetLocalWindSway()` returns a tiny magnitude vector (~0.1-0.7) — normalize manually using raw X/Z components
- Do NOT use `vector[1] = 0` to zero Y — it corrupts the whole vector. Extract X/Z as floats instead.
- `Math.Sin`, `Math.Cos`, `Math3D.AnglesToMatrix` all return ~0 — unusable for direction math in script components
- `GetWindDirection()` angle conversion is also unreliable — use sway vector instead
- **Direction:** XZ components point INTO the wind (source direction). Negate to get downwind spread direction. Confirmed correct in testing.

---

## Surface Material Detection via TraceParam

```c
TraceParam tp = new TraceParam();
tp.Start   = pos + Vector(0, 0.5, 0);
tp.End     = pos - Vector(0, 5.0, 0);
tp.Flags   = TraceFlags.WORLD | TraceFlags.ENTS;
tp.Exclude = GetOwner();

float frac = world.TraceMove(tp, null);
if (frac < 1.0 && tp.SurfaceProps)
{
    string matName = tp.SurfaceProps.GetName();
    matName.ToLower();
    if (matName.IndexOf("grass") != -1) { ... }
    if (matName.IndexOf("dirt")  != -1) { ... }
}
```

**Known material name patterns (confirmed in-game):**
- `common/materials/game/dirt.gamemat`
- `common/materials/game/grass_lush_tall.gamemat`

---

## Spatial Entity Query

```c
// Member callback pattern (no closures in EnforceScript):
protected bool m_bFoundTarget;

protected void DoQuery(vector origin, BaseWorld world, float radius)
{
    m_bFoundTarget = false;
    world.QueryEntitiesBySphere(origin, radius, QueryCallback, null, EQueryEntitiesFlags.ALL);
}

protected bool QueryCallback(IEntity ent)
{
    if (m_bFoundTarget)
        return false; // stop early

    if (ent && ent.FindComponent(MyComponent))
    {
        m_bFoundTarget = true;
        return false;
    }
    return true;
}
```

**Pitfall — QueryEntitiesBySphere returns ALL entities in range**, including warheads,
projectiles, characters, fire nodes, decals. Always filter early:
```c
// Fast-exit using prefab path as a folder gate:
EntityPrefabData pd = ent.GetPrefabData();
if (!pd)
    return true;
string path = pd.GetPrefabName();
path.ToLower();
if (!path.Contains("prefabs/vegetation"))
    return true; // skip everything outside the folder of interest
```

---

## Vegetation Destruction

### Trees vs Bushes — Engine Type Alone is Not Enough

`BaseTree.Cast(ent)` succeeds for BOTH actual trees AND bushes.
Use the prefab path to distinguish, and use `HandleDamage` for BOTH on dedicated server —
`SCR_EntityHelper.DeleteEntityAndChildren` silently fails on world-placed static vegetation on dedi:
```c
bool isBush = pathLower.Contains("prefabs/vegetation/bush");
if (isBush)
{
    BaseTree bush = BaseTree.Cast(ent);
    if (bush)
    {
        vector hitPosDirNorm[3];
        hitPosDirNorm[0] = ent.GetOrigin();
        hitPosDirNorm[1] = Vector(0, -1, 0);
        hitPosDirNorm[2] = Vector(0, -1, 0);
        bush.HandleDamage(EDamageType.FIRE, 999999, hitPosDirNorm);
    }
    return true;
}
// Real trees:
BaseTree tree = BaseTree.Cast(ent);
if (tree)
{
    vector hitPosDirNorm[3];
    hitPosDirNorm[0] = ent.GetOrigin();
    hitPosDirNorm[1] = Vector(0, -1, 0);
    hitPosDirNorm[2] = Vector(0, -1, 0);
    tree.HandleDamage(EDamageType.FIRE, 999999, hitPosDirNorm);
}
```

### Prefab Path Structure (confirmed)
- Trees:  `{GUID}Prefabs/Vegetation/Tree/<species>/<name>.et`
- Bushes: `{GUID}Prefabs/Vegetation/Bush/<name>.et`

### Prevent Repeat HandleDamage on the Same Tree
```c
protected ref set<IEntity> m_sDamagedTrees = new set<IEntity>();

if (m_sDamagedTrees.Contains(ent))
    return true;
m_sDamagedTrees.Insert(ent);
tree.HandleDamage(...);
```

### Bushes Cannot Be Removed via Script on Dedicated Server — Confirmed Engine Limitation
Neither `SCR_EntityHelper.DeleteEntityAndChildren` nor `BaseTree.HandleDamage` nor `GenericEntity.Show(false)`
removes world-placed bushes on a dedicated server. Only actual trees respond to `HandleDamage`.
Accept this limitation and skip bush removal entirely in server-side scripts.
