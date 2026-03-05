# Animation Script Integration — Patterns & Pitfalls

---

## Section 1: AnimationControllerComponent API

```c
AnimationControllerComponent anim = AnimationControllerComponent.Cast(
    owner.FindComponent(AnimationControllerComponent));
```

| Method | Returns | Notes |
|---|---|---|
| `BindFloatVariable(string name)` | `int` | Registers a float variable by name. Call ONCE in OnPostInit. Cache the returned ID. Returns -1 if variable not found. |
| `SetFloatVariable(int id, float value)` | void | Sets the variable each frame using the cached ID. Cheap operation. |
| `BindIntVariable(string name)` | `int` | Same pattern for int vars. |
| `SetIntVariable(int id, int value)` | void | |
| `BindBoolVariable(string name)` | `int` | Same pattern for bool vars. |
| `SetBoolVariable(int id, bool value)` | void | |

---

## Section 2: Correct Lifecycle Pattern

CRITICAL: Bind in `OnPostInit` (once), set in `EOnFrame` (every frame). Never call `BindFloatVariable` in `EOnFrame` — it is expensive and will cause performance problems.

Full working example (continuous rotation — e.g. radar dish, fan):

```c
class TAG_RotatingComponent : ScriptComponent
{
    protected int m_iVarId = -1;
    protected float m_fAngle = 0;

    override protected void OnPostInit(IEntity owner)
    {
        super.OnPostInit(owner);
        AnimationControllerComponent anim = AnimationControllerComponent.Cast(
            owner.FindComponent(AnimationControllerComponent));
        if (anim)
            m_iVarId = anim.BindFloatVariable("MyRotationVar");
        SetEventMask(owner, EntityEvent.FRAME);
    }

    override protected void EOnFrame(IEntity owner, float timeSlice)
    {
        if (m_iVarId < 0)
            return;

        m_fAngle += 180.0 * timeSlice; // 180 deg/s
        if (m_fAngle > 360)
            m_fAngle -= 360;

        AnimationControllerComponent anim = AnimationControllerComponent.Cast(
            owner.FindComponent(AnimationControllerComponent));
        if (anim)
            anim.SetFloatVariable(m_iVarId, m_fAngle);
    }
}
```

---

## Section 3: VehicleAnimationComponent vs BaseItemAnimationComponent

| Component | Used on | Variable feeding | Script needed? |
|---|---|---|---|
| VehicleAnimationComponent | Wheeled/tracked vehicles | Automatically feeds wheel_N, suspension_N, steering, Engine_RPM, SPEED, VehicleSteering, VehicleAccelerationFB/LR, etc. from physics simulation | No — component does it |
| BaseItemAnimationComponent | Items, props, weapons | No automatic feeding — all variables must be driven from script | Yes — drive all vars in EOnFrame |

`AlwaysActive` flag — set to `1` when:
- Entity has no character occupant but still needs animation (always-running machinery, props)
- Without this flag, animation may pause when no character is present

---

## Section 4: Replication Rule

Animation variables are evaluated **client-side only**. Rules:
- NEVER replicate animation variable values (waste of bandwidth, wrong architecture)
- Replicate the underlying simulation data instead (speed, RPM, door state, etc.)
- Each client reads locally available physics/simulation data and drives animation vars independently
- VehicleAnimationComponent already does this correctly — it reads local physics data

---

## Section 5: VehicleAnimationComponent — What It Feeds Automatically

When `VehicleAnimationComponent` is on a vehicle prefab, the following variables are fed automatically from the vehicle physics simulation — you do NOT write script for these:

- `wheel_0` through `wheel_N` — wheel rotation angles (degrees, -360 to 360)
- `suspension_0` through `suspension_N` — suspension travel (-1 to 1)
- `steering` — front steering angle (degrees)
- `steering_axle2` — second axle steering
- `Engine_RPM` — engine revolutions per minute
- `Gearbox_RPM`
- `SPEED` — vehicle speed
- `VehicleSteering`, `VehicleThrottle`, `VehicleBrake`, `VehicleHandBrake`
- `VehicleAccelerationFB`, `VehicleAccelerationLR`
- `SpineAccelerationFB`, `SpineAccelerationLR`
- `YawAngle`, `Yaw`, `Pitch` — vehicle body angles
- `IsDriver`, `IsInVehicle`, `SeatPositionType` — crew state
- `WaterLevel`, `IsSwimming` — amphibious state

Only use script to drive variables that VehicleAnimationComponent does NOT feed (custom variables, turret angles from a non-standard component, etc.)

---

## Section 6: Prefab Setup Checklist

To wire an animation graph to a vehicle prefab:
1. Add `VehicleAnimationComponent` to the prefab (not `AnimationControllerComponent` directly)
2. Set `AnimGraph` property = path to your `.agr` file (GUID-prefixed)
3. Set `AnimInstance` property = path to your `.asi` file (GUID-prefixed)
4. Set `AlwaysActive` = `1` if vehicle should animate even without an occupant
5. The `.asi` must reference the `.ast` and map each animation group/column to `.anm` files

---

## Section 7: Driving Suspension from Physics (custom override)

VehicleAnimationComponent feeds suspension_N automatically. Only do this if you need custom suspension behavior:

```c
// In a custom component on the vehicle:
override protected void EOnContact(IEntity owner, IEntity other, Contact contact)
{
    // example: custom suspension compression calculation
    float compression = ComputeMyCustomSuspension(contact);
    AnimationControllerComponent anim = AnimationControllerComponent.Cast(
        owner.FindComponent(AnimationControllerComponent));
    if (anim && m_iSuspVarId >= 0)
        anim.SetFloatVariable(m_iSuspVarId, compression);
}
```
