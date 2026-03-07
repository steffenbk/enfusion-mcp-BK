# Vehicle Animation Graph — Reference

Sources: LAV25.agr (8-wheel armored), LAV25.ast, S105.agr (4-wheel civilian), S105.ast, S105.agf (first 250 lines).

---

## Section 1: Standard Variable Set

Variables are declared in the `ControlTemplate AnimSrcGCT` block of the `.agr` file.
"Auto-fed" means `VehicleAnimationComponent` writes the value automatically from physics/input every frame — do not set these from script.

### Wheel Rotation

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| wheel_0 | Float | -360 | 360 | 0 | Wheel rotation angle in degrees (front-left or index 0) | Yes |
| wheel_1 | Float | -360 | 360 | 0 | Wheel rotation angle (front-right or index 1) | Yes |
| wheel_2 | Float | -360 | 360 | 0 | Wheel rotation (index 2) | Yes |
| wheel_3 | Float | -360 | 360 | 0 | Wheel rotation (index 3) | Yes |
| wheel_4 | Float | -360 | 360 | 0 | Wheel rotation (index 4) — omit on 4-wheel vehicles | Yes |
| wheel_5 | Float | -360 | 360 | 0 | Wheel rotation (index 5) — omit on 4-wheel vehicles | Yes |
| wheel_6 | Float | -360 | 360 | 0 | Wheel rotation (index 6) — omit on 4-wheel vehicles | Yes |
| wheel_7 | Float | -360 | 360 | 0 | Wheel rotation (index 7) — omit on 4-wheel vehicles | Yes |

### Suspension Travel

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| suspension_0 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 0) | Yes |
| suspension_1 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 1) | Yes |
| suspension_2 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 2) | Yes |
| suspension_3 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 3) | Yes |
| suspension_4 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 4) — omit on 4-wheel | Yes |
| suspension_5 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 5) — omit on 4-wheel | Yes |
| suspension_6 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 6) — omit on 4-wheel | Yes |
| suspension_7 | Float | -1 | 1 | 0 | Normalized suspension compression (wheel 7) — omit on 4-wheel | Yes |

### Steering

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| steering | Float | -50 | 50 | 0 | Front steering angle in degrees | Yes |
| steering_axle2 | Float | -50 | 50 | 0 | Rear axle 2 steering angle — used on multi-axle steering vehicles | Yes |
| steering_delay | Float | -50 | 50 | 0 | Lagged steering value — used for rear-axle linkage with delay | Yes |

### Vehicle Dynamics

All extracted from LAV25.agr. Min omitted where the file omits it (implicit 0).

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| VehicleSteering | Float | -1 | 1 | 0 | Normalized steering input from physics | Yes |
| VehicleThrottle | Float | 0 | 1 | 0 | Normalized throttle input | Yes |
| VehicleClutch | Float | 0 | 1 | 0 | Normalized clutch input | Yes |
| VehicleBrake | Float | 0 | 1 | 0 | Normalized brake input | Yes |
| VehicleHandBrake | Float | 0 | 2 | 0 | Hand brake state | Yes |
| VehicleAccelerationFB | Float | -1 | 1 | 0 | Forward/back acceleration (g-force normalized) | Yes |
| VehicleAccelerationLR | Float | -1 | 1 | 0 | Left/right acceleration (g-force normalized) | Yes |
| SPEED | Float | 0 | 250 | 0 | Vehicle speed in km/h | Yes |
| Speed_dumping | Float | 0 | 250 | 0 | Damped/smoothed speed value | Yes |
| Speed_dumping2 | Float | 0 | 250 | 0 | Second damped speed value (slower damping) | Yes |
| Gearbox_RPM | Float | -10000 | 10000 | 0 | Gearbox output RPM | Yes |
| Engine_RPM | Float | 0 | 10000 | 0 | Engine RPM | Yes |

Note: S105 uses `ENGINE_RPM_0` (0–8000), `GEARBOX_RPM_0` (0–8000), and `ENGINE_RPM_delay` / `ENGINE_RPM_delay2` instead of the LAV25 names. Variable names are not universal — match what the `VehicleAnimationComponent` is configured to feed.

### Body Motion

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| SpineAccelerationFB | Float | -1 | 1 | 0 | Forward/back body lean for crew spine animation | Yes |
| SpineAccelerationLR | Float | -1 | 1 | 0 | Left/right body lean for crew spine animation | Yes |
| Vehicle_Wobble | Float | 0 | 1 | 0 | Chassis wobble intensity (terrain roughness) | Yes |
| Suspension_dumping | Float | -1 | 1 | 0 | Smoothed suspension compression delta | Yes |
| Suspension_shake | Float | 0 | 1 | 0 | Suspension shake intensity (abrupt impacts) | Yes |
| YawAngle | Float | -360 | 360 | 0 | Turret yaw angle in degrees | Yes |
| Yaw | Float | -180 | 180 | 0 | Vehicle body yaw in world space | Yes |
| Yaw_SimComp | Float | -180 | 180 | 0 | Simulated/compensated yaw (for camera stabilization) | Yes |
| Pitch | Float | -50 | 80 | 0 | Vehicle pitch angle | Yes |
| Pitch_SimComp | Float | -50 | 80 | 0 | Simulated/compensated pitch | Yes |

