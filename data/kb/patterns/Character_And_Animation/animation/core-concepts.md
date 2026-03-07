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
- `.agf` nodes survive Workbench open. They are wiped only if you save through the editor UI — see Section 2.
- `.pap` / `.siga` are legacy. New work should use the AGR/AGF system.
- `.ast` / `.asi` / `.anm` are only needed for baked clip playback — not required for ProcTransform/node-only graphs.

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

The AGF holds the actual node graph and can be written directly in a text editor.

- **`Sheets`** — one or more named graph sheets. A sheet is a logical grouping of nodes; complex graphs may use multiple sheets.
- All node definitions within sheets: Queue, Source, StateMachine, Blend, BlendN, BlendT, ProcTransform, IK2, Tag, Sleep, VarUpdate, etc.
- Node child/parent connections (each node references its children by name).
- **`EditorPos`** — `x y` float pair for node layout position in the editor canvas. Ignored at runtime. Use ~2 unit spacing (e.g. `0 0`, `2 0`, `4 0`) — large values (100+) place nodes far apart visually.

### AGF file editing

**The AGF CAN be written directly in a text editor — nodes survive Workbench opening the file.**

**However: saving the AGF through the Workbench Animation Editor UI wipes all nodes.** The wipe happens on editor save, not on open. The correct workflow is:

1. Write the AGF in a text editor (outside Workbench).
2. Open the `.aw` in Workbench — nodes load and work correctly.
3. **Never save the AGF through the editor.** If you need to make changes, close Workbench, edit the file, reopen.

What Workbench does on open:
- Re-serializes formatting (whitespace, property order may shift slightly).
- Replaces placeholder `AnimSrcNodeProcTrBoneItem` GUIDs with engine-generated ones.
- Does NOT wipe node content — nodes load and evaluate correctly.

Safe to write manually: `AnimSrcNodeQueue`, `AnimSrcNodeProcTransform`, `AnimSrcNodeBindPose`, `AnimSrcNodeBlend`, `AnimSrcNodeStateMachine`, and most other node types.

The AGR also survives direct file edits — variables, IK chains, bone masks, commands, and GlobalTags can all be added or modified safely, including while Workbench is open (reload scripts/resources to pick up changes).

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

## Section 6: The Two-Track Split

The Animation Editor handles two fundamentally different things. It is important to keep them separate mentally:

### Track 1: Graph logic (AGF)

The AGF contains the node graph — logic, blending, procedural bone transforms, state machines. This track does **not** need any `.txa`/`.anm`/`.ast`/`.asi` at all.

Use this track when:
- Driving bones mathematically (rotation, translation via `ProcTransform` + `GetUpperRTime()`)
- Blending poses based on variables
- State machine logic
- IK

Minimum required files: `.agr` + `.agf`. No `.ast`, `.asi`, `.txa`, or `.anm` needed.

### Track 2: Baked clips (ASI / ANM)

The `.ast` / `.asi` / `.txa` / `.anm` pipeline is for playing back keyframed animations exported from a DCC tool (e.g. Blender). The ASI maps abstract animation names (from the `.ast` schema) to compiled `.anm` clip files. These are referenced by `Source` nodes in the AGF.

Use this track when:
- Playing back Blender-exported character or prop animations
- Needing precise keyframed motion that math can't express

Required files: `.ast` + `.asi` + `.anm` (compiled from `.txa`), plus `Source` nodes in the AGF.

### When to use which

| Goal | Track |
|---|---|
| Continuous bone spin, oscillation, procedural motion | Graph logic only (ProcTransform) |
| Playing a Blender-exported walk/idle/action clip | Baked clips (ASI + ANM) |
| Blending procedural + baked | Both tracks together |

---

## Section 7: Critical Rules

### DO

- Edit AGF node content directly in a text editor — it works, Workbench preserves it.
- Edit AGR files directly: add/modify variables, IK chains, bone masks, commands, GlobalTags.
- Set `DefaultRunNode` in the AGR to exactly match the master Queue node's `Name` in the AGF (case-sensitive).
- Set `StartNode` on `BaseItemAnimationComponent` in the prefab to match the master Queue node name — without this the graph evaluates nothing even with `AlwaysActive 1` and a correct AGR `DefaultRunNode`.
- Use `PostEval` on any node that reads tags, remaining time, or animation events.
- Name all nodes uniquely within their sheet.
- Use `GetUpperRTime()` in `ProcTransform` `Amount` expressions for continuous real-time motion.
- Register every AGF file in the AGR `GraphFilesResourceNames` list.
- In `Source` node `Source` property, use the 3-part format `"Group.Column.AnimationName"`.
- In `ASI` mapping, also use the full `group.column.anim` format.
- Populate `.ast` before opening an AGF that contains `Source` nodes — empty `.ast` causes Workbench to blank the file.
- Give `AnimSrcNodeProcTrBoneItem` entries a placeholder GUID — Workbench will replace it with a valid one on next open.

