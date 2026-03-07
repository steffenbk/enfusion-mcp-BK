# Animation Node Reference

Full reference for every node type in the Arma Reforger Animation Graph Editor (AGF).
Distilled from the complete teaching guide. See `animation-graph.md` for file-type and
evaluation model context.

---

## Evaluation Model (Quick Reminder)

- **DOWN phase** — master node → children; determines which branches are evaluated.
- **UP phase** — poses bubble back up; blending happens here.
- Tags, remaining time, and events are only valid AFTER child nodes have returned
  (UP phase). Use `PostEval` on any node that checks these values.

---

## Node Entries

---

### Attachment

**Purpose:** Links a separate animation graph (different animation instance) into the
current graph at runtime via a named binding.

**Key properties:**
- `Binding` — name that identifies which attached graph to connect to; matched at runtime
  by the game.

**Usage pattern:** Used when a character or prop has its own animation graph that must be
driven in sync with the host character (e.g., a weapon or backpack with its own rig).
For debugging, use the Attachments Debug window in the editor to insert attachments manually.

**Gotchas:** Translating inputs into the attached graph's format carries a performance cost.
Use only when a separate animation instance is genuinely required.

---

### Blend

**Purpose:** Blends between exactly two child nodes based on a 0–1 weight value. Supports
both normal (full-body replacement) and additive blending; blending mode is determined by
data embedded in the animation tracks.

**Key properties:**
- `BlendWeight` — 0 = Child0 only, 1 = Child1 only.
- `BlendFn` — curve shape (linear, s-curve, etc.).
- `MotionVectors` — where root motion is accepted from (`Both` = blend root motion from
  both children).
- `IkTargets` — how IK targets are blended between children.
- `Optimization` — when enabled, a child with 0% influence is not evaluated (performance).
- `SelectMainPath` — when enabled, only the child with weight > 0.5 is the main path.

**Usage pattern:** Simple two-state transitions where instantaneous weight changes are
acceptable (e.g., enabling an aim overlay at full or zero weight).

**Gotchas:** Blending is immediate — there is no time-based smoothing. If you need a
timed crossfade, use BlendT instead.

---

### BlendN

**Purpose:** Blends between N child nodes, each associated with a threshold value.
Interpolates between the two surrounding thresholds based on the current BlendWeight.

**Key properties:**
- `BlendWeight` — the controlling value; the node interpolates between the two thresholds
  that surround it.
- `Thresholds` — ordered list from lowest to highest; each corresponds to one child.
- `IsCyclic` — wraps the first and last threshold so the blend cycles (e.g., directional
  angles: add a duplicate of the first child at the end with threshold 180 when the first
  is -180).
- `SelectMainPath` — child with weight > 0.5 is main path.

**Usage pattern:** Directional locomotion blending (8-directional movement), lean angles,
any parameter that selects from more than two poses.

**Gotchas:** Thresholds MUST be ordered lowest to highest or the interpolation will be
wrong. For cyclic values (angles), add an extra entry at the end that duplicates the first
child. Blending is still immediate — no time-based smoothing.

---

### BlendT

**Purpose:** Blends between two child nodes OVER TIME using `TriggerOn`/`TriggerOff`
conditions or a single `Condition` toggle. Crossfade takes `BlendTime` seconds.

**Key properties:**
- `BlendTime` — seconds to fully transition from 0 to 1 (or 1 to 0).
- `TriggerOn` — condition that starts blending toward Child1. Overrides `Condition`.
- `TriggerOff` — condition that starts blending back to Child0. Overrides `Condition`.
- `Condition` — simple toggle used when Trigger pair is not set.
- `PostEval` — when checked, trigger/condition is evaluated in the UP phase (needed when
  the condition depends on tags or remaining time set by children).
- `SelectMainPath` — path with weight > 0.5 is main path.

**Usage pattern:** Stance transitions, equip/unequip transitions, any crossfade where
you want a smooth timed blend rather than an instant switch.

**Gotchas:** If the condition reads a tag set by a child branch, you MUST enable
`PostEval`; otherwise the tag value is stale (from the previous frame).

---

### BlendTAdd

**Purpose:** Like BlendT but the primary (Child0) path is ALWAYS the main path —
designed for additive overlays blended over a base animation.

**Key properties:**
- `BlendTime` — full blend duration in seconds.
- `TriggerOn` / `TriggerOff` / `Condition` — same as BlendT.
- `Child0` — primary (always main path).
- `Child1` — additive layer.
- `AdditiveAlways` — when enabled, Child1 is evaluated even when its blend weight is 0
  (keeps its internal state alive).

**Usage pattern:** Breathing, recoil, or injury overlays that run on top of all base
animation states. Use when the additive layer must never steal the main path role.

**Gotchas:** Do not confuse with BlendT. In BlendT the main path can switch; in
BlendTAdd it never switches away from Child0.

---

### BlendTW

**Purpose:** Time-dependent blend that moves the blend weight toward a `TargetWeight`
value at a rate governed by `BlendTime`.

**Key properties:**
- `TargetWeight` — destination blend value the weight interpolates toward.
- `BlendTime` — time (in seconds) to travel from 0 to 1.
- `BlendTimeFn` — shaping applied to the delta between current and target weight.
- `OptimizeMin` — when true and weight = 0, Child1 is not evaluated.
- `OptimizeMax` — when true and weight = 1, Child0 is not evaluated.

**Usage pattern:** Smoothly following a continuously changing float target (e.g., a
blend driven by a variable that itself changes over time).

**Gotchas:** Unlike BlendT there is no explicit trigger — the node always pursues
`TargetWeight`. Ensure TargetWeight is driven by a variable or expression that updates
every frame.

---

### Queue

**Purpose:** Plays a primary (always-running) child and supports enqueuing secondary
animation actions that blend in over the primary. Supports both full-body override and
additive modes.

**Key properties:**
- `Child` — the primary child node; always evaluated regardless of queued items.
- `IkTargets` — IK target blending behavior during queue playback.

**QueueItems (`AnimSrcNodeQueueItem`) per item:**
- `Child` — the node to play for this item.
- `StartExpr` — condition that triggers this item to start.
- `InterruptExpr` — optional condition that stops the item mid-play.
- `BlendInTime` — seconds to fully blend in.
- `BlendOutTime` — seconds to fully blend out.
- `EnqueueMethod` — controls interrupt behavior:
  - `Replace` — replaces any currently playing item.
  - `Add` — queues behind the current item.
  - `Ignore` — does nothing if an item is already playing.