### Crew / Seat

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| LookX | Float | -180 | 180 | 0 | Crew head look horizontal | Yes (character input) |
| LookY | Float | -180 | 180 | 0 | Crew head look vertical | Yes (character input) |
| AimX | Float | -100 | 100 | 0 | Crew aim horizontal | Yes (character input) |
| AimY | Float | -100 | 100 | 0 | Crew aim vertical (also drives gun elevation) | Yes (character input) |
| SeatPositionType | Int | 0 | 10 (LAV25) / 15 (S105) | 0 | Current seat index — drives state machine selection | Yes |
| IsDriver | Bool | — | — | false | True when character is in driver seat | Yes |
| IsInVehicle | Float | 0 | 1 | 0 | 1 when character is seated in vehicle | Yes |
| TurnOut | Bool | — | — | false | True when character is in turn-out (hatch) pose | Yes |
| Horn | Bool | — | — | false | True while horn is pressed | Yes |

### Turret

Set by turret component, not by VehicleAnimationComponent directly.

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| TurretRot_Antennas | Float | -1 | 1 | 0 | Antenna sway tied to turret rotation | No |
| Gunner_sights_cover | Float | -0.71 | 1.4 | -0.71 | Gunner sight cover open/close position | No |
| Gunner_comander_cover | Float | -0.71 | 1.4 | -0.71 | Commander sight cover open/close position | No |

### Amphibious

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| WaterLevel | Float | 0 | 100 | 0 | Water depth at vehicle position | Yes |
| IsSwimming | Float | 0 | 1 | 0 | 1 when vehicle is swimming | Yes |
| IsSwimming_delayed2 | Float | 0 | 1 | 0 | Delayed swimming state (for smooth transitions) | Yes |

### Gauges / Misc

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| FUEL1 | Float | 0 | 269 | 134.5 | Fuel level for gauge dial | Varies |
| POWER_IO | Float | 0 | 1 | 1 | Power/electrical state (1 = on) | Varies |
| Dial_random | Float | -100 | 100 | 0.5 | Random dial jitter value | Varies |
| LocalTime | Float | 0 | 100000000 | 100000000 | Local time source for procedural effects | Varies |
| speed_ant1 | Float | 0 | 50 | 0 | Antenna sway speed input 1 | Varies |
| speed_ant2 | Float | 0 | 50 | 0 | Antenna sway speed input 2 | Varies |

### Door State

| Variable | Type | Min | Max | Default | Purpose | Auto-fed |
|---|---|---|---|---|---|---|
| VehicleDoorState | Int | 0 | 298754968 | 0 | Bitmask of door open/closed states | Yes |
| VehicleDoorType | Int | 0 | 298754968 | 0 | Door type identifier bitmask | Yes |

The MaxValue `298754968` is the engine's bitmask sentinel value, not a meaningful upper bound.

---

## Section 2: Standard Commands

Declared in the `Commands {}` block of the `.agr`. Safe to include unused commands — they are harmless.

| Command | Purpose |
|---|---|
| CMD_Vehicle_GetIn | Triggers get-in animation when character enters vehicle |
| CMD_Vehicle_GetOut | Triggers get-out animation when character exits vehicle |
| CMD_Vehicle_SwitchSeat | Triggers seat-switch animation |
| CMD_Death | Plays death animation for character in vehicle |
| CMD_Unconscious | Character loses consciousness in vehicle |
| CMD_Unconscious_Exit | Character recovers from unconscious state |
| CMD_OpenDoor | Generic open-door animation trigger (legacy) |
| CMD_Vehicle_OpenDoor | Open door animation (preferred over CMD_OpenDoor) |
| CMD_Vehicle_CloseDoor | Close door animation |
| CMD_Vehicle_GearSwitch | Gear change animation (hand on gear lever) |
| CMD_Vehicle_Engine_StartStop | Engine start or stop interaction animation |
| CMD_HandBrake | Hand brake pull/release animation |
| CMD_Lights | Lights toggle interaction animation |
| CMD_Wheeled_Action | Generic wheeled vehicle action (horn, wiper, etc.) |
| CMD_Vehicle_FinishActionQueue | Signals end of queued action sequence |

Both LAV25 and S105 carry the full identical command set (15 commands).

---

## Section 3: Standard IK Chain Patterns

IK chains are declared in the `IkChains {}` block of the `.agr` `ControlTemplate`.

### Character Limb Chains (always present on crew vehicles)

```
AnimSrcGCTIkChain LeftLeg {
 Joints {
  "leftleg"
  "leftlegtwist"
  "leftknee"
  "leftkneetwist"
  "leftfoot"
 }
 MiddleJoint "leftknee"
 ChainAxis "+y"
}
AnimSrcGCTIkChain RightLeg {
 Joints {
  "rightleg"
  "rightlegtwist"
  "rightknee"
  "rightkneetwist"
  "rightfoot"
 }
 MiddleJoint "rightknee"
 ChainAxis "-y"
}
AnimSrcGCTIkChain LeftArm {
 Joints {
  "leftarm"
  "leftarmtwist"
  "leftforearm"
  "leftforearmtwist"
  "lefthand"
 }
 MiddleJoint "leftforearm"
 ChainAxis "+y"
}
AnimSrcGCTIkChain RightArm {
 Joints {
  "rightarm"
  "rightarmtwist"
  "rightforearm"
  "rightforearmtwist"
  "righthand"
 }
 MiddleJoint "rightforearm"
 ChainAxis "-y"
}
```

These four chains are **identical** across LAV25 and S105. Include them in every crew vehicle.

### Single-Bone Vehicle Chains

Each mechanical bone gets its own IK chain (even if only one bone). No `MiddleJoint` or `ChainAxis` needed for single-bone chains.

