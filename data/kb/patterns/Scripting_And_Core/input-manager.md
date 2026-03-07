# Input Manager

---

## Config File

`chimeraInputCommon.conf` — defines all Actions and Contexts.

---

## Action Types

| Type | Device |
|---|---|
| `Digital` | Keyboard, mouse buttons |
| `Analog` | Gamepad thumbsticks/triggers |
| `AnalogRelative` | Mouse wheel, relative mouse position |
| `Motion` | Absolute mouse position, VR controllers |

---

## Input Sources

| Source | Behaviour |
|---|---|
| `InputSourceValue` | Single key/button |
| `InputSourceSum` | Sums multiple sources (keyboard + gamepad same action) |
| `InputSourceCombo` | All sources must be active (e.g. Ctrl+A vs A); blocks lower sources while active |
| `InputSourceEmpty` | No input |

---

## Input Filters

Applied to transform raw value before it becomes action value:

| Filter | Behaviour |
|---|---|
| `InputFilterDown` | Fires once on key press (rising edge) |
| `InputFilterUp` | Fires once on key release (falling edge) |
| `InputFilterClick` | Fires on key-up IF held less than `HOLD_DURATION` |
| `InputFilterHold` | Returns 1.0 once held for `HOLD_DURATION` (gradual 0→1 during hold) |
| `InputFilterHoldOnce` | Same but fires exactly once |
| `InputFilterToggle` | Toggles 0/1 on each rising edge |
| `InputFilterRepeat` | Fires on down, then repeats every `REPEAT_INTERVAL` after `INITIAL_INTERVAL` |
| `InputFilterDoubleClick` | Double press within `DOUBLE_CLICK_DURATION` |

---

## Contexts

- Group related actions. A context must be activated each frame (or toggled once).
- Each context has **priority** and **flags**.
- Context with higher or equal priority wins; lower-priority contexts are zeroed unless `Overlay` is set.

| Flag | Behaviour |
|---|---|
| `Overlay` | Allows lower-priority contexts to also process |
| `CursorVisible` | Shows the cursor |
| `Exclusive` | Disables other contexts |
| `ForceCursor` | Forces cursor visibility |

---

## Reading Input in Script

```c
// Get action value (0.0 or 1.0 for digital, float for analog)
float value = GetGame().GetInputManager().GetActionValue("CharacterFire");

// Subscribe to action (preferred)
GetGame().GetInputManager().AddActionListener("CharacterFire", EActionTrigger.DOWN, OnFirePressed);

protected void OnFirePressed(float value, EActionTrigger trigger)
{
    // handle press
}
```

---

## Pitfalls

- Input is client-side only — never query input on server.
- `InputSourceCombo` blocks other non-combo sources while active — order combo sources carefully.
- Contexts with equal priority are not guaranteed an order.