- `TagMainPath` — tag set on the primary path while this item plays.
- `CacheOnEnqueue` — variables/commands frozen at enqueue time
  (`AnimSrcVarCmdTempStorage` with `Variables` and `Commands` sub-fields).
- `StartTime` — optional playback start offset.

**Usage pattern:** Use as the master/top-level node of a graph. Also use for secondary
actions: reloads, grenade throws, melee hits that must blend over locomotion.

**Gotchas:** `StartExpr` fires exactly once when the condition becomes true — it does not
continuously re-trigger. Use `InterruptExpr` to stop an item early. `CacheOnEnqueue`
is essential when the item's animation depends on a variable that may change during
playback (e.g., weapon type at the moment of enqueue).

---

### Switch

**Purpose:** Randomly selects which child node to play next once the current child
finishes, using configurable probability tables. Adds variation to repeated animations.

**Key properties:**
- `BlendTime` — transition blend duration between children.
- `FirstProbabilities` — space- or comma-separated weights for each child's chance of
  playing first.
- `SwitchItems` — list of `AnimSrcNodeSwitchItem` entries:
  - `Child` — link to child node.
  - `NextProbabilities` — probabilities of transitioning to each other child next.

**Usage pattern:** Idle variation (two or three alternative idle animations), random
death poses, footstep variation.

**Gotchas:** Probability tables do not need to sum to 1 — the engine normalizes them.
Equal values give equal probability. This is NOT a condition-based switch; use a State
Machine for condition-driven routing.

---

### BufferSave

**Purpose:** Saves the current pose buffer (or a bone-masked subset) into named
temporary storage for retrieval later in the same frame.

**Key properties:**
- `BufferName` — identifier for this stored pose; must match the `BufferName` in a
  corresponding BufferUse node.
- `BoneMask` — restricts which bones are saved; no mask = all bones saved.

**Usage pattern:** Decouple a turret's body pose from the chassis: save the chassis body
pose with BufferSave after locomotion, then later restore it onto the upper body with
BufferUse before IK. Also useful for saving a full-body pose to reuse across multiple
branches without re-evaluating the subtree.

**Gotchas:** The saved buffer lives only for the current frame. BufferSave MUST appear
earlier in graph evaluation (higher up or in a branch that evaluates first) than the
BufferUse that reads it.

---

### BufferUse

**Purpose:** Restores a pose saved by a BufferSave node from named temporary storage.

**Key properties:**
- `BufferName` — must match the `BufferName` in the corresponding BufferSave.
- `BoneMask` — restricts which bones are restored; no mask = all bones restored.

**Usage pattern:** Used in combination with BufferSave. Classic pattern for turret/body
decoupling: chassis animation drives the lower body pose (saved with BufferSave), while
the turret graph can independently drive the upper body; BufferUse restores the chassis
pose onto the turret character's lower half.

**Gotchas:** If no BufferSave with the matching name has run yet this frame, the result
is undefined. Always ensure evaluation order guarantees BufferSave runs before BufferUse.

---

### Filter

**Purpose:** Applies a bone mask to the current pose buffer, keeping only the bones in
the mask. Can be conditionally enabled.

**Key properties:**
- `BoneMask` — inclusive mask of bones to keep; no mask = all bones kept (filter is a
  no-op).
- `Condition` — expression; when false, filter is inactive and all bones pass through.

**Usage pattern:** Strip upper-body bones from a full-body locomotion pose before
blending in an upper-body aim pose. Allows splitting a pose into regions for partial
blending.

**Gotchas:** Filter is inclusive — bones IN the mask are kept, bones NOT in the mask are
removed. The inverse is not directly supported without a second Filter node with an
inverted mask.

---

### CtxBegin

**Purpose:** One half of the Ctx (Context) pair. Marks the top of a block that protects a
shared subgraph from losing its state when multiple branches converge on it.

**Key properties:**
- `Child` — the first node inside the branched block.

**Usage pattern:** Always used together with CtxEnd. Place CtxBegin at the entry of each
branch that shares the same subgraph, and CtxEnd just above the shared subgraph.
The engine allows only one branch to traverse through CtxEnd per frame; all others
receive a cached result.

**Gotchas:** CtxBegin and CtxEnd must be used in a matched pair. Using one without the
other, or nesting them incorrectly, will cause state corruption.

---

### CtxEnd

**Purpose:** The second half of the Ctx pair. Placed directly above the shared subgraph.
Only the first branch to reach it per frame actually evaluates the subgraph; others get
a cached frozen result.

**Key properties:**
- `Child` — the shared subgraph being protected (below the branched block).

**Usage pattern:** When a blend node or state machine has multiple children that all need
the same IK processing node below them, wrap the IK node with Ctx Begin/End to prevent
the IK from resetting its state every frame.

**Gotchas:** The cached result returned to secondary branches is from the previous frame.
For time-critical IK that must be fully up-to-date every frame, consider whether sharing
is appropriate.

---

### AnimSrcEventGeneric

**Purpose:** Fires a named animation event with optional custom string and integer
payload. Used to communicate animation state changes to game code or other engine systems.

**Key properties (from AnimSrcEvent base):**
- `Name` — event identifier; how other systems identify and react to this event.
- `MainPathOnly` — when enabled, event fires only when on the graph's main path.
- `InitOnly` — fires only on node initialization (Event Node only).
- `Condition` — event fires only when this expression is true (Event Node only).
- `Once` — fires only on the first frame the condition is valid; re-arming requires the
  condition to go false first (Event Node only).
- `Frame` — frame number when the event starts (animation-attached events).
- `FrameCount` — duration of the event in frames (animation-attached events).

**Additional properties:**
- `UserString` — custom text data carried with the event.
- `UserInt` — custom integer code carried with the event.

**Usage pattern:** Signal game code when a specific animation branch becomes active
(e.g., `"reload_ready"` event fires when the magazine is clear). Attach to Event nodes
or State Machine transitions.

**Gotchas:** Events attached to Source nodes use `Frame`/`FrameCount` for timing.
Events on Event nodes use `Condition`/`Once`/`InitOnly`. These are different contexts
with different applicable properties. `MainPathOnly` prevents secondary/blending branches
from firing events spuriously.

---

### AnimSrcEventAudio

**Purpose:** Fires an audio-specific animation event. Extends AnimSrcEvent base. Used
by the audio engine to react to animation-driven audio triggers (footsteps, cloth
rustles, etc.).