**Suspension arms (LAV25 pattern — bone name is `v_suspensionN`):**
```
AnimSrcGCTIkChain suspension0 {
 Joints {
  "v_suspension0"
 }
}
AnimSrcGCTIkChain suspension1 {
 Joints {
  "v_suspension1"
 }
}
AnimSrcGCTIkChain suspension2 {
 Joints {
  "v_suspension2"
 }
}
AnimSrcGCTIkChain suspension3 {
 Joints {
  "v_suspension3"
 }
}
```

Note: S105 uses bone names `v_suspension_01` through `v_suspension_04` (underscore + two-digit suffix) in its chains, while LAV25 uses `v_suspension0` through `v_suspension7` (no separator). The chain name (`suspension0`, `suspension1` etc.) is the same convention in both files.

**Shock absorbers (LAV25 only — wheels 4-7, paired with IK targets):**
```
AnimSrcGCTIkChain shock_absorber4 {
 Joints {
  "v_shock_absorber4"
 }
}
AnimSrcGCTIkChain shock_absorber_ikTarget4 {
 Joints {
  "v_shock_absorber_ikTarget4"
 }
}
AnimSrcGCTIkChain shock_absorber5 {
 Joints {
  "v_shock_absorber5"
 }
}
AnimSrcGCTIkChain shock_absorber_ikTarget5 {
 Joints {
  "v_shock_absorber_ikTarget5"
 }
}
AnimSrcGCTIkChain shock_absorber6 {
 Joints {
  "v_shock_absorber6"
 }
}
AnimSrcGCTIkChain shock_absorber_ikTarget6 {
 Joints {
  "v_shock_absorber_ikTarget6"
 }
}
AnimSrcGCTIkChain shock_absorber7 {
 Joints {
  "v_shock_absorber7"
 }
}
AnimSrcGCTIkChain shock_absorber_ikTarget7 {
 Joints {
  "v_shock_absorber_ikTarget7"
 }
}
```

**Steering axis chains (LAV25 — per-axle, two bones each: suspension side and body side):**
```
AnimSrcGCTIkChain steering_axis_suspension0 {
 Joints {
  "v_steering_axis_suspension0"
 }
}
AnimSrcGCTIkChain steering_axis_body0 {
 Joints {
  "v_steering_axis_body0"
 }
}
```
Pattern repeats for indices 1, 2, 3.

**Drive shafts (LAV25):**
```
AnimSrcGCTIkChain shaft_up0 {
 Joints {
  "v_shaft_up0"
 }
}
```
Pattern repeats for indices 1 through 7.

### Multi-Bone IK Chains (from LAV25 — sight cover arms)

These use `MiddleJoint` but no `ChainAxis` (vehicle bones, not character limbs):

```
AnimSrcGCTIkChain Visor_cover_arm_L {
 Joints {
  "v_gunner_sight_cover_arm_01"
  "v_gunner_sight_cover_arm_02"
  "v_gunner_sight_cover_arm_03"
 }
 MiddleJoint "v_gunner_sight_cover_arm_02"
}
AnimSrcGCTIkChain Visor_cover_arm_R {
 Joints {
  "v_commander_sight_cover_arm_01"
  "v_commander_sight_cover_arm_02"
  "v_commander_sight_cover_arm_03"
 }
 MiddleJoint "v_commander_sight_cover_arm_02"
}
```

### ChainAxis Reference

| Chain type | ChainAxis value | Reason |
|---|---|---|
| Left leg | `"+y"` | Knee bends toward +Y in character rig |
| Right leg | `"-y"` | Knee bends toward -Y in character rig |
| Left arm | `"+y"` | Elbow bends toward +Y |
| Right arm | `"-y"` | Elbow bends toward -Y |
| Single-bone vehicle | omit | No pole vector needed |
| Multi-bone vehicle (cover arms) | omit | Enfusion infers from geometry |

Wrong `ChainAxis` = IK bends in the wrong direction (limb folds backward). No error is shown.

---

## Section 4: Standard Bone Mask Structure

Bone masks are declared in the `BoneMasks {}` block. They gate which bones a node branch is allowed to write.

### LAV25 Bone Masks (exact from file)

Note: LAV25 spells this mask `Chasis` (one 's') — this is the actual name in the file.

