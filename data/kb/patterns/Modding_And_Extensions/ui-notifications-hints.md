# UI — Notifications, Hints, End Screen, Field Manual, Layout

---

## Layout / UI System

**UI Types**:
- **Display** — HUD-like, character control not captured (e.g., ammo counter).
- **Menu** — interactable, captures cursor/movement (e.g., inventory).
- **Dialog** — requires input, stacks above menus by priority (e.g., OK/Cancel).

**Creating a Menu/Dialog**:
1. Add enum constant to `ChimeraMenuPreset` via `modded enum`.
2. Override `chimeraMenus.conf`; add entry where name matches enum constant exactly.
3. Set layout path and class (must inherit `MenuBase`, `ChimeraMenuBase`, or `MenuRootBase`).

**Opening UI**:
```
// Display (raw widget)
GetGame().GetWorkspace().CreateWidgets(m_sLayout);

// Menu
GetGame().GetMenuManager().OpenMenu(ChimeraMenuPreset.TAG_MyMenu);

// Dialog
GetGame().GetMenuManager().OpenDialog(ChimeraMenuPreset.TAG_MyDialog);
```

**Useful MenuManager methods**: `IsAnyDialogOpen()`, `GetTopMenu()`, `CloseAllMenus()`

**Widget library prefix**: `WLib_` (e.g., `WLib_ButtonText.layout`, `WLib_Slider.layout`)

**Pitfall**: `SCR_ButtonTextComponent` sets button text — use the script component property, not the Text widget's `Text` property directly.

---

## Modular Button Component

`SCR_ModularButtonComponent` on a Button widget.

**Effect Classes**:

| Class | Effect |
|---|---|
| `SCR_ButtonEffectColor` | Animate color |
| `SCR_ButtonEffectImage` | Set image texture (supports imageset) |
| `SCR_ButtonEffectOpacity` | Animate opacity |
| `SCR_ButtonEffectPadding` | Animate padding |
| `SCR_ButtonEffectPosition` | Animate/set position |
| `SCR_ButtonEffectSize` | Animate/set size |
| `SCR_ButtonEffectText` | Set text widget content |
| `SCR_ButtonEffectSound` | Play sound |
| `SCR_ButtonEffectVisibility` | Show/hide widget |
| `SCR_ButtonEffectSlaveButton` | Pass events to nested button |

**States (mutually exclusive)**: `DEFAULT`, `HOVERED`, `DISABLED`, `ACTIVATED`, `ACTIVATED_HOVERED`

**Events (non-exclusive)**: `CLICKED`, `FOCUS_GAINED`, `FOCUS_LOST`, `TOGGLED_ON`, `TOGGLED_OFF`

**Runtime API**:
```
SCR_ButtonEffectBase FindEffect(string tag)
array<SCR_ButtonEffectBase> FindAllEffects(string tag)
void SetEffectsWithAnyTagEnabled(array<string> tags)
void SetAllEffectsEnabled(bool enable)
effect.PropertiesChanged()  // re-apply after manual property changes
```

---

## Notification System

**Step 1**: Add unique int-valued entry to `ENotification` enum.

**Step 2**: Add to `Configs/Notifications/Notifications.conf` on `PlayerController`. Set `Notification Key` to enum entry.

**Notification Data Classes**:

| Class | Parameters |
|---|---|
| `SCR_NotificationDisplayData` | None (plain text only) |
| `SCR_NotificationPlayer` | Param1: PlayerID → `%1` = player name |
| `SCR_NotificationPlayerTargetPlayer` | Param1: PlayerID, Param2: Target PlayerID |
| `SCR_NotificationEditableEntity` | Param1: EditableEntityID |
| `SCR_NotificationNumber` | Up to 5 numbers (int); use Number Divider for floats |
| `SCR_NotificationPlayerAndNumber` | PlayerID + up to 4 numbers |

**Float-as-int**: Multiply float × 10/100/1000, store as int, set Number Divider to same multiplier.

**UI Info Classes**:
- `SCR_UINotificationInfo` — default
- `SCR_ColoredTextNotificationUIInfo` — colored text
- `SCR_SplitNotificationUIInfo` — kill-feed style (PlayerA [icon] PlayerB)