**Key properties:** Inherits all AnimSrcEvent base properties (`Name`, `MainPathOnly`,
`Condition`, `Once`, `Frame`, `FrameCount`, etc.). No additional documented properties
beyond the base.

**Usage pattern:** Attach to Source nodes at the frame where the footstep impact occurs,
or to Event nodes for stance-change audio. The audio engine listens for events by `Name`.

**Gotchas:** Audio events must be attached to nodes that are on the main path when the
sound should play; off-path events are suppressed when `MainPathOnly` is enabled.

---

### FunctionBegin

**Purpose:** Marks the start of a reusable function block within the graph. The block
extends to one or more FunctionEnd nodes.

**Key properties:**
- `Child` — the first node inside the function block.
- `EndsCount` — number of FunctionEnd exit points within this function.

**Usage pattern:** Define common processing once (e.g., hand IK correction) and call it
from multiple places in the graph. Keeps large graphs maintainable.

**Gotchas:** FunctionBegin must have a unique name — this name is what FunctionCall
references. The `EndsCount` must match the actual number of FunctionEnd nodes inside
the block.

---

### FunctionCall

**Purpose:** Redirects graph evaluation into a named function block (defined by
FunctionBegin). Supports up to 8 child slots (Child0–Child7) that can be routed to by
FunctionEnd nodes inside the block.

**Key properties:**
- `Method` — name of the FunctionBegin node to call.
- `Child0`–`Child7` — up to 8 child nodes accessible from within the function via
  FunctionEnd's EndIndex.

**Usage pattern:** Call a shared IK processing subgraph from multiple blend branches
without duplicating nodes. Each call site can supply different children via Child0–Child7.

**Gotchas:** The function block runs inline as part of the same evaluation pass — it is
not deferred. The children provided at the call site (Child0–Child7) are evaluated by
FunctionEnd inside the block, so they must be valid nodes.

---

### FunctionEnd

**Purpose:** Marks an exit point within a function block. When evaluation reaches this
node, it returns to the calling FunctionCall and continues from the child slot
corresponding to `EndIndex`.

**Key properties:**
- `EndIndex` — which of the FunctionCall's Child0–Child7 slots to evaluate and return
  from (0-based index).

**Usage pattern:** A function that needs to select between two different subtrees
depending on context can have two FunctionEnd nodes with EndIndex 0 and 1 respectively,
and the calling FunctionCall provides two children.

**Gotchas:** EndIndex must be within the range of children provided by the FunctionCall,
or evaluation will fail silently.

---

### Group Select

**Purpose:** Selects an active column within an animation set group. All Source and Pose
nodes below this node can omit the column name from their animation identifiers — Group
Select fills it in automatically.

**Key properties:**
- `Group` — the animation set group containing the column to select.
- `Column` — the specific column to activate within that group.

**Usage pattern:** Dynamically switch between entire animation sets (e.g., weapon stances,
character variants) by changing the column on a single Group Select node near the top
of a subtree, rather than modifying every Source node individually.

**Example:** Group Select chooses column `"Erc"` in group `"Locomotion"`. A Source node
below references `"Locomotion.Walk"`. The resolved ID becomes `"Locomotion.Erc.Walk"`.

**Gotchas:** The column value can be driven by a string variable or expression — making
it a powerful runtime switch. All Source nodes below MUST use the abbreviated
`"Group.Animation"` format (no column) for Group Select to fill in the column. Nodes
using the full `"Group.Column.Animation"` format bypass Group Select for that animation.

---

### IK2

**Purpose:** Applies inverse kinematics to one or more bone chains to reach named IK
targets. The core IK execution node.

**Key properties:**
- `Weight` — overall IK influence (0 = no IK, 1 = fully applied).
- `Chains` — list of `AnimSrcIkBinding` entries; each binds an IK target name to an
  IK chain name.
- `Solver` — the IK solver instance to use (FabrikSolver, TwoBoneSolver, etc.; see
  IK Solvers section below).

**Usage pattern:** Place after IK2Target (which creates the IK targets) in the evaluation
order. For foot IK, a typical chain is: Source → IK2Target → IK2Plane → IKLock → IK2.

**Gotchas:** IK2 nodes depend on IK targets created by IK2Target or set externally. If
the target does not exist or has not been evaluated yet this frame, the IK will not apply.
Order IK nodes carefully; evaluation order is top-to-bottom in the DOWN phase.

---

### IK2Plane

**Purpose:** Pushes an IK chain's end effector to lie on a target plane rather than
reaching a specific point. Used for foot placement on terrain.

**Key properties:**
- `Weight` — IK influence (0–1).
- `Chains` — list of `AnimSrcIkBinding` entries.
- `ActiveDistance` — threshold distance in metres; IK is not applied when the end
  effector is further than this from the plane.
- `ThresholdSmoothness` — smoothing region in metres; IK turns on gradually within this
  region.
- `SnapRotation` — snaps end effector rotation to match the IK target rotation.
- `CustomNormal` — when non-zero, pushes the end effector along this custom direction
  instead of the plane normal.

**Usage pattern:** Foot IK for terrain adaptation. The game sets terrain-plane IK targets
externally; IK2Plane adjusts the foot to contact the plane.

**Gotchas:** `ActiveDistance` prevents IK from engaging when the foot is already far
above terrain (e.g., while airborne). Set it to a reasonable value (0.2–0.5 m) to avoid
undesired IK activation.

---

### IK2Target

**Purpose:** Creates named IK targets from bone transforms or chain end effectors.
This is the prerequisite node — IK targets must exist before IK2 or IK2Plane can use them.

**Key properties:**
- `Chains` — list of `AnimSrcIkTargetBinding` (from chain end effectors):
  - `IkTarget` — name of the IK target to create.
  - `IkChain` — source chain whose end effector defines the target.
  - `LocalSpaceOffset` / `ModelSpaceOffset` — transform offset (`AnimSrcTransformOffset`
    with `Position`, `Rotation`, `Pose`, `FromBone`, `ToBone`, `FromFrame`, `ToFrame`,
    `BonesAreInModelSpace`).
- `Bones` — list of `AnimSrcIkTargetBinding` (from named bones):
  - `IkTarget` — name to assign.
  - `Bone` — source bone whose model-space transform defines the target.

**Usage pattern:** First node in any IK pipeline. Create foot IK targets from ankle bone
transforms before passing to IK2Plane and IKLock.

**Gotchas:** IkTarget names must be consistent throughout the graph — every node that
references a target uses its string name. Typos cause silent IK failures.

