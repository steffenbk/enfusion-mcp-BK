# Gadgets, Flashlights & User Actions

---

## SCR_FlashlightComponent Internals (Pitfalls When Subclassing)

### `ActivateGadgetUpdate()` Physically Shifts the Entity

`SCR_FlashlightComponent.ActivateGadgetUpdate()` calls `AdjustTransform(m_vFlashlightAdjustOffset)`
which moves the flashlight to its "active" position in the hand.
`DeactivateGadgetUpdate()` moves it back.

**Pitfall:** Calling `EnableLight()` / `DisableLight()` in a rapid loop (e.g. strobe)
will call `AdjustTransform` on every toggle, causing the flashlight to float above the hand.

**Fix:** Use `GetGame().GetCallqueue().CallLater(StrobeTick, intervalMs, true)` for strobe.
Toggle only the light source and emissive inside the tick, never the gadget update path.

### `SetEmissiveMultiplier` is Absolute, Not a Factor

`EnableLight()` sets emissive to `m_fEmissiveIntensity` (e.g. `100`).
When applying a brightness multiplier, you must scale against that base value:
```c
// WRONG — looks correct but produces near-black emissive at 0.8 multiplier
m_EmissiveMaterial.SetEmissiveMultiplier(mult);

// CORRECT
m_EmissiveMaterial.SetEmissiveMultiplier(m_fEmissiveIntensity * mult);
```

### `super.OnOwnerLifeStateChanged()` Clears `m_bActivated`

The base class death handler sets `m_bActivated = false` before returning.
If you check `m_bActivated` after calling `super`, it will always be false.

**Fix:** Capture the state before the super call:
```c
override protected void OnOwnerLifeStateChanged(ECharacterLifeState previousLifeState, ECharacterLifeState newLifeState)
{
    bool wasActive = m_bActivated;  // capture BEFORE super clears it
    super.OnOwnerLifeStateChanged(previousLifeState, newLifeState);
    if (wasActive)
        EnableLight();  // re-enable after super reset it
}
```

### `ModeSwitch` Calls `OnToggleActive(false)` Directly — Bypasses Script Override

When the flashlight mode changes to `ON_GROUND`, `ModeSwitch` calls `OnToggleActive(false)`
on the base class directly, setting `m_bActivated = false` without going through your override:
```c
override protected void ModeSwitch(EGadgetMode aMode, IEntity pOwnerEntity)
{
    bool wasActive = m_bActivated;
    super.ModeSwitch(aMode, pOwnerEntity);
    if (wasActive && aMode == EGadgetMode.ON_GROUND)
        EnableLight();
}
```

---

## ScriptedUserAction Pattern

Add-on actions shown in the inspect interaction menu. Inherit from `ScriptedUserAction`.

```c
class SCR_MyFlashlightAction : ScriptedUserAction
{
    protected SCR_FlashlightCustomMade m_FlashlightComp;

    // Called once when the action is registered — find your component here
    override void Init(IEntity pOwnerEntity, GenericComponent pManagerComponent)
    {
        m_FlashlightComp = SCR_FlashlightCustomMade.Cast(
            pOwnerEntity.FindComponent(SCR_FlashlightCustomMade));
    }

    // Return true when the action should appear in the menu
    override bool CanBeShownScript(IEntity user)
    {
        if (!m_FlashlightComp || !m_FlashlightComp.IsLightOn())
            return false;
        ChimeraCharacter character = ChimeraCharacter.Cast(user);
        if (!character) return false;
        CharacterControllerComponent ctrl = character.GetCharacterController();
        return ctrl && ctrl.GetInspectEntity() == GetOwner();
    }

    override bool CanBePerformedScript(IEntity user)
    {
        return m_FlashlightComp != null;
    }

    override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity)
    {
        if (m_FlashlightComp)
            m_FlashlightComp.CycleStrobePattern();
    }

    // Dynamic label — return true to use outName
    override bool GetActionNameScript(out string outName)
    {
        outName = "Strobe: " + m_FlashlightComp.GetStrobePatternName();
        return true;
    }
}
```

Add to prefab `ActionsManagerComponent → additionalActions`, with a `ParentContextList` entry
matching the context (e.g. `"lens"`) so it only appears in the right inspect mode.