**Color Enums (`ENotificationColor`)**:
- `NEUTRAL`, `WARNING`, `POSITIVE`, `NEGATIVE`, `GM`, `GM_ONLY`
- `FACTION_FRIENDLY_IS_NEGATIVE` — friendly = negative, enemy = positive (e.g., "player died")
- `FACTION_FRIENDLY_IS_POSITIVE` — friendly = positive, enemy = negative
- `FACTION_ENEMY_IS_NEGATIVE_ONLY` / `FACTION_FRIENDLY_IS_POSITIVE_ONLY` — neutral if opposite faction

**Send Methods** (static on `SCR_NotificationsComponent`):
```
SendToEveryone(ENotification, ...)
SendToPlayer(PlayerID, ENotification, ...)
SendLocal(ENotification, ...)
SendToGameMasters(ENotification, ...)
SendToGameMastersAndPlayer(PlayerID, ENotification, ...)
SendLocalGameMaster(ENotification, ...)
SendLocalNonGameMaster(ENotification, ...)
SendToGroup(groupID, ENotification, ...)
```

**Custom notification**: Inherit from `SCR_NotificationDisplayData`; override `GetText()`.

---

## Hint System

**Config class**: `SCR_HintUIInfo`

**Key properties**:
- `Name` — title (keep short).
- `Description` — plain text body. Do NOT mix with Description Blocks.
- `Description Blocks` — structured blocks. Do NOT mix with Description.
- `Priority` — if >= current, replaces immediately; otherwise queues.
- `Duration` — seconds; 0 = manager default; -1 = stays until closed.
- `Show Limit` — times to show before suppressing permanently (survives restart).
- `Is Timer Visible` — shows progress bar/countdown.
- `Field Manual Link` — `EFieldManualEntryId` value to add Field Manual button.
- `Highlight Widgets Names` — highlights named widgets in current menu.

**Description Block Types**:

| Block | Purpose |
|---|---|
| `ActionBlockUIName` | Shows input binding (auto keyboard/gamepad) |
| `BulletPointUIName` | Bullet-pointed text |
| `DeviceBlockUIName` | Text shown only for specific input device |
| `ImageBlockUIName` | Inline image (imageset or plain) |
| `KeyBlockUIName` | Custom key bind display |
| `SimpleTextBlockUIName` | Formatted text (H1, H2, P, B, I tags) |
| `SubBlockUIName` | Plain text |
| `TipBlockUIName` | Tip-style text with tip icon, reduced opacity |

**Creating hint in script** (title + description only, no blocks):
```
TAG_HintInfo = SCR_HintUIInfo.CreateInfo(description, name, duration, type, isTimerVisible, fieldManualEntry);
SCR_HintManagerComponent.ShowHint(TAG_HintInfo);
```

**Updating shown hint**:
```
m_Hint.SetDescription("text");
m_Hint.SetName("title");
m_Hint.SetDescriptionBlockName(index, "text with %1");
SCR_HintManagerComponent.Refresh();
```

**Hint Sequences**:
1. Create `SCR_HintSequenceList` config with Hints array.
2. Attach `SCR_HintSequenceComponent` to entity; assign sequence config.
3. Methods: `StartSequence()`, `StopSequence()`, `ToggleSequence()`, `IsSequenceActive()`, `GetOnSequenceActive()` (ScriptInvoker).

---

## End Screen / Game Over

**Trigger end game**:
```
SCR_BaseGameMode gamemode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
// Simple (single winner/faction):
gamemode.EndGameMode(SCR_GameModeEndData.CreateSimple(EGameOverTypes.YOUR_ENUM, winnerId, winnerFactionId));
// -1 for no winner/faction
// Multi (arrays):
gamemode.EndGameMode(SCR_GameModeEndData.Create(EGameOverTypes.YOUR_ENUM, winnerIds, winnerFactionIds));
```

**Config**: `GameOverScreensConfig.conf`. Each entry requires:
- `Game Over Content Layout` — layout spawned within `EndScreen.layout`.
- `Game Over Screen Id` — unique `EGameOverTypes` enum value.

**Info classes**:
- `SCR_BaseGameOverScreenInfo` — base (title, subtitle, briefing, image)
- `SCR_FactionGameOverScreenInfo` — faction flag as image, faction name in subtitle
- `SCR_FactionVictoryGameOverScreenInfo` — adds winning faction vignette color
- `SCR_EditorFactionGameOverScreenInfo` — supports multiple winning factions (GM)
- `SCR_DeathMatchGameOverScreenInfo` — winning player name in subtitle