---

### IKLock

**Purpose:** Locks an IK target at its current world-space position across frames, then
applies a two-bone IK solver to keep the chain's end effector at that locked position.

**Key properties:**
- `IsLocked` — expression; when true, the lock is active.
- `BlendinTime` — time (seconds) to fully engage IK after IsLocked becomes true.
- `BlendoutTime` — time (seconds) to release IK after IsLocked becomes false.
- `SnapRotation` — snap end effector rotation to match the IK target.
- `World` — name of a world transform delta provided by the game; used to lock targets
  to moving ground (e.g., vehicle floor).
- `Chains` — list of `AnimSrcIkBinding` entries.

**Usage pattern:** Foot planting — lock the foot IK target when the foot is on the
ground; release when the foot lifts. Use the `World` property when the character is on
a moving platform so the locked point follows the platform.

**Gotchas:** BlendinTime and BlendoutTime smooth the lock engagement to prevent snapping.
Without them, enabling the lock instantly snaps the foot to the locked position. The
`World` property is required for correct behavior on moving vehicles; omitting it causes
feet to slip when the vehicle moves.

---

### IKRotation

**Purpose:** Applies IK to reach a TARGET ROTATION (not position). Distributes the
rotation across parent bones in the chain. Useful for spine aiming.

**Key properties:**
- `Weight` — rotation influence (0 = no changes, 1 = fully applied).
- `Chains` — list of `AnimSrcIkBinding` entries.

**Usage pattern:** Spine IK for aiming — instead of counter-animating hip rotations
manually, IKRotation distributes the aiming angle naturally across multiple spine bones.

**Gotchas:** Only rotation is modified; translations are left untouched. Parent bones
receive a fraction of the rotation, providing a natural spine bend. Ensure the IK chain
is defined to span the correct spine bones.

---

## IK Solvers

Solver types used inside IK2 nodes. Specified in the `Solver` property of the IK2 node.

---

### FabrikSolver

**Type:** `AnimSrcNodeIK2FabrikSolver`

**Purpose:** Iterative general-purpose IK solver with per-bone rotation limits.

**Key properties:**
- `SnapRotation` — snap end effector rotation to match IK target.
- `RotationLimitPerBone` — maximum rotation in degrees per bone per iteration.
- `TightenToTarget` — percentage of the chain (toward the target end) where the rotation
  limit tightens to zero.
- `TwistPropagation` — percentage of the chain that receives twist from the snapped
  rotation.
- `MaxIterations` — solver stops after this many iterations even if the target is not
  fully reached.

**Usage pattern:** Chains of three or more bones where analytic solutions are not
possible. General spine or tail IK.

**Gotchas:** More iterations = more accurate but more expensive. Set `MaxIterations`
conservatively and increase only if the chain is visibly inaccurate.

---

### TwoBoneSolver

**Type:** `AnimSrcNodeIK2TwoBoneSolver`

**Purpose:** Analytic (exact, non-iterative) two-bone IK solution. If the chain has more
than two bones it is split into two segments at the mid-joint.

**Key properties:**
- `SnapRotation` — snap end effector rotation to match IK target.
- `AllowStretching` — allow the chain to stretch when the target is out of reach.
- `MidPivotTwist` — additional twist of the mid pivot plane in radians.

**Usage pattern:** Arm IK (shoulder → elbow → wrist), leg IK (hip → knee → ankle).
Preferred over FabrikSolver for two-bone chains because it is exact and cheap.

**Gotchas:** Analytic means there is always a mathematically unique solution given the
pole direction. Without a PoleSolver companion, the elbow/knee may flip. Combine with
PoleSolver to control mid-joint direction.

---

### LookAtSolver

**Type:** `AnimSrcNodeIK2LookAtSolver`

**Purpose:** Rotates the chain so that the end effector FACES the IK target point.

**Key properties:**
- `Axis` — the axis of the end effector bone to aim toward the target.

**Usage pattern:** Head look-at, barrel-pointing-at-target, eye tracking.

**Gotchas:** LookAtSolver rotates the entire chain to face the target, which can produce
undesired results on long chains. Use on short chains (1–2 bones) for head/eye control.

---

### LookInDirSolver

**Type:** `AnimSrcNodeIK2LookInDirSolver`

**Purpose:** Aligns the end effector with a selected axis of the IK target rather than
facing the target point directly.

**Key properties:**
- `Axis` — the axis of the end effector to align.
- `TargetAxis` — the axis of the target used as the reference direction.

**Usage pattern:** Align a bone with a direction vector rather than aiming at a point.
Useful when the IK target represents a direction rather than a position.

**Gotchas:** The distinction from LookAtSolver is subtle: LookAt aims at a position,
LookInDir aligns with a directional axis of the target transform.

---

### PoleSolver

**Type:** `AnimSrcNodeIK2PoleSolver`

**Purpose:** Rotates the chain around its twist axis to align the mid-joint with a
pole target, controlling knee/elbow direction.

**Key properties:** No additional properties beyond the base solver interface; the pole
target is defined by a named IK target in the Chains binding.

**Usage pattern:** Always pair with TwoBoneSolver for arm and leg chains. Place a pole
IK target (created by IK2Target) at the desired elbow or knee direction. The PoleSolver
then keeps the mid-joint pointing toward that pole.

**Gotchas:** The pole target must be created separately via IK2Target. The pole is a
directional hint, not a destination — the mid-joint moves in the direction of the pole,
not to it.

---

### RBF

**Purpose:** Radial Basis Function blending node. Blends poses based on how closely
a set of input values matches predefined sample points, using distance-based weighting.

**Key properties:**
- `Rbf` — RBF configuration (no further property descriptions in official documentation).

**Usage pattern:** Complex multi-dimensional pose blending where simple 1D or 2D blend
nodes are insufficient (e.g., blending many aim poses across a 2D+ parameter space).

**Gotchas:** Official documentation provides minimal detail on this node. Treat as
advanced; test thoroughly when used.

---

### WeaponIK

**Purpose:** Specialized IK node for weapon handling. Rotates the weapon to the correct
aim direction then snaps the primary (right) and secondary (left) arm chains onto the
weapon using two-joint IK.

