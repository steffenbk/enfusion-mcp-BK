# Physics, Transforms & Debug

---

## Physics

```c
Physics phys = owner.GetPhysics();
if (phys)
{
    phys.SetVelocity(vector.Zero);
    phys.SetAngularVelocity(vector.Zero);
}
```

Contact and physics-tick callbacks (set event masks accordingly):
```c
SetEventMask(owner, EntityEvent.CONTACT | EntityEvent.PHYSICSACTIVE);

override protected void EOnContact(IEntity owner, IEntity other, Contact contact) { }
override protected void EOnPhysicsActive(IEntity owner, float timeSlice) { }
```

---

## Transform Helpers

```c
// Get forward (+Z), right (+X), up (+Y) axes
vector mat[4];
owner.GetWorldTransform(mat);
vector right   = mat[0].Normalized();
vector up      = mat[1].Normalized();
vector forward = mat[2].Normalized();

// Build rotation matrix from direction
Math3D.DirectionAndUpMatrix(forward, Vector(0,1,0), mat);
owner.SetWorldTransform(mat);

// Identity matrix
Math3D.MatrixIdentity4(mat);
```

Parenting an entity:
```c
other.AddChild(owner, -1, EAddChildFlags.AUTO_TRANSFORM);
```

---

## Runtime Wheel Radius Swap — Confirmed Working (4WD Toggle Technique)

`WheelSetRadiusState(idx, value)` is fully functional at runtime. Confirmed behaviour:

- Setting radius to `0.001` is accepted — `WheelGetRadiusState` returns `0.001`
- `WheelHasContact` returns `false` after ~100ms (one physics tick) — engine stops detecting ground contact
- No crash, no physics instability at 0.001 radius
- `WheelSetRadiusState` returns `0` on success (not the set value) — this is normal
- `WheelGetRadius(idx)` always returns the **initial design radius** — use this to restore
- Restore works cleanly: set back to `WheelGetRadius(idx)`, contact resumes immediately
- Visual: front suspension extends fully when front wheels lose contact (body tilts to rear) — expected, not a bug

**Use case: scripted 2WD↔4WD toggle via dual physics axles**
- Physics asset needs two colocated wheel sets: "2WD" (rear driven) + "4WD" (all driven)
- Ghost set initialised at radius 0.001 = no ground contact
- Toggle by swapping radii between active and ghost sets

```c
// Shrink to ghost (disconnect from ground)
sim.WheelSetRadiusState(idx, 0.001);  // returns 0 = ok

// Restore (reconnect)
sim.WheelSetRadiusState(idx, sim.WheelGetRadius(idx)); // WheelGetRadius = initial design radius
```

---

## VehicleWheeledSimulation — Full Wheel API Reference

### Read-only
| Method | Returns | Notes |
|---|---|---|
| `WheelGetRadius(idx)` | float | Initial/design radius — never changes |
| `WheelGetRadiusState(idx)` | float | Current runtime radius |
| `WheelGetRollingDrag(idx)` | float | Rolling drag % |
| `WheelGetMass(idx)` | float | Initial mass |
| `WheelGetMassState(idx)` | float | Current runtime mass |
| `WheelGetRPM(idx)` | float | Current spin RPM |
| `WheelGetLongitudinalSlip(idx)` | float | Tyre longitudinal slip |
| `WheelGetLateralSlip(idx)` | float | Tyre lateral slip |
| `WheelGetPosition(idx, displacement=0)` | vector | Local-space position at **maximum droop** (not rest position) |
| `WheelGetContactPosition(idx)` | vector | World-space ground contact point |
| `WheelGetContactNormal(idx)` | vector | Ground contact normal |
| `WheelGetContactMaterial(idx)` | GameMaterial | Surface material |
| `WheelGetContactEntity(idx)` | IEntity | Entity the wheel rests on |
| `WheelGetContactLiquidState(idx)` | EWheelContactLiquidState | Water contact state |
| `WheelGetName(idx)` | string | Slot name e.g. `Wheel_L01` |
| `WheelGetIndex(name)` | int | Reverse lookup by slot name |
| `WheelCount()` | int | Total wheel count |

### Settable
| Method | Notes |
|---|---|
| `WheelSetRadiusState(idx, radius)` | Runtime radius |
| `WheelSetRollingDrag(idx, drag)` | Rolling resistance only — does NOT fight driven torque |
| `WheelSetMassState(idx, mass)` | Runtime wheel mass |

### Key pitfalls
- **No torque/RPM setter exists** — cannot stop a driven wheel from spinning via script
- **`WheelSetRollingDrag`** stops a wheel at standstill but is ineffective while throttle is applied
- **`WheelGetPosition(idx, 0)`** returns position at maximum suspension droop, ~0.7-0.8m below the visual wheel child entity's rest position — do NOT use 0.5m threshold for proximity matching, use 1.5m
- **`WheelGetRadius`** always returns the design radius, never the runtime state — safe to store once at init
- **No pivot/bone redirect API** — cannot change which bone a wheel slot tracks at runtime
- **No component enable/disable API** — `GameComponent` has no `SetEnabled(false)` in script

---

## Ghost Axle 4WD/2WD Toggle — Confirmed Working Pattern

Two colocated axle pairs in the physics asset. Ghost pair has `TorqueShare 0` and starts at radius `0.001`.

**In 4WD:** real axles at full radius, ghost at 0.001 (no contact).
**In 2WD (RWD):** front real wheels shrunk to 0.001, rear real wheels stay full. Ghost front wheels grown to full radius to bear front load (prevents nose-dive). Ghost rear stays at 0.001.

**Front wheel visual spinning in 2WD:** W0/W1 receive drivetrain torque even at radius 0.001 (contact=0). RPM reaches ~68-140 while driving. No API to stop this. Rolling drag=1.0 reduces but does not eliminate spin. Only solution is hiding the wheel mesh child entity.

**Child entity visibility:** `EntityFlags.VISIBLE` on child `IEntity` works — confirmed hides mesh. But:
- Vehicle child entities do NOT have names (`GetName()` returns `''`)
- Child[0] at runtime is the seated player character, not a wheel
- Total children: ~29 for M151A2 including particles, lights, wheel meshes, driver seat etc.
- `WheelGetPosition` returns maximum-droop local coords — must convert with `owner.CoordToParent()` and use 1.5m threshold (not 0.5m) for proximity matching

---

## Debug Shapes

```c
// Sphere at position, orange wireframe, persists until ref is cleared
Shape sphere = Shape.CreateSphere(ARGB(255, 255, 140, 0), ShapeFlags.VISIBLE | ShapeFlags.WIREFRAME, pos, 0.5);

// Store in array to keep alive (shapes die when ref is GC'd)
protected ref array<ref Shape> m_aShapes = new array<ref Shape>();
m_aShapes.Insert(sphere);

// Destroy all: clear the array
m_aShapes.Clear();
```

**Pitfall:** Debug shape disappears immediately if `ref Shape` goes out of scope. Always store in a member array.
