# UI — Dialogs, Tooltips, Diag Menu

---

## Configurable Dialog System

Preset-based dialog system separating config from code.

### Core Classes

| Class | Role |
|---|---|
| `SCR_ConfigurableDialogUiPresets` | Config root — list of dialog presets |
| `SCR_ConfigurableDialogUiPreset` | One dialog: tag, style, layout, message, title, buttons |
| `SCR_ConfigurableDialogUiButtonPreset` | One button: tag, label, alignment |
| `SCR_ConfigurableDialogUi` | Main handler — inherits `ScriptedWidgetComponent`, attached to dialog root widget |
| `SCR_ConfigurableDialogUiProxy` | Parent menu holding dialog widgets |

### Standard Layouts
- `ConfigurableDialog` (small)
- `ConfigurableDialog_Medium`
- `ConfigurableDialog_Big`

Layout structure: Size widget → Header (title + icon) → Message text → Content area → Footer (buttons).

### Usage Pattern 1 — Basic (subscribe to events)
```c
const ResourceName DIALOGS_CONFIG = "{GUID}Configs/Dialogs/MyDialogs.conf";
SCR_ConfigurableDialogUi dialog = SCR_ConfigurableDialogUi.CreateFromPreset(DIALOGS_CONFIG, "my_tag");
dialog.m_OnClose.Insert(OnDialogClose);
// Also: m_OnConfirm, m_OnCancel
```

### Usage Pattern 2 — Standard (dialog owns itself)
```c
class SCR_ExitGameDialog : SCR_ConfigurableDialogUi
{
    void SCR_ExitGameDialog()
    {
        // Passing 'this' ties the handler to the dialog
        SCR_ConfigurableDialogUi.CreateFromPreset(SCR_CommonDialogs.DIALOGS_CONFIG, "exit_game", this);
    }

    override void OnConfirm()
    {
        GetGame().RequestClose();
    }
}

// Spawn:
new SCR_ExitGameDialog();
```

### Usage Pattern 3 — Advanced (dynamic content)
```c
class SCR_AddonListDialog : SCR_ConfigurableDialogUi
{
    override void OnMenuOpen(SCR_ConfigurableDialogUiPreset preset)
    {
        VerticalLayoutWidget layout = VerticalLayoutWidget.Cast(GetContentLayoutRoot());
        WorkspaceWidget workspace = GetGame().GetWorkspace();
        Widget w = workspace.CreateWidgets(ADDON_LINE_LAYOUT, layout);
        // populate widgets...
    }
}
```

### Initialization Sequence (internal)
1. `CreateFromPreset()` called.
2. Config loaded, preset found by tag.
3. Proxy dialog created in `MenuManager`.
4. Layout widgets created inside proxy using `preset.m_sLayout`.
5. `customDialogObj` attached (or new `SCR_ConfigurableDialogUi` created).
6. `Dialog.Init()` called — applies title, message, adds buttons.
7. `Dialog.OnMenuOpen()` called — custom init hook.

**Pitfalls:**
- Tags must be unique within a single `.conf` file.
- The actual widget in MenuManager is `ConfigurableDialogProxy` (empty overlay), referenced in `chimeraMenus.conf`. Actual dialog created inside it.

---

## Widget Tooltip System

`SCR_ScriptedWidgetTooltip` — hover/gamepad-focus tooltip.

### Setup in .layout File
1. Select widget → Behavior section → Tooltip class → `SCR_ScriptedWidgetTooltip`.
2. Set `.conf` of type `SCR_ScriptedWidgetTooltipPresets` + a `tag`.

Tooltips trigger automatically on mouse hover and gamepad focus.

### Script Events (static invokers)
```c
SCR_ScriptedWidgetTooltip.m_OnTooltipShowInit  // Before show
SCR_ScriptedWidgetTooltip.m_OnTooltipShow      // On show
SCR_ScriptedWidgetTooltip.m_OnTooltipHide      // On hide
```

**Pitfall:** Invokers are static — always validate with `IsValid()` to confirm the tooltip matches your tag/widget/config. Bind on hover gained, unbind on hover lost to prevent stale subscriptions.

Override `Content` class in preset to provide custom tooltip content layout.

---

## Diag Menu — Scripting API

Available in all 3D viewports in Workbench. Open with Win+Alt.

### Custom Mod Diag Menu Registration
```c
enum TAG_EMyModDiagMenu
{
    ModMenu = 0,
    ModMenu_DEBUG,
    ModMenu_SHOW,
}

// Run once (e.g. in init):
DiagMenu.RegisterMenu(TAG_EMyModDiagMenu.ModMenu, "CategoryName", "");  // "" = root
DiagMenu.RegisterBool(TAG_EMyModDiagMenu.ModMenu_DEBUG, "", "Do debug stuff", "CategoryName");

// Read anywhere:
if (DiagMenu.GetBool(TAG_EMyModDiagMenu.ModMenu_DEBUG))
    Print("Debug mode active");
```

API reference: `scripts/Core/generated/Debug/DiagMenu.c`.

### Diag Navigation Hotkeys
| Key | Action |
|---|---|
| Win+Alt | Open in viewport |
| → / ← | Enter / leave submenu |
| Home | Jump to root |
| Insert | Reset current menu defaults |
| Del | Reset all defaults |
| F1 / F2 | Save / load to user profile |

### Key Weapon Debug Entries (Diag Menu → GameCode > Weapons)
- `Show optics diag` — reticle/scope debug (only when ADS)
- `Show PIP settings diag` — PIP scope debug
- `Disable aim modifiers` — removes sway (use for zeroing tests)
- `Disable character aim modifiers`
- `Disable weapon offset`
- `Weapon obstruction` — spheres: green=clear, red=obstructed, orange=reference offset points
- `Show sights points` — visualise sight point positions
