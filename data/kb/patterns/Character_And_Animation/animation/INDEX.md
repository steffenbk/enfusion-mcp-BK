# Animation Graph — Local Index

Read this first. Find your task below and read only the listed file(s).

## IMPORTANT: Two distinct approaches — pick one before starting

| User asks for... | Approach | Files involved |
|---|---|---|
| "node editor", "bone animation", "rotate a bone", "procedural", "drive with variable" | **AGF graph nodes** — write ProcTransform/Queue/BindPose directly to the AGF, define variables in the AGR. No .txa/.anm/.ast/.asi needed. | `.agr` + `.agf` only |
| "baked animation", "keyframe", "from Blender", "play a clip", "txa", "anm" | **Baked clip pipeline** — export .txa from Blender, compile to .anm, map in .asi, play via Source node in AGF. | `.agr` + `.agf` + `.ast` + `.asi` + `.anm` |

**Default to the AGF node approach** unless the user explicitly mentions baked/keyframed/Blender animation. Do not suggest creating .txa files for bone-driven motion.

---

| Task | Read |
|---|---|
| Bone animation via node editor (rotate, translate, procedural) | `core-concepts.md` + `node-cheatsheet.md` |
| Adding a float/bool variable to control animation from script or editor | `core-concepts.md` + `node-cheatsheet.md` |
| "What node should I use for X?" | `node-cheatsheet.md` first, then `node-reference.md` if more detail needed |
| State machine setup, transitions, conditions | `node-cheatsheet.md` + `state-machine-guide.md` |
| Transition conditions, Post Eval, time functions, built-in expression functions | `state-machine-guide.md` |
| Setting up a new vehicle animation graph from scratch | `core-concepts.md` + `node-cheatsheet.md` + `vehicle-animation.md` |
| Understanding a specific AGF node type in depth | `node-reference.md` |
| Reading or modifying an existing vehicle AGF/AGR | `core-concepts.md` + `node-cheatsheet.md` + `vehicle-animation.md` |
| Driving animation variables from EnforceScript | `script-integration.md` |
| Working with a legacy PAP/SIGA vehicle | `procedural-pap-siga.md` |
| Full animation system overview | All files |

## File Summaries

| File | Contents |
|---|---|
| `core-concepts.md` | File types, two-track split (AGF nodes vs baked clips), AGF editing rules, confirmed working ProcTransform + variable patterns |
| `node-cheatsheet.md` | **Read this for node selection.** One-line summary of every node type, common expressions, quick-ref patterns |
| `state-machine-guide.md` | **Read for StateMachine/transitions.** State properties, Transition properties, all condition operators, all built-in functions (time, command, event, random, trig), Post Eval rules, design patterns |
| `node-reference.md` | Full detail on every node — only read when cheatsheet is insufficient |
| `vehicle-animation.md` | Vehicle variables, IK chains, bone masks, node patterns, step-by-step setup, S105 + LAV25 examples |
| `procedural-pap-siga.md` | Legacy PAP/SIGA system — all node types, data flow, pitfalls |
| `script-integration.md` | AnimationControllerComponent API, driving graph vars from script, replication rules |
