# State Machine & Transition Guide

Condensed from the full teaching guide at:
`C:\Users\Steffen\Documents\A_documents\Arma_Reforger_RAG_Hybrid_Optimized\Documentation\Character_And_Animation\Arma_Reforger_Animation_Editor_State_Machine_Teaching_Guide.md`

Read that file when you need full detail. This file covers the critical rules and quick reference.

---

## State Machine structure

```
Queue/root
└── StateMachine
    ├── State A  (StartCondition "MyVar == 0")  → BindPose / Source / ProcTransform / nested StateMachine
    ├── State B  (StartCondition "MyVar == 1")  → ...
    └── State C  (StartCondition "1")           → ... (catch-all, always last)
```

- External nodes link to the **StateMachine node**, never directly to a State inside it.
- If no StartCondition is true → first-created State is used (unpredictable). Always have a catch-all.
- States inside one StateMachine must have unique names. Same name is fine in different StateMachines.

---

## State properties

| Property | Values | Use when |
|---|---|---|
| `Time` | `Notime` | State links to a nested StateMachine (it manages its own time) |
| `Time` | `Realtime` | Looping animations — condition on elapsed seconds via `GetStateTime()` |
| `Time` | `Normtime` | One-shot animations — condition on 0–1 progress via `RemainingTimeLess()` |
| `StartCondition` | expression | Evaluated once when StateMachine is first entered |
| `Exit` | bool | Passes this State's accumulated time up to a parent StateMachine |

---

## Transition properties

| Property | Notes |
|---|---|
| `Condition` | Boolean expression. Must be true for transition to fire. |
| `Duration` | **Must be decimal** — `0.3` not `0`. Integer values cause errors. Use `0.0` for instant. |
| `Post Eval` | **Enable whenever condition uses any time/event/tag function.** |
| `Start Time` | Time offset the destination animation starts from. Use `GetLowerTime()` to sync. |
| `Blend Fn` | `Lin` / `SStart` / `SEnd` / `S` (both ends eased) / `S2` (S with over-shoot) |

**Post Eval rule:** If in doubt, enable it. Silent failures are hard to debug. Required for:
`GetLowerRTime()`, `GetLowerTime()`, `GetRemainingTime()`, `LowerNTimePassed()`, `RemainingTimeLess()`, `GetEventTime()`, `IsEvent()`, `IsTag()`

---

## Condition operators

| Op | Meaning |
|---|---|
| `==` `!=` `>` `<` `>=` `<=` | Comparison |
| `&&` | And (both true) |
| `\|\|` | Or (either true) |
| `!` | Not (invert) |

Use `()` to group when mixing `&&` and `||`.

---

## Built-in functions — quick reference

### Time
| Function | Post Eval? | Returns |
|---|---|---|
| `GetUpperRTime()` | No | Real-time clock (seconds). Use in ProcTransform Amount for continuous motion. |
| `GetStateTime()` | No | Seconds spent in current State |
| `GetLowerTime()` | Yes (in transitions) | Time of previous State — use in `Start Time` to sync animations |
| `GetLowerRTime()` | Yes (in transitions) | Real-time of previous State |
| `GetRemainingTime()` | Yes (in transitions) | Time remaining in current animation |
| `RemainingTimeLess(f)` | Yes (post-eval only) | True when remaining time < f |
| `LowerNTimePassed(f)` | Yes (post-eval only) | True when lower State normalised time > f |
| `GetUpperNTime()` | No | Normalised time from node above |
| `UpperNTimePassed(f)` | No | True when upper normalised time > f |
| `GetEventTime("anim","event")` | Yes (post-eval only) | Timestamp of named event in named animation |

### Variable detection
| Function | Returns |
|---|---|
| `HasVariableChanged(var)` | True if var changed this frame |
| `HasVariableChanged(var, old)` | True if changed AND old value matches |
| `HasVariableChangedTo(var, new)` | True if changed AND new value matches |
| `HasVariableChanged(var, old, new)` | True if changed AND both match |

### Events / tags / commands
| Function | Post Eval? | Returns |
|---|---|---|
| `IsEvent("name")` | Yes (post-eval only) | True if animation event was sampled |
| `IsTag("name")` | Yes (post-eval only) | True if tag is set on current pose |
| `IsCommand(cmd)` | No | True if command is being called |
| `GetCommandF("cmd")` | No | Float value carried by command |
| `GetCommandI("cmd")` | No | Integer value carried by command |
| `GetCommandIa/Ib/Ic/Id("cmd")` | No | Packed sub-integers A/B/C/D |
| `IsAttachment("name")` | No | True if named attachment is active |

### Range / bitwise / random
| Function | Returns |
|---|---|
| `inRange(v, min, max)` | True if min <= v <= max |
| `inRangeExclusive(v, min, max)` | True if min < v < max |
| `isbitset(v, bit)` | True if bit N is set (0 = LSB) |
| `maskint(v, mask)` | Bitwise AND |
| `Random01()` | Random float 0–1 |
| `RandomPerc(pct)` | True with pct% probability |

### Math / conversion
| Function | Returns |
|---|---|
| `abs(v)` | Absolute value |
| `clamp(v, min, max)` | Clamped value |
| `min(a, b)` / `max(a, b)` | Lesser / greater |
| `normalize(v, min, max)` | Maps to 0–1 range |
| `sin(v)` / `cos(v)` | Trig (radians) |
| `rad(v)` / `deg(v)` | Degrees ↔ radians |
| `int(v)` / `float(v)` | Type conversion |

---

## Key design patterns

1. **Catch-all Start Condition** — last State has `StartCondition "1"` (always true fallback).
2. **One-shot animations** → `Normtime` + `RemainingTimeLess(0.2)` on exit transition (Post Eval on).
3. **Looping animations** → `Realtime` + `GetStateTime() > N` for dwell-time conditions.
4. **Duration always decimal** — `0.3` not `0`. `0.0` for instant.
5. **Sync locomotion cycles** → `GetLowerTime()` in `Start Time` field (Post Eval on).
6. **One-shot triggers** → `HasVariableChanged()` not polling the value every frame.
7. **Random variation** → `RandomPerc(30) && GetStateTime() > 3.0` for idle fidgets.
8. **Nested StateMachines** → outer State uses `Notime`; inner StateMachine manages its own time.
9. **Animation-event sync** → `GetEventTime("animName", "eventName")` in `Start Time` (Post Eval on).
