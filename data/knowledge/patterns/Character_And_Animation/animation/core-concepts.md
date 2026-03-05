# Animation Core Concepts

Reference file covering animation file types, AGR/AGF responsibilities, graph evaluation, time models, and critical editor rules.

---

## Section 1: Animation File Types

| Extension | File Type | Editor | Purpose | Depends On |
|-----------|-----------|--------|---------|------------|
| `.agr` | Animation Graph Resource | Animation Editor | Top-level config: variables, IK chains, bone masks, commands, GlobalTags, DefaultRunNode, AGF file references | `.ast`, `.agf` |
| `.agf` | Animation Graph File | Animation Editor | Node graph sheets — the actual node hierarchy (Queue, Source, StateMachine, ProcTransform, IK2, etc.) | `.ast` |
| `.ast` | Animation Set Template | Animation Editor | Structural skeleton: group names, animation names, column names. The shared schema that AGR, AGF, and ASI all reference | Depended on by `.agr`, `.agf`, `.asi` |
| `.asi` | Animation Set Instance | Animation Editor | Maps `.ast` abstract names to actual `.anm` files. One ASI per character variant or weapon config | `.ast` |
| `.anm` | Animation file | Animation Editor | Compiled binary animation data. Not human-readable. Generated from `.txa` by Workbench | `.txa` (source) |
| `.txa` | Text animation source | Animation Editor | Human-readable source format for animations. Exported from Blender, compiled to `.anm` by Workbench | — |
| `.aw` | Animation Workspace | Animation Editor | Workbench editor project/session file. Groups the files belonging to one animation workspace | — |
| `.pap` | Procedural Animation Project | Procedural Animation Editor | Bone transform graph — drives bones via signal values. Legacy system being phased out | `.siga` |
| `.siga` | PA Signal | Procedural Animation Editor | Signal processing graph for a `.pap`. Accepts engine runtime values, applies math, outputs to PAP signal nodes | — |
| `.ae` | Animation Events Table | Animation Editor | Lists all animation events used in a workspace | — |
| `.asy` | Animation Sync Table | Animation Editor | Synchronization definitions — used to align playback of multiple animations | — |
| `.adeb` | Animation Debug | Animation Editor | Binary debug stream consumed by the live Animation Debugger in Workbench | — |

**Notes:**
- `.anm` files are compiled binaries — never edit directly.
- `.agf` files are re-serialized by Workbench on every open — see Section 2.
- `.pap` / `.siga` are legacy. New work should use the AGR/AGF system.

---

## Section 2: AGR vs AGF Responsibilities

### What lives in the AGR (Animation Graph Resource)

The AGR is the top-level config file. It is safe to edit directly in a text editor because Workbench does not wipe its contents on open.

**`ControlTemplate` block:**

- **`Variables`** — all float, int, and bool graph variables with `Min`, `Max`, and `Default` values. These are what scripts bind to via `AnimationControllerComponent.BindFloatVariable()` etc.
- **`Commands`** — action commands that can be sent to the graph (e.g., `GetIn`, `GetOut`, `Death`). Commands are one-shot triggers, not continuous values.
- **`IkChains`** — IK chain definitions: joint list, middle joint, chain axis. Referenced by IK2 nodes in the AGF.
- **`BoneMasks`** — named groups of bones used for layer filtering. A bone mask lets a blend node affect only a subset of the skeleton.
- **`GlobalTags`** — string tags that identify the graph type. Used by the engine to select correct graphs for a character/vehicle.

**Additional AGR blocks:**

- **`Debug`** — debug visualization settings.
- **`GraphFilesResourceNames`** — the list of `.agf` file paths that belong to this graph resource. Every AGF used by this graph must be registered here.
- **`DefaultRunNode`** — the exact name of the master Queue node inside the AGF. The engine starts graph evaluation from this node. Must match the Queue node's `Name` property exactly (case-sensitive).
- Reference to the `.ast` file.

### What lives in the AGF (Animation Graph File)

The AGF holds the actual node graph. Workbench owns this file entirely.

- **`Sheets`** — one or more named graph sheets. A sheet is a logical grouping of nodes; complex graphs may use multiple sheets.
- All node definitions within sheets: Queue, Source, StateMachine, Blend, BlendN, BlendT, ProcTransform, IK2, Tag, Sleep, VarUpdate, etc.
- Node child/parent connections (each node references its children by name).
- **`EditorPos`** — `x y` float pair storing the visual layout position of each node in the Animation Editor canvas. This property is completely ignored at runtime — it only affects editor layout.

