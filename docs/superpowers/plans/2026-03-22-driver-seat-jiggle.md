# Driver Seat Jiggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one bone item to the existing `Jiggles` ProcTransform in the M151A2 Body sheet so the `driver_idle` seat socket bounces vertically with suspension activity.

**Architecture:** The `driver_idle` bone is the vehicle seat attachment socket. Adding a Y-axis Translate entry with a suspension-driven expression to the existing `Jiggles` node physically repositions the character each frame. No new nodes, no structural changes, no AGR changes.

**Tech Stack:** Enfusion AGF text format, direct file edit.

---

## Files

| File | Change |
|---|---|
| `C:/Users/Steffen/Documents/My Games/ArmaReforgerWorkbench/addons/TESTING CLAUD/Testanims2/Testanims2M151A2.agf` | Add one `AnimSrcNodeProcTrBoneItem` inside the existing `Jiggles` node's `Bones {}` block |

---

### Task 1: Add the seat jiggle bone item

**Files:**
- Modify: `Testanims2M151A2.agf` — Body sheet, `Jiggles` node, `Bones {}` block

- [ ] **Step 1: Locate the insertion point**

Open `Testanims2M151A2.agf`. Find the `Jiggles` node in the Body sheet (search for `AnimSrcNodeProcTransform Jiggles`). It currently ends with:

```
      AnimSrcNodeProcTrBoneItem "{68EC9D5F562D4C9E}" {
       Bone "v_hood_jiggle"
       Op Rotate
      }
     }
    }
```

The closing `}` of the `Bones {}` block is after `v_hood_jiggle`.

- [ ] **Step 2: Add the driver_idle bone item**

Insert the following immediately before the closing `}` of the `Bones {}` block (after the `v_hood_jiggle` item):

```
      AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60001}" {
       Bone "driver_idle"
       Axis Y
       Op Translate
       Amount "(abs(suspension_0) + abs(suspension_1) + abs(suspension_2) + abs(suspension_3)) * sin(GetUpperRTime() * 15) * 0.14"
      }
```

After the edit, the end of the `Bones {}` block should look like:

```
      AnimSrcNodeProcTrBoneItem "{68EC9D5F562D4C9E}" {
       Bone "v_hood_jiggle"
       Op Rotate
      }
      AnimSrcNodeProcTrBoneItem "{A1B2C3D4E5F60001}" {
       Bone "driver_idle"
       Axis Y
       Op Translate
       Amount "(abs(suspension_0) + abs(suspension_1) + abs(suspension_2) + abs(suspension_3)) * sin(GetUpperRTime() * 15) * 0.14"
      }
     }
    }
```

- [ ] **Step 3: Verify the edit is syntactically clean**

The indentation uses single spaces (1 space per level). Confirm:
- Opening `{` on the same line as `AnimSrcNodeProcTrBoneItem`
- `Bone`, `Axis`, `Op`, `Amount` each on their own indented line
- Closing `}` on its own line at the same indent as the opening line
- The `Bones {}` outer block still closes correctly after this new item

- [ ] **Step 4: Open in Workbench to let it assign a real GUID**

Open the Workbench Animation Editor with the `Testanims2M151A2.agf` file. Workbench will detect `{A1B2C3D4E5F60001}` as a placeholder and replace it with a real GUID on save. Save the file from within Workbench.

If Workbench refuses to open due to a parse error, the indentation or brace structure is wrong — re-check Step 2.

- [ ] **Step 5: Test in-game**

Launch the game with the TESTING CLAUD mod. Spawn the M151A2 using the custom prefab. Drive over rough terrain (dirt roads, off-road).

Expected: driver character visibly bounces up and down, amplitude grows on rough terrain, nearly still on flat paved road.

If no movement is visible: the `driver_idle` bone name may differ. Try `Driver_Idle` (capital D) or `slot_driver`. Inspect the vehicle skeleton in the Resource Manager to confirm the exact bone name.

- [ ] **Step 6: Tune if needed**

To adjust intensity, change `0.14` in the `Amount` expression:
- Too subtle → increase toward `0.25`
- Too extreme → decrease toward `0.08`

To adjust frequency, change `15`:
- Too fast/jittery → lower to `10` or `8`
- Too slow → raise to `18` or `20`

- [ ] **Step 7: Commit**

```bash
git add "C:/Users/Steffen/Documents/My Games/ArmaReforgerWorkbench/addons/TESTING CLAUD/Testanims2/Testanims2M151A2.agf"
git commit -m "feat(animation): add suspension-driven driver seat jiggle to M151A2"
```

(Commit from the `enfusion-mcp-BK` repo if the game files are tracked there, otherwise commit from the mod directory if it has its own git repo.)