**Key properties:**
- `IkconfigName` — name of the Weapon IK configuration asset.
- `Ikconfig` — configuration defining primary/secondary chains and their orientations.
- `BlendInTime` / `BlendOutTime` — time to enable/disable weight properties.
- `WeightAim` — enables aiming correction.
- `WeightPrimaryChain` — enables IK on the primary (right) arm.
- `WeightSecondaryChain` — enables IK on the secondary (left) arm.
- `WeaponDirLr` — horizontal weapon aim angle (active when WeightAim = 1).
- `WeaponDirUd` — vertical weapon aim angle (active when WeightAim = 1).
- `WeaponRoll` — weapon roll angle.
- `WeaponTransX/Y/Z` — additional weapon translation in model-space axes.

**Usage pattern:** Any character that holds a firearm. The node handles the full
aim-correct-snap pipeline. Requires a WeaponIK config asset that defines how the
arms attach to the weapon.

**Gotchas:** Both WeightAim and WeightPrimaryChain/WeightSecondaryChain must be non-zero
for the full effect. Setting WeightAim = 1 but leaving WeightPrimaryChain = 0 corrects
aim direction only without snapping the arm.

---

### Memory

**Purpose:** Saves a set of bones into local node memory and fills them in on subsequent
frames if those bones are missing from the current pose buffer (e.g., because a branch
switch stopped driving them).

**Key properties:**
- `BoneMask` — list of bones to remember.

**Usage pattern:** Prevent bone snapping when a branch deactivates. For example, if an
upper-body animation stops driving the arm bones, Memory holds the last known arm pose
until a new pose is available.

**Gotchas:** Memory returns the PREVIOUS frame's value for missing bones — there is one
frame of latency. This is usually invisible at normal frame rates but can cause issues
at very low frame rates or sudden transitions.

---

### Constraint (AnimSrcNodeConstraint)

**Purpose:** Applies a procedural constraint between two bones or IK targets, fixing
their relative position, rotation, or both.

**Key properties:**
- `Weight` — overall constraint influence (0–1).
- `Constraint` — the constraint type to apply (AnimSrcConstraintPosition or
  AnimSrcConstraintParent).

**Base constraint properties (`AnimSrcConstraint`):**
- `AffectedBone` / `AffectedIk` — the bone or IK target to constrain (use one or the
  other).
- `TargetBone` / `TargetIk` — the reference bone or IK target (use one or the other).
- `InitPose` — initialize from current pose or bind pose.
- `CustomSpace` — custom coordinate space for the constraint calculation (sub-fields:
  `AffectedSpace`, `AffectedPivotBone`, `AffectedPivotIk`, `TargetSpace`,
  `TargetPivotBone`, `TargetPivotIk`).

**Usage pattern:** Glue a prop bone to a character bone (e.g., attach a holstered weapon
to the hip bone). Position constraints for translation only; Parent constraints for full
transform lock.

**Gotchas:** AffectedBone and AffectedIk are mutually exclusive; same for TargetBone and
TargetIk. Setting both causes undefined behavior.

---

### AnimSrcConstraintPosition

**Purpose:** Constraint sub-type. Fixes the TRANSLATION OFFSET between two elements.
The offset can decay over time using soft/hard limits.

**Additional properties:**
- `OffsetSoftLimit` — distance at which soft limiting begins (must be less than
  OffsetHardLimit).
- `OffsetHardLimit` — maximum distance the affected element can travel from its
  constrained position.
- `OffsetDampening` — decay rate from hard limit back toward soft limit.
  `0` = immediate dampening; `1` = no dampening.
- `Components` — per-axis constraint strength (X, Y, Z independently).

**Usage pattern:** Loose attachment with some allowed movement (e.g., a dangling
accessory that can move within bounds). Set soft/hard limits to define the allowed
offset range.

**Gotchas:** OffsetSoftLimit must be strictly less than OffsetHardLimit. Inverting them
produces undefined behavior.

---

### AnimSrcConstraintParent

**Purpose:** Constraint sub-type. Fixes BOTH translation and rotation offset (full
parent-style constraint).

**Additional properties:**
- `RotateFirst` — when enabled, the affected element is rotated around the target BEFORE
  the position is resolved. Affects the order of transform application.

**Usage pattern:** Rigid attachment — the affected bone follows the target bone exactly
in both position and orientation. Use for weapon attachments that must track a bone with
no slack.

**Gotchas:** RotateFirst changes the decomposition of the parent constraint. Use it when
the default order produces incorrect results for your specific bone hierarchy.

---

### AnimNodeProcTransform (ProcTransform)

**Purpose:** Applies procedural transforms (rotation or translation) to bones or IK
targets using mathematical expressions evaluated at runtime. Core node for expression-
driven bone motion.

**Key properties (node level):**
- `Expression` — shared amount multiplier applied to all bone/IK target operations in
  this node.

**Per-bone operation (`AnimSrcNodeProcTrBoneItem`):**
- `Bone` — name of the bone to affect.
- `Axis` — translation or rotation axis.
- `Space` — transform space: `Model` (model-space), `Local` (local/bone-space), or
  `Pivot` (pivot-space).
- `Op` — operation: `Rotate` or `Translate`.
- `Amount` — expression for the operation amount; multiplied by the shared `Expression`.
  Supports graph float variables, `rad()`, `clamp()`, `lerp()`, and standard math.
- `PivotBone` — pivot bone (used when Space = Pivot).
- `PivotIk` — pivot IK target (used when Space = Pivot).

**Per-IK-target operation (`AnimSrcNodeProcTrIkTargetItem`):**
- Same properties as per-bone but uses `IkTarget` instead of `Bone`.

**Usage pattern:** Steering wheel rotation (`Amount` driven by a steering variable),
procedural head tilt, bone offsets driven by script-provided float variables.

**Usage example:** Rotate a steering wheel bone by a graph variable `SteeringAngle`:
- `Bone` = `"steering_wheel"`, `Op` = `Rotate`, `Space` = `Local`,
  `Amount` = `"rad(SteeringAngle)"`.

**Gotchas:**
- CRITICAL: There is NO `$Time` variable available in expressions. Do NOT attempt to
  use `$Time` or any time-based expression for continuous rotation — it will not work.
  For continuous rotation (e.g., a spinning wheel), use a looping Source node driving the
  bone via a baked animation instead.
- Expressions are evaluated in the AGF expression language; only graph variables and
  built-in math functions are available.
- The shared `Expression` multiplier is applied to ALL bone operations in the node.
  Use a value of `1.0` if you want each bone's `Amount` to be its own sole driver.

---

### Sleep

**Purpose:** Performance optimization node. Skips all child evaluation and returns an
empty result when the character has been inactive long enough.

**Key properties:**
- `AwakeExpr` — expression; when this evaluates to false for the entire `Timeout`
  duration, the node enters sleep mode and stops evaluating children.
