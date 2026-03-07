# Character Gear & Animation Data

---

## Animation Workspace Structure

```
Workspace (.aw)
├── Anim Template (.ast)   — structural schema: groups, lines, columns
├── Anim Instances (.asi)  — one per weapon/character variant; fills template with .anm files
├── Sheets (.agf)          — one or more node graph pages
├── Sync Table (.asy)      — normalised sync event timings per cycle
└── Preview Models         — .xob/.ent to preview animations on
```

**Templates vs Instances:** Template defines slots (groups/lines/columns). Instances fill them with `.anm` files. One graph, multiple instances. Power: one `Reload` line in template → each weapon instance supplies its own reload animation.

**Workflow:**
1. Right-click `Anim Template` → Create, name `player_template`.
2. Right-click `Anim Instances` → Create, name first `player_unarmed`.
3. Right-click `Preview Models` → add character model.
4. In Anim Set: open File Browser, select `.anm`, click `F→L` (creates line named after file).
5. Right-click line → `Group Animations`. Right-click column header → rename.
6. Click red dot under column → select animation in File Browser → `Set Anim`.

---

## Animation Graph Nodes

### Source Nodes

| Node | Description | Key Properties |
|---|---|---|
| `Source` | Plays animation clip. Loopable. | `Source` (3-part `Group.Column.Anim`), `Looptype`, `Interpolate`, `Predictions`, `ReportDistance` |
| `Source InLoopOut` | Plays in 3 segments: intro→loop→outro. Leaves loop when condition met. | `Source`, `InEvent`, `OutEvent`, `EndExpression` |
| `Source Sync` | Plays using normalised time — synchronises across speed transitions. | `Source`, `SyncLine`, `Looptype` |
| `Pose` | Samples single frame using expression (no playback). For steering/vehicle poses. | `Source`, `Time` (0–1 normalised) |
| `Pose 2` (Pose 2D) | Samples frame from 2D variable table. Intermediate values interpolate. For aim space/look-at. | `Source`, `ValueX`, `ValueY`, `Table` |
| `Bind Pose` | Samples bind (rest) pose. Required leaf node for ProcTransform graphs. | `BoneMask` |

### Blend Nodes

| Node | Description | Key Properties |
|---|---|---|
| `Blend` | Blends two children by weight. Additive or normal. | `BlendWeight` (0–1), `Child0`, `Child1`, `BlendFn`, `SelectMainPath` |
| `Blend N` | Blends N children by value against thresholds. For directional blending (0–360°). | `BlendWeight`, `Thresholds`, `Children`, `IsCyclic` |
| `Blend T` | Time-based blend to secondary child when condition met. | `BlendTime`, `TriggerOn`, `TriggerOff`, `Condition`, `Child0`, `Child1`, `PostEval` |
| `Blend T Add` | Like Blend T but primary always stays main path. Good for additive. | Same as Blend T + `AdditiveAlways` |
| `Blend TW` | Time-based blend toward target weight value. | `TargetWeight`, `BlendTime`, `BlendTimeFn` |

### Other Flow Nodes

| Node | Description |
|---|---|
| `Queue` | Primary child always plays; secondary animations enqueued on top. Per queue item: `StartExpr`, `InterruptExpr`, `BlendInTime`, `BlendOutTime`, `EnqueueMethod` |
| `Switch` | Randomly plays one child; switches when current finishes. `FirstProbabilities`, `SwitchItems` |
| `State Machine` | Contains States and Transitions. See State Machine section. |

### Buffer Nodes

**Why needed:** Blending anim A (all bones) with anim B (partial bones) causes ticking — blending bone to "nothing." Buffer nodes fix this.

| Node | Description |
|---|---|
| `Buffer Save` | Snapshots current pose buffer to named storage. `BufferName`, `BoneMask`, `Child` |
| `Buffer Use` | Restores saved buffer to fill missing bone gaps. `BufferName`, `BoneMask` |
| `Filter` | Applies bone mask to current pose buffer. `Child`, `BoneMask`, `Condition` |