```
// Chasis — all mechanical vehicle bones: shafts, suspension arms, shock absorbers,
// steering linkages, stabilizer rods, wheels, hoses, propellers, rudders.
AnimSrcGCTBoneMask Chasis {
 Bones {
  "v_axis_shaft_01"
  "v_axis_shaft_02"
  "v_axis_shaft_03"
  "v_axis_shaft_04"
  "v_axis_shaft_05"
  "v_exhaust1"
  "v_exhaust2"
  "v_main_shaft"
  "v_shaft_up0"
  "v_shaft_up1"
  "v_shaft_up2"
  "v_shaft_up3"
  "v_shaft_up4"
  "v_shaft_up5"
  "v_shaft_up6"
  "v_shaft_up7"
  "v_shock_absorber_ikTarget4"
  "v_shock_absorber_ikTarget5"
  "v_shock_absorber_ikTarget6"
  "v_shock_absorber_ikTarget7"
  "v_steering_body0"
  "v_steering_body1"
  "v_steering_body2"
  "v_steering_body3"
  "v_suspension0"
  "v_suspension1"
  "v_suspension2"
  "v_suspension3"
  "v_suspension4"
  "v_suspension5"
  "v_suspension6"
  "v_suspension7"
  "v_suspension_stabilizer_up0_1"
  "v_suspension_stabilizer_up0_2"
  "v_suspension_stabilizer_up1_1"
  "v_suspension_stabilizer_up1_2"
  "v_suspension_stabilizer_up2_1"
  "v_suspension_stabilizer_up2_2"
  "v_suspension_stabilizer_up3_1"
  "v_suspension_stabilizer_up3_2"
  "v_steering_axis_body0"
  "v_steering_low0"
  "v_steering_axis_body1"
  "v_steering_low1"
  "v_steering_axis_body2"
  "v_steering_low2"
  "v_steering_axis_body3"
  "v_steering_low3"
  "v_suspension_axis0"
  "v_suspension_stabilizer_low0_1"
  "v_suspension_stabilizer_low0_2"
  "v_hose0"
  "v_shaft0"
  "v_shaft_low0"
  "v_shock_absorber0"
  "v_steering_axis_suspension0"
  "v_wheel_L01"
  "v_suspension_axis1"
  "v_suspension_stabilizer_low1_1"
  "v_suspension_stabilizer_low1_2"
  "v_hose1"
  "v_shaft1"
  "v_shaft_low1"
  "v_shock_absorber1"
  "v_steering_axis_suspension1"
  "v_wheel_R01"
  "v_suspension_axis2"
  "v_suspension_stabilizer_low2_1"
  "v_suspension_stabilizer_low2_2"
  "v_hose2"
  "v_shaft2"
  "v_shaft_low2"
  "v_shock_absorber2"
  "v_steering_axis_suspension2"
  "v_wheel_L02"
  "v_suspension_axis3"
  "v_suspension_stabilizer_low3_1"
  "v_suspension_stabilizer_low3_2"
  "v_hose3"
  "v_shaft3"
  "v_shaft_low3"
  "v_shock_absorber3"
  "v_steering_axis_suspension3"
  "v_wheel_R02"
  "v_hose4"
  "v_shaft4"
  "v_shaft_low4"
  "v_shock_absorber4"
  "v_wheel_L03"
  "v_hose5"
  "v_shaft5"
  "v_shaft_low5"
  "v_shock_absorber5"
  "v_wheel_R03"
  "v_hose6"
  "v_shaft6"
  "v_shaft_low6"
  "v_shock_absorber6"
  "v_wheel_L04"
  "v_hose7"
  "v_shaft7"
  "v_shaft_low7"
  "v_shock_absorber7"
  "v_wheel_R04"
  "removePrefix_v_wheel_L01"
  "removePrefix_v_wheel_R01"
  "removePrefix_v_wheel_L02"
  "removePrefix_v_wheel_R02"
  "removePrefix_v_wheel_L03"
  "removePrefix_v_wheel_R03"
  "removePrefix_v_wheel_L04"
  "removePrefix_v_wheel_R04"
  "v_shock_absorber_ikTarget0"
  "v_shock_absorber_ikTarget1"
  "v_shock_absorber_ikTarget2"
  "v_shock_absorber_ikTarget3"
  "v_propeller_L"
  "v_propeller_L1"
  "v_propeller_shaft"
  "v_rudder_L01"
  "v_rudder_L02"
  "v_rudder_R01"
  "v_rudder_R02"
 }
}

// Body — non-mechanical visible parts: dials, lights, mirrors, trim, decorative elements.
AnimSrcGCTBoneMask Body {
 Bones {
  "v_Batery_diel"
  "v_Fuel_diel"
  "v_RPM_diel"
  "v_airTank1_diel"
  "v_airTank2_diel"
  "v_canister_L01"
  "v_canister_R01"
  "v_canister_R02"
  "v_headlight_L"
  "v_headlight_L1"
  "v_hitch_L"
  "v_hitch_R"
  "v_mirror_L"
  "v_mirror_R"
  "v_searchlight"
  "v_speed_diel"
  "v_water_temp_dial2"
  "v_water_temp_dial3"
  "v_trim_vane"
 }
}

// Turret — full turret assembly: antennas, ammo belt, sight covers and their IK arm bones.
AnimSrcGCTBoneMask Turret {
 Bones {
  "v_antenna_L02"
  "v_antenna_L01"
  "v_antenna_R01"
  "v_antenna_L03"
  "v_antenna_L04"
  "v_antenna_L05"
  "v_antenna_R05"
  "v_antenna_R04"
  "v_antenna_R03"
  "v_antenna_R02"
  "v_ammo_belt"
  "v_commander_sight"
  "v_commander_sight_cover"
  "v_gunner_sight"
  "v_gunner_sight_cover"
  "v_commander_sight_cover_arm_01"
  "v_commander_sight_cover_arm_02"
  "v_commander_sight_cover_arm_03"
  "v_gunner_sight_cover_arm_01"
  "v_gunner_sight_cover_arm_02"
  "v_gunner_sight_cover_arm_03"
 }
}

// Turret_Pose — just the turret root bones for pose blending (horizontal pivot chain).
AnimSrcGCTBoneMask Turret_Pose {
 Bones {
  "v_root"
  "v_turret_slot"
  "v_turret_01"
 }
}
```

### Bone Naming Convention

- All vehicle bones use the `v_` prefix (e.g. `v_wheel_L01`, `v_suspension0`, `v_shock_absorber4`).
- Character skeleton bones have no prefix (e.g. `leftleg`, `rightarm`, `leftknee`).
- Missing `v_` prefix on a vehicle bone = IK chain silently fails with no error.
- LAV25 wheel naming: `v_wheel_L01` through `v_wheel_L04`, `v_wheel_R01` through `v_wheel_R04`.
- S105 wheel naming: `v_wheel_L01`, `v_wheel_R01`, `v_wheel_L02`, `v_wheel_R02`.
- LAV25 also includes `removePrefix_v_wheel_*` entries in the Chasis mask — these are present in the actual file.