### Critical rule: AGF is Workbench-owned

**The AGF is WIPED and re-serialized every time Workbench opens it.**

- NEVER add nodes to an AGF by editing the file manually. The changes will be lost.
- NEVER modify existing node content in an AGF via file edit.
- Only the Workbench Animation Editor UI can reliably add, modify, or remove nodes.
- The one exception: `EditorPos` values can be adjusted in the file when Workbench is closed — they are layout-only and Workbench will preserve them on next open (it re-serializes to include them).

The AGR, by contrast, survives direct file edits — variables, IK chains, bone masks, commands, and GlobalTags can all be added or modified in the file safely.

---

## Section 3: Two-Phase Evaluation Model

Graph evaluation runs in two distinct phases every frame.

### DOWN Phase

1. Starts at the master (topmost) node — the one named in `DefaultRunNode`.
2. Travels **downward** through the node hierarchy toward child nodes.
3. At each node, logic determines which child branches will be evaluated and which will be pruned (skipped).
4. Routing decisions, state machine transition checks, and branch selection all happen here.
5. State machine transitions are evaluated in the DOWN phase **unless `PostEval` is set to true** on the transition.

### UP Phase

1. Evaluation reaches a leaf node (no children) or a pruned branch.
2. The leaf produces an **animation pose** (bone transforms).
3. The pose travels **upward** back toward the master node.
4. Each parent node blends or passes the pose upward.
5. Blend nodes combine poses from multiple children during this phase.
6. Final result at the master node is the output pose for that frame.

### Key Implications

- **Logic flows top-to-bottom.**
- **Poses flow bottom-to-top.**
- Tags, remaining time, and animation events are properties of a pose — they are only valid AFTER the child nodes that produce them have been evaluated (i.e., during or after the UP phase).
- Any node that reads tags, remaining time, or events must use the `PostEval` flag. This defers that node's condition/logic check to run during the UP phase, after children have already been evaluated.

### Mental Model

Think of the graph as a tree:
- The root (master Queue node) decides which subtrees matter — DOWN phase.
- Leaf nodes produce poses.
- Parents combine results on the way back up — UP phase.

A state machine that transitions based on an animation's remaining time must use `PostEval` because remaining time is only known after the Source node (a leaf) has been evaluated.

---

## Section 4: Real Time vs Normal Time

Time is a primary input driving animation playback. Two distinct time modes exist.

### Normal Time (default)

- Animation-relative: ranges from **0.0** (start of animation) to **1.0** (end of animation).
- Used for standard animation playback.
- Synchronizes animations at shared sync points regardless of individual animation length.
- This is the default mode for most nodes.

### Real Time

- Wall-clock seconds. Advances continuously at the rate of the system clock.
- Independent of animation length.
- Specified by setting `TimeStorage "Real Time"` on `TimeScale` and `TimeSave` nodes that need it.

### When to Use Real Time

Use Real Time when:
- A `TimeScale` node applies a speed multiplier based on an external value (e.g., vehicle speed in m/s) where the scaling must be independent of animation length.
- `TimeSave` / `TimeUse` nodes share time across subtrees that have different animation lengths and must stay in sync.
- You need a continuously advancing clock that does not reset when animations change.

### Property Syntax

On a `TimeScale` or `TimeSave` node that needs wall-clock time:

```
TimeStorage "Real Time"
```

Omitting this property (or setting it to `"Normal Time"`) uses the default animation-relative mode.

---

## Section 5: Common Node Properties

These properties are present on every node type.

### Universal Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | string | Unique identifier within the sheet. Used as the value in `Child "NodeName"` references from parent nodes. Case-sensitive. Must be unique per sheet — duplicate names cause undefined behavior. |
| `EditorPos` | float pair (`x y`) | Visual layout position in the Animation Editor canvas. Completely ignored at runtime. Only affects editor display. |
| `Child` | string (node name) | Reference to a single child node by name. Most non-leaf nodes have this. Nodes that accept multiple children (Blend, BlendN, StateMachine) use slot-specific child properties (`Child0`, `Child1`, children list, etc.). |

### Additional Common Properties (present on many nodes)