**Blend rules:**
- Abs + Abs → LERP (OK)
- Abs + Diff → Diff added on top of Abs (additive, OK)
- Any + Any with missing bones → ticking. Fix with Buffer Save/Use.

### IK Nodes

| Node | Description |
|---|---|
| `IK2` | Applies IK on bone chain to reach target. Solvers: `FabrikSolver`, `TwoBoneSolver`, `LookAtSolver`, `LookInDirSolver`, `PoleSolver` |
| `IK2 Plane` | IK to reach target plane (e.g. foot IK on terrain). `ActiveDistance`, `ThresholdSmoothness` |
| `IK2 Target` | Creates IK targets from bone/chain model-space positions. |
| `IK Lock` | Locks IK target in place, applies 2-bone IK. `IsLocked` expr, `BlendinTime`, `BlendoutTime`, `World` |
| `IK Rotation` | IK for rotation only (no translation). Good for spine IK. |
| `Weapon IK` | Positions arms based on aim; snaps arms to weapon via 2-joint IK. `IkconfigName`, `WeightAim`, weapon direction/offset properties |

### Control / Utility Nodes

| Node | Description |
|---|---|
| `Procedural` (`ProcTransform`) | Applies procedural transforms on bones/IK targets using expressions. Per-bone: `Bone`, `Op`, `Axis`, `Space`, `Amount`, `PivotBone` |
| `Constraint` | Locks bones: `ConstraintPosition` (translation limits), `ConstraintParent` (translation+rotation) |
| `Memory` | Saves bone pose to memory; restores on frames where bone is absent |
| `Sleep` | Disables child evaluation when `AwakeExpr` false for `Timeout` duration. Major perf saver — use as master root |
| `Attachment` | Dynamic link to another workspace (e.g. weapon/vehicle). Connected by binding name |
| `Group Select` | Sets active column in anim set group so Source nodes below can omit column name |
| `Event` | Fires named events. Types: `AnimSrcEventGeneric` (UserString, UserInt), `AnimSrcEventAudio` |
| `Tag` | Adds tags to animation output. `Tags`, `ChildTags` |
| `Ctx Begin / End` | Protects subgraph state — only first branch reaching Ctx End passes through |
| `Function Begin / Call / End` | Reusable graph blocks. `Function Call` redirects by name; `End` has `EndIndex` to resume |
| `Time Save / Use` | Saves/restores named time stash |
| `Time Scale` | Multiplies time in subtree. `TimeExpr`, `TimeMappingTable` |
| `Var Set` | Sets variable values scoped to child nodes. `VarSetBoolItem`, `VarSetIntItem`, `VarSetFloatItem` |
| `Var Reset` | Resets variables to original game input |
| `Var Update` | Limits variable update rate/conditions |

---

## State Machine

### State Properties

| Property | Description |
|---|---|
| `Link` | Connects to Source, Blend, or nested State Machine |
| `Time: Notime` | No time; child state machine handles its own time |
| `Time: Realtime` | Real-time clock for looping/transitioning animations |
| `Time: Normtime` | Normalised time (0–1 per cycle) |
| `Start Condition` | First true state on init becomes active |
| `Exit` | Passes this state's time to parent state machine |

### Transition Properties

| Property | Description |
|---|---|
| `Condition` | Expression to trigger transition |
| `Post Eval` | **MUST tick** when using time-based functions (`RemainingTimeLess`, `GetLowerTime`, `IsEvent`, `IsTag`, etc.) |
| `Duration` | Blend duration in seconds. **Must be float: write `0.3`, not `0` — integers cause errors** |
| `Start Time` | Starting time on target state. Use `GetLowerTime()` for foot sync |
| `Blend Fn` | Lin, SStart, SEnd, S, S2 |

### Condition Operators

`==`, `!=`, `>`, `<`, `>=`, `<=`, `!`, `&&`, `||`

### Built-in Functions (complete)