---

## Section 5: Node Hierarchy Patterns

These patterns describe how to wire AGF nodes. All node editing must be done in the Workbench Animation Graph editor — file edits to AGF are wiped on next open.

### 1. Wheel Rotation

- Node type: `AnimSrcNodeProcTransform`
- One ProcTransform per wheel (or one per side if mirroring with negated amount).
- Key properties:
  - `Bone` = `v_wheel_L01` (or whichever bone)
  - `Op` = Rotate
  - `Space` = Local
  - `Amount` = `wheel_0` (the corresponding variable)
- Amount can include `rad()` for unit conversion if the bone's rotation axis expects radians.
- Wrap all wheel ProcTransforms in a `Queue` node for the chassis branch.

### 2. Suspension Travel

- Nodes: `AnimSrcNodeIK2Target` + `AnimSrcNodeIK2`
- `IK2Target` reads the `suspension_N` variable and moves a target bone to the desired position.
- `IK2` applies the IK solve using the chain defined in the AGR (e.g. chain name `suspension0`).
- Data flow: `IK2Target` sets world target → `IK2` solves suspension arm to reach target → bone moves.
- S105 AGF uses this pattern: `spring0` / `spring1` chains paired with `v_spring_0_ikTarget` bones.

### 3. Steering Linkage

- Node type: `AnimSrcNodeProcTransform`
- Bones involved: `v_steering_axis_body0`, `v_steering_low0`, and their per-axle counterparts.
- Op = Rotate, Space = Local.
- Front axle uses `steering` variable.
- Rear axles with compound linkage use `steering_axle2` or `steering_delay` for lagged response.

### 4. Dial / Gauge

- Node type: `AnimSrcNodePose`
- Source format: `"Group.Column.AnimationName"` (e.g. `"Vehicle.Driver.Idle01"`)
- Expression maps a variable to 0-1 range: `clamp(Engine_RPM / 10000, 0, 1)`
- 0 = first keyframe position (gauge at zero), 1 = last keyframe position (gauge at max).
- All dial positions baked into a single animation as keyframes across the timeline.

### 5. Turret Rotation

- Node type: `AnimSrcNodeProcTransform` on `v_turret_01` bone.
- Op = Rotate, Space = Model (or Local depending on rig).
- Amount = `YawAngle` for horizontal rotation.
- Gun elevation: separate ProcTransform on the gun bone, Amount = `AimY`.

### 6. Character Seat State Machine

- Top-level: `AnimSrcNodeStateMachine` with one `AnimSrcNodeState` per seat type.
- States: Driver, CoDriver, Gunner, Passenger (names match AST column names).
- Transitions triggered by `SeatPositionType` variable value (compare to seat index constants).
- Each state wraps a `Queue` node for action commands (GetIn, GetOut, Death, Unconscious etc.).
- Hand / foot placement: `AnimSrcNodeIK2Target` + `AnimSrcNodeIK2` targeting control geometry bones (e.g. `LHandIKTarget`, `RHandIKTarget`, `LeftLeg`, `RightLeg`).
- S105 AGF example (from file): `IK2Target` binds `LHandIKTarget` → `LeftArm` chain, `RHandIKTarget` → `RightArm` chain, `LeftLeg` → `LeftLeg` chain, `RightLeg` → `RightLeg` chain.

### 7. Suspension Shake / Damping

- `AnimSrcNodeVarUpdate` — rate-limits the `Suspension_shake` variable to smooth abrupt changes.
- `AnimSrcNodeTimeScale` — `TimeExpr` uses the smoothed suspension value to scale playback speed of a looping wobble source.
- S105 AGF example from file:
  ```
  AnimSrcNodeTimeScale "Time Scale 31988" {
   Child "Source 16361"
   TimeExpr "(1 + (1 - (normalize(Vehicle_Wobble, 0.0, 0.1)))) * lerp(Random01(), 1.0, 1.2)"
   TimeStorage "Real Time"
  }
  ```
- The child `Source 16361` plays `"Vehicle.Driver.Wobble"` with `Looptype Loop`.

### 8. Spine Acceleration (Brake/Acceleration Body Lean)

- S105 AGF example (from file):
  ```
  AnimSrcNodeQueue BrakeSpineCoDriverQ {
   Child "SteeringMainIKT_1_4"
   QueueItems {
    AnimSrcNodeQueueItem {
     Child "BrakeSpineCoDriverTime"
     StartExpr "inRange(VehicleAccelerationFB, -1, -0.3)"
     BlendInTime 0.1
     BlendOutTime 0.2
     EnqueueMethod Ignore
    }
   }
  }
  ```
- The `TimeScale` node for brake spine: `TimeExpr "-(clamp(SpineAccelerationFB, -0.9, -0.3))"` — negated clamp drives playback speed.

### 9. Sleep Optimization

- Node type: `AnimSrcNodeSleep`
- Place near the top of each major branch (crew branch, chassis branch, turret branch).
- `AwakeExpr` condition examples:
  - Crew branch: `IsInVehicle > 0`
  - Driver branch: `IsDriver > 0`
  - Chassis: use a speed or suspension threshold
- `Timeout` — typically 1-3 seconds before the node sleeps.
- When sleeping, all child nodes skip evaluation — significant CPU saving on inactive vehicles.

---

## Section 6: Step-by-Step New Wheeled Vehicle AGR Setup

1. **Decide wheel count** — determines how many `wheel_N`, `suspension_N` variables and IK chains to declare. 4-wheel civilian: indices 0-3. 8-wheel armored: indices 0-7.

