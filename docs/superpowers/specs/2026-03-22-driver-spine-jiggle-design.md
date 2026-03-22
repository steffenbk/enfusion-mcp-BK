# Driver Seat Jiggle — Design Spec

**Date:** 2026-03-22
**Status:** Reviewed (updated after implementation approach correction)

---

## Goal

Add an exaggerated, suspension-driven vertical translation to the M151A2 driver seat socket so the character physically bounces up and down when driving over rough terrain.

---

## Scope

- File modified: `Testanims2M151A2.agf` (Body sheet only)
- No changes to `.agr`, `.ast`, `.asi`, prefab, or Main sheet
- Driver seat only (`driver_idle` socket bone)
- No new variables required — uses existing `suspension_0..3` declared in the AGR

---

## Architecture

### Approach

The `driver_idle` bone is the seat attachment socket in the M151A2 vehicle mesh (confirmed in `m151a2_base.xob`). The character is positioned at this socket at runtime. Translating this bone on the Y axis physically moves the character with it — no character rig bone names needed.

The Body sheet already contains a `Jiggles` ProcTransform node that handles mirror/wiper jitter. We add `driver_idle` as an additional bone item inside that existing node with its own per-bone `Amount` expression. This is the minimum possible change.

### Body sheet chain (unchanged structure)

```
eco_body_out_M151A (Sleep, AwakeExpr "IsInVehicle")
  └─ Base_Var_Update (VarUpdate)
       └─ Wipers (ProcTransform)
            └─ Jiggles (ProcTransform)  ← ADD bone item here
                 └─ Dashboar_main (ProcTransform)
                      └─ Dashboar_jiggles (ProcTransform)
                           └─ M151A2_body_Bind_Pose (BindPose)
```

No structural changes — no new nodes, no Child pointer changes.

### Change required

Add one new bone item inside the existing `Jiggles` node's `Bones {}` block:

```
AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60001}" {
 Bone "driver_idle"
 Axis Y
 Op Translate
 Amount "(abs(suspension_0) + abs(suspension_1) + abs(suspension_2) + abs(suspension_3)) * sin(GetUpperRTime() * 15) * 0.14"
}
```

**GUID note:** `{A1B2C3D4E5F60001}` is a placeholder. Workbench replaces it with a real GUID on first open/save. Use any hex string that doesn't match an existing GUID in the file.

**`Amount` vs node `Expression`:** When a bone item has its own `Amount` property, that expression is used for that bone independently. The node-level `Expression` applies only to bones without an `Amount`. Existing bones (mirrors, hood, wipers) are unaffected.

---

## Expression breakdown

```
(abs(suspension_0) + abs(suspension_1) + abs(suspension_2) + abs(suspension_3)) * sin(GetUpperRTime() * 15) * 0.14
```

| Part | Role |
|---|---|
| `abs(suspension_N)` per wheel | Per-wheel absolute suspension compression. Using `abs()` per-wheel avoids cross-cancellation (left-compress + right-extend summing to zero). |
| Sum 0–4 | Total suspension activity — quiet on flat road, amplified on bumps |
| `sin(GetUpperRTime() * 15)` | ~2.4 Hz oscillation driven by real wall-clock time (confirmed working in Body sheet from Wipers node) |
| `* 0.14` | Exaggerated scale. Peak at 4-wheel full compression = 0.56 units travel |

**Behaviour:**
- Flat road, suspensions near 0 → barely moves
- Moderate rough terrain (~0.3 per wheel avg) → peak ~0.17 units travel
- Heavy off-road / big bumps (~0.7 per wheel avg) → peak ~0.39 units travel

---

## What is NOT changing

- Main sheet (driver character animation chain) unchanged
- Co-driver, passenger paths unaffected
- Existing Jiggles bones (mirrors, wipers, hood) unaffected
- No IK chain modifications, no AGR changes

---

## Tuning

Change `0.14` for intensity:
- `0.05` = subtle
- `0.14` = exaggerated (target)
- `0.25`+ = extreme

Change `15` for frequency (rad/s):
- `8` = slow heavy bounce
- `15` = fast road vibration (target)
- `20` = rapid shimmy
