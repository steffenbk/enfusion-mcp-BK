# Multiplayer & Replication

---

## Server Guard — Use RplComponent, Not IsMaster

`SCR_BaseGameMode.IsMaster()` can return false in some host configurations.
The reliable pattern used across base game scripts:
```c
RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
if (rpl && rpl.IsProxy())
    return; // only runs on server/host
```

Proxy optimisation — cache in `EOnInit` and clear FRAME mask on proxies:
```c
protected bool m_bIsProxy;

override protected void EOnInit(IEntity owner)
{
    RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
    m_bIsProxy = rpl && rpl.IsProxy();
    if (m_bIsProxy)
        ClearEventMask(owner, EntityEvent.FRAME);
}
```

---

## Rpc() Only Exists on IEntity / GenericEntity — NOT ScriptComponent

Calling `Rpc()` from a `ScriptComponent` will fail silently.
If you need broadcast from a component, the entity must subclass `GenericEntity`,
or use a different approach (e.g. spawn entity locally on all clients via Broadcast replication).

---

## Angular Velocity Does NOT Replicate on Dedicated Server

`Physics.SetAngularVelocity()` is server-side only. With `RplComponent "Rpl State Override" Runtime`,
position and linear velocity replicate to clients but **angular velocity does not**.

- Calling `SetAngularVelocity` in `EOnFrame` on the server produces tumble locally but clients see none.
- `RplProp` + `Replication.BumpMe()` can replicate a float value, but the client still needs to call
  `SetAngularVelocity` locally — this requires `EOnFrame` on the client too, which is fragile.
- `SetWorldTransform` for rotation fights the physics position and causes drift/crashes.

**Solution for visual-only rotation (e.g. tumbling projectile):** Use `ProcAnimComponent` or
`BaseItemAnimationComponent` with an animation graph — runs client-side, no replication needed.

---

## Dedicated Server CRC Mismatch / Infinite Loading

If a dedicated server process is left running in the background after script changes, clients get
`reason=2` connection refusal (CRC32 script checksum mismatch). Not a code issue — kill the stale
server process and relaunch.

---

## Particle Effects in Multiplayer

Particles are visual-only and skipped on dedicated servers.
With `RplComponent (Broadcast)` on the entity, `EOnInit` runs on every client automatically.
Spawn the particle locally in `EOnInit` — no RPC needed:
```c
override protected void EOnInit(IEntity owner)
{
    PlayParticle(owner); // runs on server + all clients
    RplComponent rpl = RplComponent.Cast(owner.FindComponent(RplComponent));
    if (rpl && rpl.IsProxy())
        return; // damage/lifetime: server only from here
}
```