### DO NOT

- Use `$Time` in `ProcTransform` expressions — it does not exist. Use `GetUpperRTime()` instead.
- Duplicate node names within a sheet.
- Edit `.anm` files directly — they are compiled binaries.
- Forget to register AGF files in AGR `GraphFilesResourceNames`.
- Use the 2-part `Source` node format (`group.anim`) — base game and runtime expect 3-part `group.column.anim`.
- Use `.pap` / `.siga` for new work — use the AGR/AGF system instead.
- Attempt to use a `PostEval`-requiring condition in DOWN phase — transitions that check remaining time will silently use stale values.

---

## Section 8: AGR Structure Reference (File Format)

Confirmed working AGR structure based on actual project files:

```
AnimSrcGraph {
 AnimSetTemplate "{GUID}path/to/file.ast"
 ControlTemplate AnimSrcGCT "{GUID}" {
  Variables {
   AnimSrcGCTVarFloat RotationSpeed {
    DefaultValue 2.094
    MinValue 0
    MaxValue 62.832
   }
   AnimSrcGCTVarBool IsActive {
   }
   AnimSrcGCTVarInt SeatIndex {
    MaxValue 10
   }
  }
  Commands {
   AnimSrcGCTCmd CMD_GetIn {
   }
  }
  IkChains {
   AnimSrcGCTIkChain MyChain {
    Joints {
     "bone_a"
     "bone_b"
    }
    MiddleJoint "bone_b"
    ChainAxis "+y"
   }
  }
  BoneMasks {
   AnimSrcGCTBoneMask MyMask {
    Bones {
     "spine_01"
     "spine_02"
    }
   }
  }
 }
 Debug AnimSrcGD "{GUID}" {
 }
 GraphFilesResourceNames {
  "{GUID}path/to/file.agf"
 }
 DefaultRunNode "MasterQueue"
}
```

Key: real class names are `AnimSrcGraph`, `AnimSrcGCT`, `AnimSrcGCTVarFloat`, `AnimSrcGCTVarBool`, `AnimSrcGCTVarInt`, `AnimSrcGCTCmd`, `AnimSrcGCTIkChain`, `AnimSrcGCTBoneMask` — not the `AnimGraph*` names seen in older docs.

---

## Section 9: Source Node — AST Name Format

Both the `Source` property on an AGF `Source` node and the `ASI` mapping use the **same 3-part format**.

| Context | Format | Example |
|---------|--------|---------|
| AGF `Source` node `Source` property | `"Group.Column.AnimationName"` | `"spin.default.Rotate360X"` |
| ASI mapping key | `"Group.Column.AnimationName"` | `"spin.default.Rotate360X"` |

The column selects which `.anm` variant to use (e.g. `default`, `damaged`, `lod1`). Both sides must use the full 3-part path. Using 2-part `"Group.AnimationName"` on a `Source` node will fail silently.

---

## Section 10: Confirmed Working AGF Patterns

### Pure ProcTransform spin (no baked clips, no .ast/.asi/.anm)

Continuously rotates a bone on its local X axis using wall-clock time. One full rotation every N seconds = `2π / N`.

```
AnimSrcGraphFile {
 Sheets {
  AnimSrcGraphSheet MySheet {
   Nodes {
    AnimSrcNodeQueue MasterQueue {
     EditorPos 0 0
     Child "RotateX"
    }
    AnimSrcNodeProcTransform RotateX {
     EditorPos 2 0
     Child "BindPose"
     Expression "1"
     Bones {
      AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60001}" {
       Bone "my_bone"
       Op Rotate
       Amount "GetUpperRTime() * 2.0944"
      }
     }
    }
    AnimSrcNodeBindPose BindPose {
     EditorPos 4 0
    }
   }
  }
 }
}
```

Notes:
- `2.0944` = `2π / 3` → 360° per 3 seconds. Adjust denominator for different speeds.
- `Op Rotate` without `Axis` rotates on local X. Use `Axis Y` or `Axis Z` for other axes.
- Placeholder GUID on `ProcTrBoneItem` is preserved by Workbench on open — any hex string works.
- `BindPose` is the required leaf node — provides the base pose that ProcTransform modifies.
- AGR must set `DefaultRunNode "MasterQueue"` and register the AGF in `GraphFilesResourceNames`.
- EditorPos spacing: ~2 units apart. Large values (100+) make nodes appear far apart in the editor.
- **Do not save the AGF through the Workbench editor** — this wipes all nodes. Open only, never save.