| Function | Post Eval? |
|---|---|
| `abs(v)`, `clamp(v,min,max)`, `cos(v)`, `sin(v)`, `deg(v)`, `rad(v)` | No |
| `float(v)`, `int(v)`, `max(a,b)`, `min(a,b)` | No |
| `normalize(v,min,max)`, `inRange(v,min,max)`, `inRangeExclusive(v,min,max)` | No |
| `isbitset(v,bit)`, `maskint(v,mask)` | No |
| `Random01()`, `RandomPerc(pct)` | No |
| `GetCommandF("name")`, `GetCommandI("name")`, `GetCommandIa/b/c/d("name")` | No |
| `HasVariableChanged(var)`, `HasVariableChangedTo(var,val)`, `HasVariableChanged(var,old,new)` | No |
| `IsAttachment("name")`, `IsCommand("cmd")` | No |
| `GetStateTime()`, `GetUpperNTime()`, `GetUpperRTime()` | No |
| `GetEventTime("anim","event")` | **YES** |
| `GetLowerRTime()`, `GetLowerTime()` | **YES** (when in transition) |
| `GetRemainingTime()`, `RemainingTimeLess(f)` | **YES** |
| `IsEvent("eventName")`, `IsTag("tagName")` | **YES** |
| `LowerNTimePassed(f)`, `UpperNTimePassed(f)` | **YES** |

---

## Pose 2D Node

Maps 2D variables to animation frames. X/Y values select frames; intermediate values interpolate.

**Table structure example (3×3):**
```
Y(-90): X(-90)=0, X(0)=1, X(90)=2
Y(0):   X(-90)=3, X(0)=4, X(90)=5
Y(90):  X(-90)=6, X(0)=7, X(90)=8
```

**Rules:**
- X values within each row must be strictly ascending.
- Y values must be strictly ascending.
- Grid does not have to be square.

---

## Sync Tutorial

**Problem:** Locomotion animations at different speeds must stay foot-synchronised.

**Solution:**
1. **Event Table (`.ae`):** Named foot events (`RFootDown`, `LFootUp`, etc.).
2. **Sync Table (`.asy`) with Sync Lines:** Map event names to normalised time (0–1 per cycle). Example: 32-frame walk, right footfall at frame 8 → normalised = `0.25`.
3. **Source Sync Node:** Assign Sync Line; uses normalised time for playback.
4. **Transition Start Time:** `GetLowerTime()` in the `Start Time` field + tick `Post Eval`.

---

## Animation Export Profiles (`.apr`)