2. **Decide feature flags** — hasTurret, hasSuspensionIK, hasShockAbsorbers, hasSteeringLinkage, seatTypes (driver / co-driver / gunner / commander / passenger / unique), dialList, isAmphibious.

3. **Write AGR Variables block** — copy the standard variables for your wheel count. Omit unused categories. If 4-wheel civilian: skip `suspension_4` through `suspension_7`, shock absorber variables, most turret variables, amphibious variables.

4. **Write AGR Commands block** — include all 15 standard commands listed in Section 2. Unused ones are harmless to include.

5. **Write AGR IkChains block** — always include the four character limb chains (LeftLeg, RightLeg, LeftArm, RightArm). Add one single-bone chain per suspension arm, per shock absorber, per steering axis bone, and per drive shaft bone that exists in your mesh.

6. **Write AGR BoneMasks block** — at minimum: a chassis mask (all `v_` mechanical bones), a body mask (dials, lights, mirrors). Add Turret + Turret_Pose masks if turret is present.

7. **Set GlobalTags** — `"VEHICLE"`, `"WHEELED"`, `"YOURVEHICLENAME"` (uppercase). Example from LAV25: `"VEHICLE"`, `"WHEELED"`, `"LAV25"`.

8. **Set DefaultRunNode** — must exactly match the name of the master Queue node you will create in AGF. Convention used in LAV25: `"MasterControl"`.

9. **Create matching AST** — animation groups for each seat type present. Standard groups (from both LAV25 and S105 AST files):
   - `Gunner` group: aimspace, idle, and transition animations. Columns: `"Default"`.
   - `Vehicle` group: all get-in/out, idle, death, unconscious, wobble animations. Columns: `"CoDriver"`, `"Driver"`, `"Gunner"`, `"PassengerL"`, `"PassengerR"`, `"UniqueSeat"`.
   - `VehicleActions` group: brake, clutch, engine start/stop, handbrake, horn, lights, gear shift, steering. Columns: `"Veh/Play"`.

10. **Open in Workbench Animation Editor** — build the AGF node graph using the patterns from Section 5. Add `AnimSrcNodeSleep` on major branches.

11. **After AGF is saved and registered** — update `GraphFilesResourceNames` in the AGR with the GUID-prefixed path: `"{GUID}path/to/Vehicle.agf"`. The GUID is assigned by Workbench on registration.

12. **Set on prefab** — add `VehicleAnimationComponent` to the vehicle entity. Set `AnimGraph` = `.agr` resource path, `AnimInstance` = `.asi` resource path.

---

## Section 7: Annotated S105 Example

Key sections of S105.agr with inline comments.

```
AnimSrcGraph {
 // Reference to the AST that defines animation group/column names
 AnimSetTemplate "{8377D7D82C4EA8B1}Assets/Vehicles/Wheeled/S105/workspace/S105.ast"
 ControlTemplate AnimSrcGCT "{5E14AA3721464490}" {
  Variables {
   // --- Vehicle dynamics ---
   AnimSrcGCTVarFloat VehicleSteering {
    DefaultValue 0       // explicit default — best practice on 4-wheel civilian
    MinValue -1
    MaxValue 1
   }
   AnimSrcGCTVarFloat VehicleThrottle {
    DefaultValue 0
    MinValue 0
    MaxValue 1
   }
   AnimSrcGCTVarFloat POWER_IO {
    DefaultValue 1       // starts at 1 (power on) not 0
    MaxValue 1
   }
   // S105 uses vehicle-specific RPM names instead of the LAV25 names
   AnimSrcGCTVarFloat ENGINE_RPM_0 {
    MaxValue 8000
   }
   AnimSrcGCTVarFloat GEARBOX_RPM_0 {
    MaxValue 8000
   }
   // S105-specific: wiper state float
   AnimSrcGCTVarFloat WIPERS_IO {
    MaxValue 1
   }
   // --- Suspension (4-wheel only, no indices 4-7) ---
   AnimSrcGCTVarFloat suspension_0 {
    MinValue -1
    MaxValue 1
   }
   // ... suspension_1, suspension_2, suspension_3 follow same pattern
   // --- Wheel rotation (4-wheel) ---
   AnimSrcGCTVarFloat wheel_0 {
    MinValue -360
    MaxValue 360
   }
   // ... wheel_1, wheel_2, wheel_3 follow same pattern
  }

  IkChains {
   // Character limb chains — identical to LAV25
   AnimSrcGCTIkChain LeftLeg { ... }
   AnimSrcGCTIkChain RightLeg { ... }
   AnimSrcGCTIkChain LeftArm { ... }
   AnimSrcGCTIkChain RightArm { ... }
   // Suspension arm chains — S105 bone names use underscore+two-digit suffix
   AnimSrcGCTIkChain suspension0 {
    Joints {
     "v_suspension_01"   // note: v_suspension_01 not v_suspension0
    }
   }
   AnimSrcGCTIkChain suspension1 {
    Joints {
     "v_suspension_02"
    }
   }
   // Spring chains — S105 specific, one per wheel
   AnimSrcGCTIkChain spring0 {
    Joints {
     "v_spring_0"
    }
   }
   // ...
  }

  BoneMasks {
   // S105 spells mask name lowercase 'chassis' (LAV25 uses 'Chasis')
   AnimSrcGCTBoneMask chassis {
    Bones {
     "suspension_01"            // note: no v_ prefix on some S105 bones
     "suspension_02"
     "v_wheel_L01_rotator"      // rotator bone separate from wheel bone
     "v_wheel_L01"
     "v_wheel_R01_rotator"
     "v_wheel_R01"
     "v_wheel_L02"
     "v_wheel_R02"
     // ... IK target helper bones, spring bones, axis bones ...
    }
   }
   // body mask — S105 dashboard and mirror bones
   AnimSrcGCTBoneMask body {
    Bones {
     "v_dashboard_fuel"
     "v_dashboard_oil_temp"
     "v_dashboard_rpm"
     "v_dashboard_speed"
     "v_mirror_interior_upper"
     "v_wiper_L"
     "v_wiper_R"
     "v_mirror_L01"
     "v_mirror_R01"
     "v_mirror_interior_bottom"
    }
   }
   // No Turret or Turret_Pose masks — S105 has no turret
  }
 }
 GraphFilesResourceNames {
  "{BE8BAF6285281572}Assets/Vehicles/Wheeled/S105/workspace/S105.agf"
 }
 // S105.agr does NOT have a DefaultRunNode line — LAV25 does ("MasterControl")
}
```

