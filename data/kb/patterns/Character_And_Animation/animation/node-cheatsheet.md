# AGF Node Cheat Sheet

Quick index of every node type. One-line summary + key properties. Read this first.
For full detail on any node, read `node-reference.md`.

---

## Grouping by purpose

### Leaf nodes (produce a pose, no children)

| Node | What it does | Key properties |
|---|---|---|
| `BindPose` | Outputs the skeleton's rest/bind pose. Default leaf when no clip needed. | — |
| `Source` | Plays a baked clip from the ASI. | `Source "group.column.anim"`, `Looptype Loop/Once` |
| `SourceInLoopOut` | Like Source but has a distinct loop section and outro. | — |
| `SourceSync` | Plays a clip synchronised to another Source node's time. | — |
| `Pose` | Samples a single static frame from a clip based on a float expression. | `Expression` |
| `Pose2` | Samples a frame based on two float expressions + 2D blend map. | `ExpressionX`, `ExpressionY` |

### Bone transform nodes

| Node | What it does | Key properties |
|---|---|---|
| `ProcTransform` | Applies procedural math transforms to named bones. The primary tool for variable-driven or time-driven bone motion. | `Expression "1"` (blend weight), `Bones {}` list with `Op Rotate/Translate`, `Amount "expr"`, `Axis X/Y/Z` |
| `Constraint` | Parent/position constraint — locks a bone to another bone's position or transform. | Sub-types: `AnimSrcConstraintPosition`, `AnimSrcConstraintParent` |
| `Memory` | Saves bone transforms into node memory and re-applies them on subsequent frames. | Bone list |
| `Filter` | Strips all bones from the pose except those in a named bone mask. | `BoneMask` |

### Blending nodes

| Node | What it does | Key properties |
|---|---|---|
| `Blend` | Instantly blends between two children by a 0–1 weight. | `BlendWeight "expr"`, `Child0`, `Child1` |
| `BlendN` | Interpolates across N children by threshold value. Good for directional blends. | `BlendWeight`, `Thresholds {}`, `Children {}` |
| `BlendT` | Timed crossfade between two children triggered by expressions. | `TriggerOn "expr"`, `TriggerOff "expr"`, `BlendInTime`, `BlendOutTime` |
| `BlendTAdd` | Like BlendT but Child0 is always the main path. Used for additive overlays. | Same as BlendT |
| `BlendTW` | Smoothly moves blend weight toward a target value over time. | `TargetWeight "expr"`, `BlendSpeed` |
| `RBF` | Radial Basis Function — blends N poses weighted by proximity of input values to sample points. | Sample points, input variables |

### Routing / control flow

| Node | What it does | Key properties |
|---|---|---|
| `Queue` | Runs a primary child continuously; can enqueue secondary one-shot animations on top. | `Child`, `QueueItems {}` with `StartExpr`, `BlendInTime`, `BlendOutTime` |
| `StateMachine` | Manages exclusive states with transition conditions. | `states {}` list of `State` nodes, each with `Child`, `StartCondition` |
| `State` | One state inside a StateMachine. | `Child`, `StartCondition "expr"`, `TimeStorage` |
| `Switch` | Randomly picks a different child each time the current one finishes. | Children list |
| `Sleep` | Skips child evaluation entirely when `AwakeExpr` is false. Returns frozen last pose. Good for LOD/performance. | `AwakeExpr "expr"` |
| `Tag` | Adds string tags to the pose that propagate up for script/audio to read. | `Tags {}` |

### Time control

| Node | What it does | Key properties |
|---|---|---|
| `TimeScale` | Speeds up or slows down animation playback in its subtree. | `Scale "expr"`, `TimeStorage "Real Time"` |
| `TimeSave` | Saves current time value to a named stash for sharing across subtrees. | `Stash "name"` |
| `TimeUse` | Restores a stash saved by TimeSave so two subtrees share the same playback time. | `Stash "name"` |

### Variable manipulation

| Node | What it does | Key properties |
|---|---|---|
| `VarSet` | Overrides a variable to a new value within its subtree scope. | `VarSet {}` list of float/bool items with `Value "expr"` |
| `VarUpdate` | Rate-limits how fast a variable can change per second (smoothing). | `Varupdate {}` items with `MaxDifferencePerSecond` |
| `VarReset` | Resets variables back to the raw game-provided value, undoing any VarSet. | Variable name list |

### Context / buffer sharing