### Adding a float variable to control ProcTransform at runtime

Add a `Variables` block inside `ControlTemplate` in the AGR:

```
ControlTemplate AnimSrcGCT "{...}" {
 Variables {
  AnimSrcGCTVarFloat RotationSpeed {
   DefaultValue 2.094
   MinValue 0
   MaxValue 20
  }
 }
}
```

Then reference the variable name directly in the AGF `Amount` expression:

```
Amount "GetUpperRTime() * RotationSpeed"
```

The variable name in `Amount` must exactly match the name in the AGR `Variables` block (case-sensitive). The variable appears in the Workbench Animation Editor variable panel and can be scrubbed live for testing. From script, bind it via `AnimationControllerComponent.SetVariableFloat("RotationSpeed", value)`.

### Multi-axis ProcTransform tumble (confirmed working on projectile prefab)

Multiple `AnimSrcNodeProcTrBoneItem` entries inside one `ProcTransform` node each apply independently. Use unique placeholder GUIDs per entry.

```
AnimSrcNodeProcTransform Tumble {
 EditorPos 2 0
 Child "BindPose"
 Expression "1"
 Bones {
  AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60001}" {
   Bone "c_mk77root"
   Op Rotate
   Amount "GetUpperRTime() * RotationSpeed"
  }
  AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60002}" {
   Bone "c_mk77root"
   Op Rotate
   Axis Y
   Amount "GetUpperRTime() * RotationSpeed"
  }
 }
}
```

Notes:
- `Op Rotate` with no `Axis` = local X. `Axis Y` = local Y. `Axis Z` = local Z.
- Multiple bone items on the same bone stack — each rotation is applied in sequence.
- Use different `Amount` multipliers (e.g. `* 0.3`) for asymmetric tumble vs equal-speed spin.

### Driving AGR float variable from script based on height above ground (confirmed working)

`NapalmBombCarryComponent` pattern — scales a `RotationSpeed` variable between `SPEED_MIN` (at max altitude) and `SPEED_MAX` (at ground level) every frame using `GetSurfaceY` for terrain height.

```c
// In OnPostInit:
m_AnimController = AnimationControllerComponent.Cast(owner.FindComponent(AnimationControllerComponent));
if (m_AnimController)
    m_iRotSpeedVarId = m_AnimController.BindFloatVariable("RotationSpeed");
SetEventMask(owner, EntityEvent.FRAME);

// In EOnFrame:
vector pos = owner.GetOrigin();
float groundY = owner.GetWorld().GetSurfaceY(pos[0], pos[2]);
float heightAboveGround = pos[1] - groundY;

float t = 1.0 - Math.Clamp(heightAboveGround / HEIGHT_MAX, 0.0, 1.0);
float speed = SPEED_MIN + t * (SPEED_MAX - SPEED_MIN);

m_AnimController.SetFloatVariable(m_iRotSpeedVarId, speed);
```

Confirmed tuned values: `HEIGHT_MAX = 300.0`, `SPEED_MIN = 0.1`, `SPEED_MAX = 6.0`.
- `GetSurfaceY(x, z)` is on the `World` object (via `owner.GetWorld()`), NOT on the entity.
- `BindFloatVariable` returns an int ID; use that ID for all subsequent `SetFloatVariable` calls (more efficient than string lookup per frame).
- The AGR variable `MaxValue` must be >= `SPEED_MAX` or the value will be clamped by the graph.

### BaseItemAnimationComponent prefab wiring (confirmed working)

```
BaseItemAnimationComponent "{GUID}" {
 AnimGraph "{GUID}path/to/file.agr"
 AnimInstance "{GUID}path/to/file.asi"
 StartNode "MasterQueue"
 AlwaysActive 1
}
```

- `StartNode` must match the master Queue node name exactly — without it the graph does not evaluate even with `AlwaysActive 1` and correct AGR `DefaultRunNode`.
- `BaseItemAnimationComponent` IS an `AnimationControllerComponent` (inherits from it). Do NOT add a separate `AnimationControllerComponent` to the same entity — it crashes on init with "anim controller initialization data is invalid".
- To drive variables from script: `AnimationControllerComponent.Cast(owner.FindComponent(AnimationControllerComponent))` will find the `BaseItemAnimationComponent`. Call `BindFloatVariable`/`SetFloatVariable` on it directly.

---

## Related Patterns

- `node-cheatsheet.md` — every node one-liner, expressions, EditorPos spacing, confirmed patterns
- `state-machine-guide.md` — StateMachine/transition full reference, all built-in functions
- `node-reference.md` — full detail on every node type
- `animation/INDEX.md` — task routing for all animation topics