Default location: `\anims\export_profiles\`

### Export Type Codes

| Code | Use |
|---|---|
| `TRA` | Full body locomotion — all absolute |
| `TRD` | Additive (spine in reload — locomotion bleeds through) |
| `RD` | Rotation-only differential |
| `TRG` | Root/Scene_Root with genFn |

**Generate Default Profile:**
1. Enable `Generate Default Profile` in Workbench import settings → `Reimport Resource`.
2. Profile created in `/anims/export_profiles/`. Path logged in Console Log.
3. **Immediately disable the option** — it regenerates on every reimport.

**Critical Blender pitfall:** `defaultFn` must be `""`. Any non-empty value corrupts additive animation export.

---

## Human Variables Reference

### Locomotion

| Variable | Type | Range | Description |
|---|---|---|---|
| `MovementSpeed` | float | 0–3 | 0=stopped, 1=walk, 2=run, 3=sprint |
| `MovementSpeedReal` | float | — | Actual m/s |
| `MovementDirection` | float | -180–180 | 0=forward, -90=left |
| `HasLocomotionInput` | bool | — | Any locomotion input |
| `Stance` | int | 0–2 | 0=standing, 1=crouching, 2=prone |
| `FloorAngle` | float | -90–90 | Terrain slope (front/back) |
| `FloorAngleLateral` | float | — | Terrain slope (lateral) |

### Aim/Look

| Variable | Type | Range | Description |
|---|---|---|---|
| `ADS` | bool | — | Aiming down sights |
| `AimX` / `AimY` | float | -180–180 / -90–90 | Aim angles |
| `LookX` / `LookY` | float | -180–180 / -90–90 | Look angles |
| `ADSAdjust` | float | 0–1 | 0=crouched posture, 1=standing (obstacle) |
| `FreeLook` | bool | — | Freelook active |

### Weapon State

| Variable | Type | Description |
|---|---|---|
| `TriggerPulled` | bool | Trigger finger pressed |
| `Firing` | bool | Weapon firing |
| `State` | int | -1=safe, 0=semi, 1=burst, 2=full auto |
| `WeaponObstruction` | bool | Raised to avoid obstacle |
| `WeaponDeployed` | bool | On bipod/surface |
| `Bipod` | bool | Bipod deployed |
| `LastBullet` | bool | Last round (bolt-hold-open) |
| `Empty` | bool | Weapon empty |
| `Cocked` | bool | Pistol cocked |
| `UGL` | bool | Underbarrel grenade launcher active |
| `SightElevation` | float | Zeroing adjustment state |

### Gear Offsets (cloth interaction)

| Variable | Type | Range | Source |
|---|---|---|---|
| `GearFB` | float | 0–0.09 | Z-forward weapon offset → `BaseLoadoutClothComponent.DepthFrontBack` |
| `GearLR` | float | 0–0.08 | Left elbow X offset → `BaseLoadoutClothComponent.DepthLeftRight` |

### Vehicle

| Variable | Type | Description |
|---|---|---|
| `VehicleSteering` | float | -1–1 steering input |
| `VehicleThrottle` | float | 0–1 throttle foot |
| `VehicleClutch` | float | 0–1 clutch foot |
| `VehicleBrake` | bool | Braking |
| `VehicleSpeed` | float | m/s |
| `Vehicle_Wobble` | float | Terrain roughness wobble |
| `IsDriver` | bool | Character is driver |
| `VehicleAccelerationFB` / `LR` | float | -1–1 acceleration forces |

### Helicopter

| Variable | Description |
|---|---|
| `CyclicAside` / `CyclicForward` | Cyclic control (-1–1) |
| `Collective` | Collective input (-1–1) |
| `AntiTorque` | Tail rotor (-1–1) |

### Status/Misc

| Variable | Description |
|---|---|
| `Focused` | Gadget (binoculars/compass) focused |
| `BodyPart` | Body part to bandage |
| `BandageSelf` | Bandaging self vs another |
| `IdlesOff` | Idle animations disabled |
| `IsControlledByPlayer` | Disables AI idles |
| `Lean` | -1–1 left/right lean |
| `TurnAmount` | -2–2 for CMD_Turn (-2=left 180°, -1=left 90°, 1=right 90°, 2=right 180°) |

---

## Character Action Commands

### CMD_Weapon_Reload Integer Values

| Value | Action |
|---|---|
| 0 | None |
| 1 | Rack bolt |
| 2 | Attach magazine (no bolt rack) |
| 3 | Attach magazine + rack bolt |
| 4 | Detach + attach magazine (no bolt rack) |
| 5 | Detach + attach magazine + rack bolt |
| 6 | Detach mag only |
| 7 | Insert single projectile (UGLs) |
| 8 | Remove single projectile (UGLs) |
| 9 | Remove all projectiles + reinsert (UGLs) |
| 10 | Skip animation, instant reload |

**Float parameter** (bolt action type): `0.0` = rack bolt, `1.0` = release bolt.

| Int | Float | Result |
|---|---|---|
| 3 | 0.0 | Insert mag → rack bolt |
| 3 | 1.0 | Insert mag → release bolt |
| 4 | 0.0 | Remove + insert mag → rack bolt |
| 4 | 1.0 | Remove + insert mag → release bolt |

---

## Animation Instances Reference Table

### Weapon Instance Slots

| Slot | Export Profile | Notes |
|---|---|---|
| `BoltPose` | `w_rfl_xxx_bolt_pose` | Frame 0=closed, last=open |
| `Fire` | `w_rfl_xxx_fire` | Full fire cycle |
| `Trigger` | `w_rfl_xxx_trigger` | Trigger press |
| `Safety` | `w_rfl_xxx_safety` | Frame 0=safe, 1=semi, 2=auto |
| `Sight` | `723_Weapon_Sight` | Frame count = number of zeroing modes |
| `Reload_InsertMag` | `w_rfl_xxx_mag_insert` | — |
| `Reload_RemoveMag` | `w_rfl_xxx_mag_remove` | — |
| `ReloadActionBolt` | `w_rfl_xxx_bolt_rack` | — |
| `Idle`, `Idle_finger`, `Switch_Mode_On/Off` | `999_Empty` | Must match player frame count for Switch_Mode |

### Player Instance Slots

| Slot | Export Profile | Notes |
|---|---|---|
| `IKOffset` | `101_FullBodyABS` | IK offset pose |
| `Reload_InsertMag/RemoveMag/ActionBolt` | `252_UpperbodyADD_ArmsABS` | Erected + Prone variants |
| `Fire` | `401_RIndexABS` | Same anim as Trigger |
| `Finger_trigger_in/out`, `Idle_finger`, `Safety` | `502_IK_RightHand` | — |
| `Switch_Mode_Off/On` | `262_ArmsADD_RHandABS` | Off can share anim with On |
| `Sight` | `999_Empty` | Same frame count as weapon Sight |
| `Animation IK Pose` | `501_IK` | Set in `SCR_WeaponAttachmentsStorageComponent > Item Animation Attributes` |

---

## Character SoundInfo Signals

The `SoundInt` integer on gear/weapon components drives context-aware movement sounds.

### Signal Names by Gear Slot

| Slot | Signal Name |
|---|---|
| Helmet/Head Cover | `HeadCoverSoundInfo` |
| Face Cover | `FaceCoverSoundInfo` |
| Jacket | `JacketSoundInfo` |
| Vest | `VestSoundInfo` |
| Pants | `PantsSoundInfo` |
| Boots | `BootsSoundInfo` |
| Backpack | `BackPackSoundInfo` |
| ALICE suspenders | `Attachment1SoundInfo` |

### Weapon Sound Signals

Three signals per held weapon: `SightSoundInt`, `RHItemSoundInfo` (right hand), `BackItemSoundInfo` (back slot).

### SoundInt Ranges by Category

| Category | Range |
|---|---|
| UGLs/Underbarrel | 9000–9999 |
| Pistols | 1010000+ |
| Rifles | 1020000+ |
| Long Rifles | 1030000+ |
| LMGs | 1040000+ |
| Launchers | 1050000+ |

SoundInt encoding: `1 02 01 00` → category `1`, group `02`, type `01`, variation `00`.

---

## Character Gear Creation

Sample source files: [Arma-Reforger-Samples/SampleMod_NewCharacter](https://github.com/BohemiaInteractive/Arma-Reforger-Samples/tree/main/SampleMod_NewCharacter)

**Key conventions:**
- Follow LOD naming: `_LOD0` through `_LOD3` suffix on mesh objects.
- Collider naming: see [resource-manager-blender.md](../Tools_And_Workbench/resource-manager-blender.md).
- `BaseLoadoutClothComponent.DepthFrontBack / DepthLeftRight` feed `GearFB` and `GearLR` animation variables.
- Add `SoundInt` on `BaseLoadoutComponent` matching the signal table above.

---

## PAP/SIGA (Procedural Animation)

Legacy system. New work should prefer AGF `ProcTransform` nodes. PAP is still needed for vehicles and some props.

**Project:** One `.siga` (signal processing graph) + one `.pap` (bone transform graph).

### PAP Nodes

| Node | Description |
|---|---|
| `RotationSet` / `RotationMake` / `RotationBreak` | Apply/construct/split rotation on bone |
| `TranslateSet` / `TranslateMake` / `TranslateBreak` | Apply/construct/split translation on bone |
| `Bone` | Adds bone reference to project |
| `Signal` | Imports `.siga` output into `.pap` |
| `Constants` | Key-value constant pairs |

### SIGA Nodes

| Node | Description |
|---|---|
| `Input` | Engine signal (name must match engine signal name exactly) |
| `Output` | Sends value from `.siga` to `.pap` |
| `Value` | Constant number |
| `Random` | Random in Min–Max. `Update rate`: Every Get or Every Frame |
| `Smoother` | Smooths over time. `Fade-in/out time` (ms), `Fade-in/out type`, `Input resets timer` |
| `Env` | Envelope node. A/B/C/D breakpoints with fade-in/out types |
| `Convertor` | Maps named input ranges to output ranges |
| `Interpolate` | Interpolates between two values |
| `Average` | Averages inputs over time |
| Math | `Sum`, `Sub`, `Mul`, `Div`, `Pow`, `Min`, `Max`, `Abs`, `Exp`, `Ln`, etc. |
| Conversion | `Db2Gain`, `Gain2Db`, `St2Gain`, `Gain2St` |
| Clamp | `Floor`, `Ceil`, `Round`, `Clamp`, `ClampMin`, `ClampMax` |
| Trig | `Sin`, `Cos`, `Tan`, `ASin`, `ACos`, `ATan` |

### PAP Setup (Vehicle Exhaust Shake Example)

1. Create `.pap` + `.siga`.
2. In `.siga`: `Input` nodes (`EngineRPM`, `EngineOn`) + `Output` (`EngineShake`). Connect math chain.
3. In `.pap`: `Signal` node → `.siga`. `RotationMake` → `RotationSet` → `Bone` (exhaust bone).
4. On vehicle: add `CarProcAnimComponent`. Add `ProcAnimParams`, set ResourceName to `.pap`, add bone names to `BoneNames`.

**Critical pitfall:** Index of bones in `ProcAnimComponent.BoneNames` must match their order in `.pap`. `FindSignal("Sig1")` returns creation-order index. Create `.siga` inputs in the exact order you will call them from script.

---

## Live Debug

1. Start scenario (`enfusion://ResourceManager/~ArmaReforger:worlds/MP/MpTest.ent`).
2. Open Animation Editor, load workspace.
3. `Live Debug` panel → `Fetch` → select instance → `Attach`.
4. Records and replays in-game animation state — inspect variables, commands, events, tags.
5. If debugger disabled: Diag Menu (Win+Alt) → `Animation > Start Debugger`.