- `Timeout` — seconds after AwakeExpr becomes false before sleep begins.

**Usage pattern:** Place near the top of the animation graph so that when the condition
is false (e.g., character is not visible, not selected, far from the camera), the entire
subgraph below is skipped. Common AwakeExpr: character visible flag or distance check.

**Best practice:** Use Sleep as early in the graph as possible. When sleeping, all
early-phase evaluation processes below the node are also skipped automatically.

**Gotchas:** `AwakeExpr` must become true BEFORE sleep activates to reset the timeout
timer. If the condition becomes true but is already sleeping, the node wakes up
immediately on the next frame. Do not use Timeout = 0 — this causes the node to
potentially sleep on the very first inactive frame, which can produce one-frame glitches
on re-activation.

---

### BindPose

**Purpose:** Samples the skeleton's bind (rest) pose. Returns the default T-pose or
rest configuration of all bones.

**Key properties:**
- `BoneMask` — restricts which bones are sampled; no mask = all bones.

**Usage pattern:** Starting point for graphs where no animation should play (e.g., a
static prop). Also used as a fallback pose in blend trees when no animation data is
available.

**Gotchas:** The bind pose is the raw skeleton rest pose from the mesh asset. It is NOT
the A-pose or T-pose unless that is how the mesh was exported. Inspect the actual bind
pose in Workbench before assuming it is a neutral stance.

---

### Pose

**Purpose:** Samples a STATIC FRAME from an animation determined by an expression.
Does not advance playback — picks a specific point in the animation based on a
computed normalized time (0 = first frame, 1 = last frame).

**Key properties:**
- `Source` — animation source ID: `"Group.Column.Animation"` or `"Group.Animation"`
  (when relying on a Group Select node above).
- `Time` — normalized sampling expression: 0.0 = first frame, 1.0 = last frame.
  Can be a float variable or any valid expression.

**Usage pattern:** Steering wheel with all positions baked into one animation — drive
`Time` with a normalized steering variable to select the correct pose. Any parameter
that maps to a pose range rather than a playing animation.

**Gotchas:** `Time` is normalized (0–1), not a frame number. If the animation has 30
frames, Time = 0.5 samples frame 15. The source format `"Group.Animation"` (without
column) requires a Group Select node above; `"Group.Column.Animation"` is self-contained.

---

### Pose2

**Purpose:** Samples a pose from an animation based on TWO control expressions and a
2D lookup table. Extends the Pose concept to two-dimensional parameter spaces.

**Key properties:**
- `Source` — animation source ID.
- `ValueX` — expression for the X coordinate in the 2D table.
- `ValueY` — expression for the Y coordinate in the 2D table.
- `Table` — the 2D table that remaps X and Y coordinates to animation frames.

**Usage pattern:** Aim spaces and look-at animations — map horizontal direction (X axis)
and vertical direction (Y axis) to a specific sampled pose from a 2D grid of key poses.

**Gotchas:** The 2D Table must be configured to match the range and resolution of
ValueX/ValueY. Mismatched ranges produce incorrect pose selection.

---

### Source

**Purpose:** Plays a baked animation from an animation set. The core leaf node for
animation playback. Supports looping.

**Key properties:**
- `Source` — animation source ID. CRITICAL: in the AGF, format is `"Group.AnimationName"`
  — NO column is included. The ASI uses the full `group.column.anim` for mapping;
  the AGF Source node uses only `group.anim`.
- `Looptype` — `"Loop"` or `"No Loop"`.
- `Interpolate` — when enabled, keyframes are interpolated for smoother playback.
- `Predictions` — list of `AnimSrcNodePrediction` entries for sampling future bone
  transforms (sub-properties: `Name`, `Bone`, `Event`, `PercentTime`, `Translation`,
  `Rotation`, `MainPath`).
- `BonesInterpolatedInModelSpace` — list of bones that must be interpolated in
  model-space to prevent stutters caused by inheriting parent interpolations.
- `ReportDistance` — reports distance traveled via root motion channel until end of
  cycle (looped) or end of animation (unlooped).

**Usage pattern:** Every animation playback — locomotion cycles, action animations,
anything baked from a TXA/ANM file.

**Gotchas:**
- CRITICAL source format mismatch: the AGF Source node uses `"Group.Animation"` (two
  parts), NOT `"Group.Column.Animation"`. This is the most common setup error. The
  column is declared in the ASI, not the AGF.
- `Looptype "Loop"` must be set via the Workbench UI — direct file editing of AGF
  nodes is wiped when Workbench re-serializes the file.
- Predictions sample future bone positions for gameplay anticipation; they add cost.
  Enable `MainPath` on predictions so they only sample when on the main path.

---

### SourceInLoopOut

**Purpose:** Plays an animation divided by events into three segments: intro (plays
once), loop (repeats until EndExpression is true), and outro (plays once to finish).

**Key properties:**
- `Source` — animation source ID.
- `InEvent` — event name marking the end of the intro and start of the loop region.
- `OutEvent` — event name marking the end of the loop region and start of the outro.
- `EndExpression` — when true, looping stops and the outro plays through to the end.

**Usage pattern:** Door opening/holding/closing, weapon charging, any action with a
natural start → sustained → end structure. Avoids needing three separate Source nodes
and a State Machine for the three phases.

**Gotchas:** `InEvent` and `OutEvent` must exactly match event names baked into the
animation in the TXA/ANM. If they do not match, the node cannot identify the phase
boundaries and will play incorrectly.

---

### SourceSync

**Purpose:** Plays an animation using NORMALIZED TIME rather than real time, enabling
synchronized playback across multiple animation instances.

**Key properties:**
- `Source` — animation source ID.
- `Looptype` — enables looped playback.
- `SyncLine` — name of the sync line that maps normalized time to events in the
  animation.
- `Predictions` — list of AnimSrcNodePrediction entries (same structure as Source node).
- `ReportDistance` — reports distance traveled until end of cycle/animation.

**Usage pattern:** Keeping two characters' animations synchronized (e.g., a carrying
animation where both characters must stay in step). The sync line defines the
normalized-time positions that represent key sync points.

**Gotchas:** Unlike Source (which uses real wall-clock time), SourceSync advances via
the SyncLine — if the sync line stalls, the animation stalls. Ensure the SyncLine is
properly defined and its sync points match across all instances that need to stay in
sync.

---

### State