---

## Section 8: Annotated LAV25 Example

Key sections of LAV25.agr with inline comments.

```
AnimSrcGraph {
 AnimSetTemplate "{968D52F76BB570C9}Assets/Vehicles/Wheeled/LAV25/workspaces/LAV25.ast"
 ControlTemplate AnimSrcGCT "{6056956E70B46E13}" {
  Variables {
   // --- Vehicle dynamics (LAV25 ranges) ---
   AnimSrcGCTVarFloat VehicleSteering {
    MinValue -1      // no DefaultValue — LAV25 omits explicit defaults on most vars
    MaxValue 1
   }
   // --- Wheel rotation (8-wheel: indices 0-7) ---
   AnimSrcGCTVarFloat wheel_0 {
    MinValue -360
    MaxValue 360
   }
   // ... wheel_1 through wheel_7 follow same pattern
   // --- Suspension (8-wheel: indices 0-7) ---
   AnimSrcGCTVarFloat suspension_0 {
    MinValue -1
    MaxValue 1
   }
   // --- Steering (three variables for multi-axle all-wheel steering) ---
   AnimSrcGCTVarFloat steering {
    MinValue -50
    MaxValue 50
   }
   AnimSrcGCTVarFloat steering_axle2 {
    MinValue -50
    MaxValue 50
   }
   AnimSrcGCTVarFloat steering_delay {
    MinValue -50
    MaxValue 50
   }
   // --- RPM ---
   AnimSrcGCTVarFloat Gearbox_RPM {
    MinValue -10000
    MaxValue 10000
   }
   AnimSrcGCTVarFloat Engine_RPM {
    MaxValue 10000   // min omitted = implicit 0
   }
   // --- Turret variables ---
   AnimSrcGCTVarFloat TurretRot_Antennas {
    DefaultValue 0
    MinValue -1
    MaxValue 1
   }
   AnimSrcGCTVarFloat Gunner_sights_cover {
    DefaultValue -0.71   // starts closed
    MinValue -0.71
    MaxValue 1.4
   }
   // --- Amphibious variables ---
   AnimSrcGCTVarFloat WaterLevel {
    MaxValue 100
   }
   AnimSrcGCTVarFloat IsSwimming {
    MaxValue 1
   }
   // --- Door state (bitmask int, not float) ---
   AnimSrcGCTVarInt VehicleDoorState {
    MaxValue 298754968
   }
  }

  IkChains {
   // Character limb chain — complete definition (same in every vehicle)
   AnimSrcGCTIkChain LeftLeg {
    Joints {
     "leftleg"
     "leftlegtwist"
     "leftknee"
     "leftkneetwist"
     "leftfoot"
    }
    MiddleJoint "leftknee"
    ChainAxis "+y"
   }
   // Vehicle single-bone chains — no MiddleJoint, no ChainAxis
   AnimSrcGCTIkChain suspension0 {
    Joints {
     "v_suspension0"   // v_ prefix mandatory
    }
   }
   // Multi-bone vehicle chain — MiddleJoint present, ChainAxis omitted
   AnimSrcGCTIkChain Visor_cover_arm_L {
    Joints {
     "v_gunner_sight_cover_arm_01"
     "v_gunner_sight_cover_arm_02"
     "v_gunner_sight_cover_arm_03"
    }
    MiddleJoint "v_gunner_sight_cover_arm_02"
   }
  }

  // GlobalTags — uppercase, identifies vehicle type for runtime queries
  GlobalTags {
   "VEHICLE"
   "WHEELED"
   "LAV25"
  }
 }
 GraphFilesResourceNames {
  "{AB712A4DC2D3CD0A}Assets/Vehicles/Wheeled/LAV25/workspaces/LAV25.agf"
 }
 // DefaultRunNode MUST match the Queue node name at the root of the AGF
 DefaultRunNode "MasterControl"
}
```

---

## Section 9: Common Pitfalls

- Missing `v_` prefix on vehicle bone names — IK chains silently fail, bones do not move, no error or warning is shown.

- Wrong `ChainAxis`: `LeftLeg` uses `"+y"`, `RightLeg` uses `"-y"`, `LeftArm` uses `"+y"`, `RightArm` uses `"-y"`. Swapping these causes IK to fold the limb in the wrong direction.

- IK chain joint order must be proximal to distal: hip → knee → foot, shoulder → elbow → hand. Reversed order = IK solve produces garbage results.

- Variable range mismatch: if `wheel_N` MaxValue is 360 but the physics system pushes the value higher, the animation clamps to the last keyframe and the wheel appears to stop spinning at high speed.