**Expected widget names** (optional — missing silently skipped):
- `GameOver_Image` (ImageWidget) — title image
- `GameOver_State` (TextWidget) — title
- `GameOver_Condition` (TextWidget) — subtitle
- `GameOver_Description` (TextWidget) — debrief

**Layout component**: `SCR_GameOverScreenContentUIComponent`. Override `InitContent()` for custom logic; call `super.InitContent()`.

**GM mirrored state**: Set Victory `Can Be Set By GM = true`, Defeat = false; set Mirrored State pointing to each other.

---

## Field Manual Modding

**Structure**: Root Config → Categories → SubCategories → Entries → Pieces.
- UI supports two levels only (Category > SubCategory).

**Root config**: `Configs/FieldManual/FieldManualConfigRoot.conf`

**Entry types**:
- `SCR_FieldManualConfigEntry_Standard` — full-width page
- `SCR_FieldManualConfigEntry_Weapon` — weapon stats side panel

**Entry `Id` field**: Must be an `EFieldManualEntryId` enum value if opened from external code.

**Piece types**:

| Piece | Purpose |
|---|---|
| `SCR_FieldManualPiece_Header` | Heading with optional icon/image |
| `SCR_FieldManualPiece_Text` | Text paragraph |
| `SCR_FieldManualPiece_Image` | Single image |
| `SCR_FieldManualPiece_ImageGallery` | Gallery (ICONS_VERTICAL, ICONS_LIST, GALLERY_HORIZONTAL, GALLERY_VERTICAL) |
| `SCR_FieldManualPiece_Keybind` | Keybind display (ALL_INPUTS, KEYBOARD_ONLY, GAMEPAD_ONLY) |
| `SCR_FieldManualPiece_KeybindList` | List of keybinds |
| `SCR_FieldManualPiece_ConfigEntry` | Read value from .conf/.et at given path |
| `SCR_FieldManualPiece_ConfigEntryList` | List of ConfigEntry pieces |
| `SCR_FieldManualPiece_LineBreak` | Empty gap |
| `SCR_FieldManualPiece_Separator` | Styled horizontal rule |

**Opening from script**:
```
SCR_FieldManualUI.Open(EFieldManualEntryId.CONFLICT_OVERVIEW);
```

---

## Commanding Menu Modding

**Base class**: `SCR_BaseGroupCommand`

**Methods**:
- `Execute(IEntity cursorTarget, IEntity target, vector pos, bool isClient)` — runs on server AND each client.
- `CanBeShown()` — evaluated on client.
- `CanBePerformed()` — evaluated on client.

**Pitfall**: `Execute()` is broadcast to server and all clients. Use `if (isClient) return false;` for server-only logic.

**Config**: `Commands.conf` — command class, string ID, leader-only flag.
**Menu configs**: `CommandingMenu.conf` (radial) and `CommandingMapMenu.conf` (map menu).

---

## Localisation

**Languages**: `en_us`, `fr_fr`, `it_it`, `de_de`, `es_es`, `cs_cz`, `pl_pl`, `ru_ru`, `ja_jp`, `ko_kr`, `pt_br`, `zh_cn`. `en_us_edited` is for in-progress translations.

**Workflow**:
1. Create `.st` file (String Table) via String Editor File > New (Ctrl+N).
2. Register in Workbench Options > Widget Manager Settings > String Tables array.
3. Add language entries with runtime config files (one per language, e.g., `localization.en_us.conf`).
4. Build runtime table: String Editor > Table > Build Runtime Table (Ctrl+B).
5. Rebuild every time the .st file changes.

**Automated localisation**: `Plugins > Localize Selected Files` (Ctrl+Alt+L). Set Config Path to parser config (e.g., `Editor.conf`).

**In-script localised string attribute**:
```
[Attribute(uiwidget: UIWidgets.LocaleEditBox, defvalue: "#AR-Editor...")]
protected LocalizedString m_sIntroHintTitle;
```

**Strings starting with `#` are automatically localised in UI** — no `localize` command needed.

**Change prefix** from `AR` to your mod tag to avoid string clashes.

**Debug**: Diag Menu > UI > Disable > Disable Loc — shows raw `#prefix-key` strings.