**Purpose:** Represents one discrete state within a State Machine node. Acts as a
bridge from the state machine to its child subtree. CANNOT exist outside a State Machine.

**Key properties:**
- `Child` — the child node that plays when this state is active.
- `StartCondition` — evaluated during state machine initialization; the first State
  whose StartCondition returns true becomes the initial active state.
- `TimeStorage` — by default, time is inherited from parent nodes. Set to a local
  clock if this state must measure time independently.
- `IsExit` — when enabled, remaining time from the child is passed to the parent of
  the state machine; when disabled, remaining time is masked.
- `PassThrough` — when enabled, the state machine immediately tries to leave this state
  even if it was just entered (child nodes are still evaluated, but PassThrough is
  ignored in PostEval).

**Usage pattern:** Each pose or action in a set of mutually exclusive animation states
(idle, walk, run, jump). Define transitions on the State Machine to move between them.

**Gotchas:** `PassThrough` is useful for transient relay states but is silently ignored
when evaluated in PostEval context. `StartCondition` is checked only once at
initialization — it is not re-evaluated dynamically.

---

### StateMachine

**Purpose:** Contains multiple State nodes and manages transitions between them.
Each frame it evaluates transitions from the active state; when a transition condition
is met, it moves to the target state.

**Key properties:**
- `States` — list of State nodes inside this state machine.
- `Transitions` — list of `AnimSrcNodeTransition` entries.

**Transition properties (`AnimSrcNodeTransition`):**
- `FromState` — source state of this transition.
- `ToState` — target state of this transition.
- `Condition` — when true, the transition fires.
- `Duration` — crossfade blend duration in seconds.
- `StartTime` — time offset applied to the target state when the transition fires.
- `BlendFn` — blend curve shape during crossfade.
- `PostEval` — when enabled, the transition condition is evaluated in the UP phase
  (needed when the condition depends on tags or remaining time set by child states).
- `Priority` — order of evaluation; LOWER values are evaluated FIRST (higher priority).
- `MotionVecBlend` — root motion blending options during this transition.
- `Events` — list of AnimSrcEvent entries fired when this transition triggers.
- `Tags` — tags set on the animation output during this transition.

**Usage pattern:** The primary tool for organizing mutually exclusive animation states.
Use transitions with conditions driven by game variables. Use PostEval on transitions
that check tags or remaining time so the condition is checked after child state nodes
have fully evaluated.

**Gotchas:**
- Priority: lower value = evaluated earlier = higher priority. This is counter-intuitive.
  A transition with Priority = 0 is checked before one with Priority = 10.
- PostEval is required for any transition that reads tags or remaining time — without it
  the values are from the previous frame and the transition may fire one frame late or
  never.
- `Duration` is the crossfade time between states. Setting it to 0 produces an instant
  cut.

---

### Tag

**Purpose:** Adds tags to the animation output that propagate upward to parent nodes.
Can also inject tags ONLY into child nodes (not propagated up) via `ChildTags`.

**Key properties:**
- `Tags` — tags propagated upward to all parent nodes (readable by game code at the
  master node).
- `ChildTags` — tags passed only to child nodes; NOT propagated to parents.

**Usage pattern:** Mark active animation branches (e.g., tag `"is_aiming"` on an aim
branch, `"is_prone"` on a prone state). Game code reads these tags at the master node.
ChildTags are used to condition child behavior without advertising the tag to the rest
of the graph.

**Gotchas:** Tags from State Machine transitions can also be set directly on the
transition. Tags set by a child are only readable by parents AFTER the child has been
evaluated (UP phase). Any node reading a tag set by a descendant needs PostEval enabled.

---

### TimeSave

**Purpose:** Saves the current time value flowing through this point in the graph to
named stash storage for retrieval later with TimeUse.

**Key properties:**
- `TimeName` — storage identifier; must match the `TimeName` in the corresponding
  TimeUse node.

**Usage pattern:** Share a single time source across multiple branches that would
otherwise have independent clocks. Save the master time at a high point in the graph
and restore it wherever consistent timing is needed.

**Gotchas:** The stash is frame-local. TimeSave must run before any TimeUse that reads
it in the same frame's evaluation.

---

### TimeScale

**Purpose:** Scales the input time flowing into its child subtree, effectively speeding
up or slowing down animations in that subtree.

**Key properties:**
- `TimeExpr` — multiplier expression. `2.0` = 2x speed; `0.5` = half speed.
  Can be a float variable, allowing dynamic speed control.
- `TimeStorage` — by default, time is inherited from parent nodes. Set to local to
  create an independent clock.
- `TimeMappingTable` — when filled, the `TimeExpr` result is remapped through this
  table to produce the actual multiplier.

**Usage pattern:** Speed up a walk animation proportionally to movement speed. Slow down
a reload animation for gameplay balancing without re-authoring the animation.

**Gotchas:** TimeScale affects ONLY the subtree below it — sibling branches are
unaffected. A TimeExpr of 0 freezes the animation; a negative value plays it in reverse
(if supported by the source).

---

### TimeUse

**Purpose:** Restores a previously saved time value from stash (saved with TimeSave)
and uses it as the time input for its child subtree.

**Key properties:**
- `TimeName` — storage name to retrieve; must match a TimeSave's `TimeName`.
- `TimeType` — specifies whether the restored time is `"Real"` time or normalized time.

**Usage pattern:** Synchronize multiple branches to the same time reference that was
captured by TimeSave earlier in the graph evaluation.

**Gotchas:** If no TimeSave with the matching name has run this frame, the result is
the time from the previous frame. Ensure evaluation order guarantees TimeSave runs
before TimeUse.

---

### VarReset

**Purpose:** Resets specified graph variables back to their original game-provided input
values when conditions are met.

**Key properties (per `AnimSrcNodeVarResetItem`):**
- `VariableName` — the variable to reset.
- `SetOnInit` — reset on node initialization (first frame).
- `SetOnMainPath` — reset every frame while on the main path.
- `SetOnBlendOut` — reset every frame while on a secondary path (blending out).

**Usage pattern:** Restore a modified variable to its game-provided value when exiting
a branch that was overriding it with VarSet. Ensures variables don't carry stale
overridden values after a state transition.

**Gotchas:** VarReset restores to the GAME-PROVIDED input value, not to zero or a
default. If the game is providing 0 as the variable value, VarReset will set it to 0.

---

### VarSet

**Purpose:** Sets graph variables to new values within the child subtree scope only.
Changes do NOT propagate to the parent or sibling subtrees — they see the original
values.

