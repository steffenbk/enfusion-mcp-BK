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

---

## Architecture Overview

- Classical server-client: one server, clients do not talk to each other.
- Single-player = listen server. Properly written MP code runs in SP.
- No distributed servers, no Headless Client.

### Entity Roles
- **Authority**: machine where entity was created. Fixed — never transferred.
- **Proxy**: local representation on other machines, receives state updates.
- **Owner**: optional elevated role (one machine at a time). Ownership CAN be transferred by authority.
  - `RpcAsk_` prefix = owner asking authority.
  - `RpcDo_` prefix = authority pushing to proxies/owner.

### Replication States
- **Loadtime**: placed-in-world entities; insertion must be deterministic. Mismatch = `JIP_ERROR` + client disconnect.
- **Runtime**: created during session by server only. Require a prefab.
- **Local Runtime**: created on client only; no proxy. Used for client-side predicted effects.
- **Rpl State Override** on `RplComponent`: `None` (inherit) or `Runtime`. Child entity must be attached during spawning to inherit parent's override.

---

## RPC Calls

```c
Rpc(Rpc_MyMethod, param1, param2);
```

- Available on `GenericEntity` and `GenericComponent`.
- RPC order between two machines is guaranteed; RPCs are queued.
- **Never call RPC from `EOnInit`** — not supported.

```c
[RplRpc(RplChannel.Reliable, RplRcver.Owner)]
protected void Rpc_MyMethod(int value) { }
```

| Channel | Notes |
|---|---|
| `Reliable` | Guaranteed delivery, more expensive |
| `Unreliable` | May be lost — use for frequent position updates |

| Receiver | Notes |
|---|---|
| `Server` | Authority only |
| `Owner` | Owner machine only |
| `Broadcast` | All proxies (not authority). Only reaches machines that have the proxy streamed. |

`RplCondition`: `None`, `OwnerOnly`, `NoOwner`, `Custom` (named bool method).

---

## RplProp (Replicated Properties)

```c
[RplProp(onRplName: "OnBroadcastValueUpdated")]
protected int m_iBroadcastValue;

// After changing value on authority:
Replication.BumpMe();
```

- `onRplName` callback fires on **proxies only** (not authority), including JIP/streaming.
- Only machines with the proxy streamed receive the update.

---

## Replication Key Methods

- `Replication.FindId(entity)` — returns `RplId`. **Cache the result** — expensive in tight loops.
- `Replication.FindItem(id)` — returns entity or null.
- `Replication.FindOwner(entity)` — returns owner machine's network id.
- `Replication.BumpMe()` — signals at least one `RplProp` changed; required after every authority-side property mutation.

---

## RplSave / RplLoad

Custom sync data for initial replication:
```c
void RplSave(ScriptBitWriter writer)
{
    writer.Write(m_iValue, 7);  // use fewer bits than type when range allows
    writer.WriteBool(m_bFlag);
    writer.WriteString(m_sName);
}

void RplLoad(ScriptBitReader reader)
{
    reader.Read(m_iValue, 7);   // order MUST match RplSave exactly
    reader.ReadBool(m_bFlag);
    reader.ReadString(m_sName);
}
```

- Read order must match write order. Wrong bit count = undefined behaviour.
- `RplLoad` is called after full hierarchy load, before `EOnFrame`.

---

## Components NOT Instantiated on Dedicated Server

`BaseFlattenGrassComponent`, `CameraHandlerComponent`, `DebugShootComponent`, `MotorExhaustEffectComponent`, `BaseSoundComponent`.

---

## Additional MP Pitfalls

- Entity created on a client = unknown to server, no replication possible.
- `Broadcast` RPC silently lost if proxy not streamed on that machine.
- `onRplName` is NOT called on the authority.
- Setting `RplProp` directly on a proxy causes state discrepancy until next authority broadcast.
- Child entity spawned before attaching to parent loses Rpl State Override inheritance.
- Streaming out while authority exists = undefined behaviour.
- `crossPlatform` server config param broken — use `supportedPlatforms` with explicit platform entries instead.