- Dial expression must produce 0-1: use `clamp(Engine_RPM / 10000, 0, 1)` not the raw variable. A raw variable value (e.g. 8000) passed directly to a Pose node will either max out or do nothing.

- `DefaultRunNode` in AGR must exactly match the Queue node name at the root of the AGF. Mismatch = the graph never runs. The convention used in LAV25 is `"MasterControl"`.

- AGF file path in `GraphFilesResourceNames` must be GUID-prefixed after registering with Workbench: `"{GUID}path/to/Vehicle.agf"`. A bare path without GUID prefix will not resolve.

- `VehicleAnimationComponent` auto-feeds all standard variables (wheel rotation, suspension, steering, speed, RPM etc.) every frame. Do not attempt to set `wheel_N` or `suspension_N` from script — the component will overwrite the value immediately.

- Do not add nodes to AGF by file edit. Workbench re-serializes the entire AGF on open and discards any manually added node blocks. Only the AGR (variables, commands, IkChains, BoneMasks, GlobalTags, DefaultRunNode) survives file edits.

- LAV25 spells its chassis mask `Chasis` (one 's'). If you reference it as `Chassis` in AGF node mask assignments, the mask will not match and the wrong bones will be written.

- S105 does not have a `DefaultRunNode` line in its AGR. LAV25 does. Omitting it is valid if the AGF has only one root node, but adding it explicitly is safer.

- `SeatPositionType` MaxValue differs between vehicles: LAV25 uses 10, S105 uses 15. Set it to match the actual maximum seat index your AST defines.

---

## Section 10: Animation Workspace (.aw) File and the Duplicate Project Workflow

### What is the .aw file?

The `.aw` (Animation Workspace) file is the Animation Editor's project file. It holds references to all animation files belonging to one vehicle:

```
BaseSource {
 AnimSetTemplate "{GUID}Anims/MyVehicle/MyVehicle.ast"
 AnimSetInstances {
  "{GUID}Anims/MyVehicle/MyVehicle_vehicle.asi"
  "{GUID}Anims/MyVehicle/MyVehicle_player.asi"
 }
 AnimGraph "{GUID}Anims/MyVehicle/MyVehicle.agr"
 PreviewModels {
  AnimSrcWorkspacePreviewModel "{GUID}" {
   Model "{GUID}Assets/Characters/Animation/AnimTestChar_US_01.xob"
  }
  AnimSrcWorkspacePreviewModel "{GUID}" {
   Model "{GUID}Assets/Vehicles/Wheeled/MyVehicle/MyVehicle_base.xob"
  }
 }
 ChildPreviewModels {
  AnimSrcWorkspaceChildPreviewModel "{GUID}" {
   Enabled 1
   Model "{GUID}Assets/Vehicles/Wheeled/MyVehicle/MyVehicle_turret.xob"
   Bone "v_turret_slot"
   Parent "{GUID}"
  }
 }
 AudioTesting AnimSrcWorkspaceAudioTesting "{GUID}" {}
 AttachmentTesting AnimSrcWorkspaceAttachmentTesting "{GUID}" {}
 IkTesting AnimSrcWorkspaceIkTesting "{GUID}" {}
}
```

Opening the `.aw` file in the Animation Editor loads the full workspace: the AGR, AGF node graph, AST, and ASI, plus the preview models so you can see the vehicle mesh while editing.

### Duplicate Project Workflow (Recommended Starting Point)

This is the fastest way to create a complete, correctly wired animation project for a new vehicle:

1. **Find the closest base game `.aw`** in the Asset Browser:
   - 4-wheel civilian: `Assets/Vehicles/Wheeled/S105/workspace/S105.aw`
   - 8-wheel armored: `Assets/Vehicles/Wheeled/LAV25/workspaces/LAV25.aw`

2. **Double-click the `.aw`** to open it in the Animation Editor.

3. **Edit menu → Duplicate Project** — Workbench opens a folder picker.

4. **Choose your mod output folder** (e.g. `Anims/MyVehicle/`). Workbench copies ALL referenced files:
   - `MyVehicle.aw` (the workspace file, renamed)
   - `MyVehicle.agr` (copy of base game AGR)
   - `MyVehicle.agf` (copy of base game node graph)
   - `MyVehicle.ast` (copy of base game animation set template)
   - `MyVehicle_vehicle.asi`, `MyVehicle_player.asi` (copy of ASI files)
   - All GUIDs are newly assigned — no GUID conflicts with base game files.

5. **Edit the AGR**: remove variables, IK chains, and bone masks that do not apply to your vehicle; add new ones as needed. AGR edits via file editor are safe.

6. **Edit the AGF node graph** in the Animation Editor. Adjust node connections to match your new bone names and variable set.

7. **Edit the AST/ASI**: update animation group names and column mappings to match your vehicle's animations.

### Why not just create files from scratch?

- Duplicating preserves the correct internal structure and GUID wiring — no risk of a malformed `.agf` that Workbench silently rejects.
- The `.agf` node graph cannot be meaningfully authored by file edit (Workbench re-serializes on open). Duplicating gives you a valid starting graph to modify via the UI.
- AGR, AST, and ASI are safe to author from scratch (they survive file edits), but duplicating saves time when starting from a similar vehicle.

### When to use the animation_graph_author / animation_graph_setup tools

Those tools generate fresh AGR and AST files when:
- No suitable base game vehicle exists to duplicate from.
- You want a clean minimal scaffold with only the variables and IK chains you need.
- You are building a non-wheeled vehicle type with a significantly different structure.

In all cases, the AGF must still be built or edited via the Animation Editor UI — generated AGR/AST files are the starting point, not the complete project.