| Node | What it does | Key properties |
|---|---|---|
| `CtxBegin` | Top of a protected block. Child subtree is evaluated in isolation. | `Child` |
| `CtxEnd` | Bottom of the protected block. Result is merged back. Use with CtxBegin. | `Child` |
| `BufferSave` | Snapshots the current pose (or a bone-masked subset) into named storage. | `BufferName`, `BoneMask` |
| `BufferUse` | Restores a pose snapshot saved by BufferSave. | `BufferName` |

### IK nodes

| Node | What it does | Key properties |
|---|---|---|
| `IK2` | Applies an IK solver to a named chain. Solver type is set as a sub-block. | `Chains {}`, `Solver` (FabrikSolver / TwoBoneSolver / LookAtSolver / etc.) |
| `IK2Plane` | IK constrained to a plane. | — |
| `IK2Target` | Sets IK target positions from named bone transforms. | `Bones {}` list mapping IkTarget to bone |
| `IKLock` | Locks a bone in world space (e.g. foot plant). | — |
| `IKRotation` | Applies a rotation IK constraint. | — |

### Function / event nodes

| Node | What it does | Key properties |
|---|---|---|
| `FunctionBegin` | Start of a reusable subgraph function block. | — |
| `FunctionCall` | Calls a named function block. | `Function "name"` |
| `FunctionEnd` | End of a function block. | — |
| `AnimSrcEventGeneric` | Fires a generic animation event at a specific time. | — |
| `AnimSrcEventAudio` | Fires an audio event at a specific animation time. | — |
| `Attachment` | Connects a separate animation graph instance (e.g. held weapon with its own graph). | `Binding "name"` |
| `Group Select` | Selects an animation group based on a variable (e.g. weapon type). | — |

---

## Common expressions reference

| Expression | Result |
|---|---|
| `GetUpperRTime()` | Continuously advancing wall-clock seconds. Use for time-driven motion. |
| `GetDeltaTime()` | Frame delta time in seconds. |
| `GetStateTime()` | Seconds spent in current State. Use for dwell-time conditions. |
| `GetLowerTime()` | Time of previous State. Use in Transition `Start Time` to sync animations. Post Eval required. |
| `GetRemainingTime()` | Time remaining in current animation. Post Eval required. |
| `RemainingTimeLess(f)` | True when remaining time < f. Post Eval required. |
| `GetLOD()` | Current LOD level (0 = highest). Use for performance branching. |
| `rad(x)` / `deg(x)` | Degrees ↔ radians. |
| `sin(x)`, `cos(x)` | Trig functions operating on radians. |
| `clamp(x, min, max)` | Clamp value. |
| `abs(x)` | Absolute value. |
| `min(a,b)` / `max(a,b)` | Lesser / greater of two values. |
| `normalize(v, min, max)` | Maps v from [min–max] range to [0–1]. |
| `inRange(v, min, max)` | True if min <= v <= max. |
| `Random01()` | Random float 0–1. |
| `RandomPerc(pct)` | True with pct% probability (0–100). |
| `HasVariableChanged(var)` | True if variable changed this frame. |
| `HasVariableChangedTo(var, new)` | True if variable changed to a specific new value. |
| `IsCommand(cmd)` | True if the named command is being called. |
| `IsEvent("name")` | True if animation event was sampled. Post Eval only. |
| `IsTag("name")` | True if tag is set on current pose. Post Eval only. |
| `MyVariableName` | Read a graph variable by name directly in any expression. |
| `2π / N` = `6.2832 / N` | Angular velocity for one full rotation every N seconds when multiplied by `GetUpperRTime()`. |

**Post Eval** must be enabled on a Transition whenever the condition uses any time, event, or tag function. See `state-machine-guide.md` for full details.

---

## Confirmed working patterns (quick ref)

**EditorPos spacing:** Nodes should be ~2 units apart (e.g. `0 0`, `2 0`, `4 0`). Values of 100–200 per node make them appear far apart in the editor.

**Continuous bone rotation on X axis, speed controlled by variable:**
```
AGR variable: AnimSrcGCTVarFloat RotationSpeed { DefaultValue 2.094 MinValue 0 MaxValue 20 }
AGF: Queue (EditorPos 0 0) → ProcTransform (EditorPos 2 0, Amount "GetUpperRTime() * RotationSpeed", Op Rotate) → BindPose (EditorPos 4 0)
```

**Two-state blend driven by a float variable:**
```
Queue → Blend (BlendWeight "MyFloat") → Child0: BindPose, Child1: ProcTransform
```

**State machine with two states:**
```
Queue → StateMachine → State A (StartCondition "MyVar == 0") → BindPose
                     → State B (StartCondition "MyVar == 1") → ProcTransform
```