| Property | Type | Description |
|----------|------|-------------|
| `Tags` | string list | Tags set on the animation output of this node. Tags propagate upward with the pose. Game code reads tags from the master node to react (audio, gameplay, etc.). |
| `NodeGroup` | string | Name of a visual/logical organizational group in the editor. Does not affect runtime behavior. |
| `PostEval` | bool | When `true`, the node's logic (condition check, transition evaluation) runs in the UP phase instead of the DOWN phase. Required when checking tags, remaining time, or animation events — these values are only valid after child nodes have evaluated. |
| `Optimization` | bool | When enabled on blend nodes, child branches with 0% influence are not evaluated. Saves CPU at the cost of the branch losing its internal state when inactive. |

### Child Reference Syntax in AGF

In the AGF text format, a node references its child by name:

```
AnimSrcNodeQueue "MasterQueue" {
 Child "MySourceNode"
}
```

The string value must exactly match the `Name` of the child node within the same sheet.

---

## Section 6: Critical Editor Rules

### DO

- Add all nodes via the Workbench Animation Editor UI.
- Edit AGR files directly in a text editor: add/modify variables, IK chains, bone masks, commands, GlobalTags.
- Set `DefaultRunNode` in the AGR to exactly match the master Queue node's `Name` in the AGF (case-sensitive).
- Use `PostEval` on any node that reads tags, remaining time, or animation events.
- Name all nodes uniquely within their sheet.
- Use `TimeStorage "Real Time"` on `TimeScale` / `TimeSave` nodes when wall-clock seconds are needed.
- Register every AGF file in the AGR `GraphFilesResourceNames` list.
- In `Source` node, use the format `"GroupName.AnimationName"` (group dot anim, no column name).
- In `ASI` mapping, use the full `group.column.anim` format.

### DO NOT

- Edit AGF node content directly in the file — Workbench wipes it on open.
- Use `$Time` in `ProcTransform` expressions — it does not exist. Only graph variables and math functions work.
- Duplicate node names within a sheet.
- Edit `.anm` files directly — they are compiled binaries.
- Forget to register AGF files in AGR `GraphFilesResourceNames`.
- Mix up `Source` node format (`group.anim`) with ASI format (`group.column.anim`).
- Use `.pap` / `.siga` for new work — use the AGR/AGF system instead.
- Attempt to use a `PostEval`-requiring condition in DOWN phase — transitions that check remaining time will silently use stale values.

---

## Section 7: AGR Structure Reference (File Format)

Condensed example of a minimal AGR showing all major blocks:

```
AnimGraphResource "MyGraph.agr" {
 Source "MyAnimSet.ast"
 GraphFilesResourceNames {
  "MyGraph_Main.agf"
 }
 DefaultRunNode "MasterQueue"
 GlobalTags {
  "VehicleGraph"
 }
 ControlTemplate {
  Variables {
   AnimGraphVariableFloat "Speed" {
    Default 0
    Min 0
    Max 50
   }
   AnimGraphVariableBool "IsGrounded" {
    Default true
   }
  }
  Commands {
   AnimGraphCommand "GetIn" {}
   AnimGraphCommand "GetOut" {}
  }
  IkChains {
   AnimGraphIkChain "RightArm" {
    Joints { "upperarm_r" "lowerarm_r" "hand_r" }
    MiddleJoint "lowerarm_r"
    ChainAxis "0 1 0"
   }
  }
  BoneMasks {
   AnimGraphBoneMask "UpperBody" {
    Bones { "spine_01" "spine_02" "spine_03" "neck_01" "head" }
   }
  }
 }
 Debug {
 }
}
```

---

## Section 8: Source Node — AST Name Format

The `Source` property on a `Source` node and the mapping in an `ASI` use different formats. This is a frequent source of errors.

| Context | Format | Example |
|---------|--------|---------|
| AGF `Source` node `Source` property | `"Group.AnimationName"` | `"basic.Idle"` |
| ASI mapping | `"Group.Column.AnimationName"` | `"basic.default.Idle"` |

The column name is part of the AST structure and is used in the ASI to select which `.anm` file to use for a given variant. The AGF node does not specify a column — the ASI resolves that at runtime.

---

## Related Patterns

- `animation-graph.md` — node type quick reference, ProcTransform pitfalls, script-driven variables, PAP/SIGA legacy system
- `animation/` directory INDEX for other animation sub-topics