**Pitfall:** Game stops sending updates when alt-tabbed. Run with forced updates enabled.

---

## Key Pitfalls

| Pitfall | Fix |
|---|---|
| `defaultFn` non-empty in `.apr` + Blender | Set `defaultFn ""` — corrupts additive export otherwise |
| `Generate Default Profile` left enabled | Disable immediately after generation |
| Transition `Duration` as integer (`0`, `1`) | Must be float: `0.0`, `1.0` — integers cause errors |
| Time-based functions without `Post Eval` | Tick `Post Eval` — values only valid in UP phase |
| Foot sync lost on speed transition | `GetLowerTime()` in transition `Start Time` + `Post Eval` |
| Look-at + locomotion ticking | Use Buffer Save/Use to fill missing bones |
| Pose 2D table values not strictly ascending | X and Y values must increase monotonically |
| Wrong reload command int | See CMD_Weapon_Reload table |
| Missing `SoundInt` on gear | No movement sounds |
| `Switch_Mode` frame count mismatch | Off and On must have same frame count as counterpart |
| `Sight` frame count mismatch | Must equal number of zeroing modes in weapon config |
| PAP signal ordering wrong | Create `.siga` inputs in exact call order |
| Duplicate node names in sheet | Names are case-sensitive, must be unique per sheet |