**Key properties:**
- `VarSet` — list of variable set items.

**Per-item base properties (`AnimSrcNodeVarSetItem`):**
- `VariableName` — the variable to modify.
- `SetOnInit` — set on initialization.
- `SetOnMainPath` — set every frame on main path.
- `SetOnBlendOut` — set every frame on secondary path.
- `PostEval` — when enabled, value is updated AFTER child nodes evaluate, stored, and
  applied to the subtree on the NEXT frame.

**Usage pattern:** Override a global variable within a specific branch — e.g., force a
locomotion speed variable to 0 within an action state so locomotion animations in that
branch see zero speed.

**Gotchas:** Scope is child-only. The parent and siblings see the unchanged original
value. PostEval causes a one-frame delay in the new value reaching children — use only
when the set value depends on child evaluation results (tags, remaining time).

---

### VarUpdate

**Purpose:** Limits how fast a float variable can change per second within the child
subtree. Smooths abrupt game-driven variable changes and can freeze variables under
specific conditions.

**Key properties (per `AnimSrcNodeVarUpdateItem`):**
- `VariableName` — the variable to rate-limit.
- `MaxDifferencePerSecond` — maximum change per second. Float variables only.
- `UpdateOnInit` — update on initialization.
- `UpdateOnMainPath` — update every frame on main path.
- `UpdateOnBlendOut` — update every frame on secondary path.
- `PostEval` — update after child nodes evaluate (one-frame delay).
- `Condition` — variable is only rate-limited when this condition is true.
- `IsCyclic` — when enabled, the variable may blend toward the target "the other way
  around" its range (useful for angles like motion direction).

**Usage pattern:** Smooth a directional angle variable before feeding it into a BlendN
node. Smooth a speed variable to prevent animation pops when the character starts/stops
abruptly. Use `Condition` to disable rate-limiting during specific states.

**Gotchas:** `MaxDifferencePerSecond` applies ONLY to float variables. Boolean and
integer variables cannot be rate-limited. `IsCyclic` is essential for angular variables
(e.g., -180 to 180 degrees) to prevent the blend from going the "long way around" when
the angle wraps.

---

## VarSet Item Types

The `VarSet` property in the Var Set node accepts typed items depending on the variable
type. All types extend `AnimSrcNodeVarSetItem` and inherit its base properties
(`VariableName`, `SetOnInit`, `SetOnMainPath`, `SetOnBlendOut`, `PostEval`).

| Type | Purpose | Additional property |
|------|---------|---------------------|
| `AnimSrcNodeVarSetBoolItem` | Sets a boolean variable to a fixed value. | `Value` — the boolean value to assign. |
| `AnimSrcNodeVarSetIntItem` | Sets an integer variable to a fixed value. | `Value` — the integer value to assign. |
| `AnimSrcNodeVarSetFloatItem` | Sets a float variable to a fixed value. | `Value` — the float value to assign. |
| `AnimSrcNodeVarSetStringItem` | Sets a string variable to a fixed value. | `Value` — the string value to assign. |

All four types share the same base activation conditions (`SetOnInit`, `SetOnMainPath`,
`SetOnBlendOut`, `PostEval`). Choose the type that matches the variable's declared type
in the AGR.

---

## Key Design Patterns

### Sleep Nodes for Performance

Place a Sleep node near the top of each major graph branch. When the character is
inactive (not visible, far from camera, idle for a long time), set `AwakeExpr` to false.
The entire subtree below is skipped, saving significant CPU time. `Timeout` prevents
the node from sleeping on transient inactive frames — set it to 0.5–2 seconds depending
on the use case.

### State Machine Structure

A State Machine is the primary tool for mutually exclusive animation states. Rules:
- Each State has exactly one child subtree.
- Transitions define all possible state changes; they are NOT bidirectional by default.
- Transition `Priority` uses LOWER = HIGHER PRIORITY (Priority 0 fires before Priority 1).
- Use `PostEval` on transitions that check tags or remaining time from child states —
  without it the values are from the previous frame.
- Use `PassThrough` on relay states that should be exited immediately upon entry (but
  remember PassThrough is ignored in PostEval context).

### IK Chain Setup Order

IK nodes must be evaluated in the correct order because each depends on outputs from
earlier nodes. Typical foot IK pipeline (top to bottom in the graph = evaluation order):

```
Source (plays locomotion animation)
  └── IK2Target (creates foot IK targets from ankle bone positions)
        └── IK2Plane (corrects foot to terrain plane)
              └── IKLock (locks foot position between frames when planted)
                    └── IK2 (applies final IK solve)
```

Create IK targets with IK2Target BEFORE using them in IK2 or IK2Plane. IKLock requires
the `World` property set for characters on moving vehicles.

### Buffer Node Use for Turret/Body Decoupling

A turret character's chassis animation and turret rotation must be driven independently
but output to the same skeleton. Pattern:

1. Evaluate chassis locomotion animation (Source node).
2. Apply BufferSave with a descriptive name (e.g., `"chassis_lower_body"`), masking
   lower-body bones only.
3. In the turret rotation branch, apply BufferUse with the same name to restore the
   chassis lower-body pose onto the turret character's lower bones.
4. Upper-body bones are driven entirely by the turret graph.

This decouples turret yaw/elevation from chassis roll/pitch without needing separate
rigs.

### PostEval Usage Rules

Enable `PostEval` on a node's condition or transition when:
- The condition reads a **Tag** that is set by a descendant node.
- The condition reads **remaining time** from a child Source node.
- The condition reads an **event** flag that is only valid after child evaluation.

Without PostEval, these values are one frame stale (from the previous DOWN phase) and
the node may behave incorrectly.

Do NOT use PostEval when:
- The condition depends only on game-provided variables (these are valid in the DOWN
  phase).
- Performance is critical and the one-frame delay is acceptable — PostEval adds a small
  evaluation cost.

`PassThrough` on State nodes is silently ignored when evaluated in PostEval context.

### Variable Smoothing with VarUpdate

When game code drives a float variable that changes abruptly (e.g., a movement direction
angle that jumps 90 degrees in one frame), insert a VarUpdate node above the blend node
that uses the variable:

- `MaxDifferencePerSecond` — maximum degrees (or units) per second the variable can
  change within the subtree below VarUpdate.
- `IsCyclic` — enable for angular values that wrap around (e.g., -180 to 180 degrees).
- `Condition` — disable rate-limiting in states where snap transitions are intentional.

This prevents visible animation pops without requiring the game code to smooth the
variable on the script side.
