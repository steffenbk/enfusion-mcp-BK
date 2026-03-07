# Game Master (GM) Mode

---

## Architecture

**Budget System**: Four independent budgets cap entity placement: Object (props/compositions), AI (NPCs), Vehicle, System (respawn points/objectives/arsenals). Each caps at 100%. Reaching 100% on one does not block others. Killed/destroyed entities still consume budget until "Clear Destroyed Entities" is used.

**GM Role Rules**:
- Server host / declared server admin always has GM access.
- First connecting player gets GM if no GM present; role cannot be transferred while connected.

---

## Waypoint Types

| Name | Prefab | Completes when | Default Timeout | Radius |
|---|---|---|---|---|
| Move | `E_AIWaypoint_Move.et` | Group leader reaches radius | N/A | 5 m |
| Forced Move | `E_AIWaypoint_ForcedMove.et` | Same; ignores autonomous behaviour | N/A | 5 m |
| Move Relaxed | `E_AIWaypoint_Patrol.et` | Same; slower movement | N/A | 5 m |
| Search and Destroy | `E_AIWaypoint_SearchAndDestroy.et` | No known enemies in radius for full timer | 600 s | 20 m |
| Defend | `E_AIWaypoint_Defend.et` | Never | Never | 30 m |
| Get In | `E_AIWaypoint_GetInNearest.et` | All units mounted or timeout | 30 s | 20 m |
| Get Out | `E_AIWaypoint_GetOut.et` | Units disembark | N/A | 9 m |
| Suppressive Fire | `E_AIWaypoint_Suppress_Editor.et` | Never | Never | — |

Behavior trees: `~ArmaReforger:AI/BehaviorTrees/Waypoints/`

---

## Composition Configuration

**Naming Convention**:
- Flexible: `<NAME>_<SIZE>_<FACTION>_<ID>` — e.g., `PlayerHub_L_US_01`
- Static: `<NAME>_<FACTION>_<ID>` — e.g., `Camping_US_01`
- Sizes: L/M/S. Factions: US, USSR, FIA. ID: two-digit from 01.

**Key SCR_SlotCompositionComponent properties**:
- `Orient Children To Terrain` — snap and orient children on placement.
- `Non Editable Children` — treats composition as single entity in GM.

**Prefab editing rules**:
- Use Alt+LMB drag (not plain LMB) to place inside composition hierarchy.
- Changes are instance-only until "Apply to prefab" (tick "Apply to transformation").
- Changes only persist to disk on world save (Ctrl+S).
- To delete a child from prefab: RMB > "Delete from prefab" — Delete key only removes the instance.
- Use entities from `Prefabs/` folder, not `PrefabsEditable/`.

**Editable variant generation**:
- Plugin: `Plugins > In-game Editor > Create/Update Selected Editable Prefabs` (Ctrl+Shift+U)
- Output: `PrefabsEditable/Auto` and `UI/Textures/EditorPreviews/Auto`
- States: Created/Updated, Failed (usually child with `RplComponent`), Non-editable
- Update all: `Plugins > In-game Editor > Update All Editable Prefabs`

**Registration config**: `Configs/Editor/PlaceableEntities/Compositions/Compositions.conf`
- Plugin: `Plugins > In-game Editor > Register Placeable Entities...`
- For mods: extend with modded config file and register new compositions there.

**Pitfall**: `EditablePrefabsConfig.conf` Image Placeholder must point to a registered PNG source file (not a packed EDDS). Override this config in your addon.

---

## Editable Entities Configuration

**Automated plugin rules**:
- Config: `EditablePrefabsConfig.conf`
- Prefabs with `_base`, `_Base`, `_dst`, `_Dst`, `_DST` suffixes are ignored.
- Output editable prefabs get `E_` prefix.
- Display name: `#AR-EditableEntity_%1_Name` — change `AR` to your mod tag to avoid string clashes.
- Auto-assigned components: `SCR_EditableEntityComponent`, `SCR_EditableCharacterComponent`, `SCR_EditableVehicleComponent`, `SCR_EditableGroupComponent`.

**Manual custom prefab**:
1. Add `Default_RplComponent.ct` and `Default_SCR_EditableEntityComponent.ct`.
2. Place in `PrefabsEditable/` (not `Auto/`).
3. Name with `E_` prefix.

**Registering to Asset Browser**:
1. Create `SCR_PlaceableEntitiesRegistry` config in `Configs/Editor/PlaceableEntities/`.
2. Set Source Directory to editable prefab folder.
3. Open `EditorModeEdit.et` (override in your addon first), drag registry to `SCR_PlacingEditorComponent.Registries`.
4. Run `Plugins > In-game Editor > Register Placeable Entities...`.

**Pitfall**: Only localised strings are searchable by name in Asset Browser. Non-localised display names are not searchable.

---

## Context Actions

**Base class**: `SCR_GeneralContextAction`

**Methods to override**:
- `CanBeShown()` — if false, action is hidden and shortcut blocked.
- `CanBePerformed()` — shows but locked.
- `Perform()` — execution logic.

**Config locations** (`Configs/Editor/ActionLists/Context/`):
- `TempEdit.conf` — Edit mode
- `TempAdmin.conf` — Admin mode
- `TempPhoto.conf` — Photo mode
- `Shared.conf` — All modes
- `Tasks.conf` — Player tasks

**Key config variables**:
- `IsServer` — executes server-side.
- `Shortcut` — input action name from `chimeraInputCommon.conf`.
- `Enable Shortcut Logics` — enables shortcut execution.
- `Cooldown Time` — seconds; ≤0 disables cooldown.
- `Order` — higher = higher in list.
- `Hide On Hover` / `Hide On Selected` — contextual visibility.

**Shortcut-only action**: Leave UIInfo empty, fill Shortcut, enable shortcut logics.

---

## Toolbar Actions

**Base classes**:
- `SCR_EditorToolbarAction` — single-click.
- `SCR_BaseToggleToolbarAction` — toggleable; adds `Track()`, `Untrack()`, `Toggle()`.
- `SCR_BaseCommandAction` — faction/command bar; has `Command Prefab` spawned on toggle.

**Methods**: `CanBeShown()`, `CanBePerformed()`, `Perform()`, `IsServer()`.

**Config locations** (`Configs/Editor/ActionLists/Toolbar/`):
- `EditToolbar.conf`, `PhotoToolbar.conf`, `AdminToolbar.conf`, `SharedToolbar.conf`
- Command bar: `Configs/Editor/ActionLists/Command/Command.conf`

**Action Types**: `ACTION` (single click), `TOGGLE` (togglable), `DYNAMIC` (conditionally shown).

---

## Entity Attributes (Properties)

Located in `scripts/Game/Editor/Containers/Attributes/`.

**Base classes**:
- `SCR_BaseEditorAttribute` — base
- `SCR_BaseValueListEditorAttribute` — sliders
- `SCR_BaseFloatValueHolderEditorAttribute` — dropdowns/spinboxes
- `SCR_BasePresetsEditorAttribute` — single-select buttons
- `SCR_BaseMultiSelectPresetsEditorAttribute` — multi-select buttons (flags)

**Methods to override**:
- `ReadVariable()` — create and return `SCR_BaseEditorAttributeVar`. Return null to hide.
- `WriteVariable()` — receive changed var and apply. Only called if user changed value.
- `GetEntries()` — supply button labels, slider min/max/step.
- `PreviewVariable()` — called on every input change for live preview.

**Creating vars**:
```
return SCR_BaseEditorAttributeVar.CreateInt(value);
return SCR_BaseEditorAttributeVar.CreateBool(value);
return SCR_BaseEditorAttributeVar.CreateFloat(value);
return SCR_BaseEditorAttributeVar.CreateVector(value);
```

**Reading vars**:
```
var.GetInt();  var.GetBool();  var.GetFloat();  var.GetVector();
```

**Attribute layout files** (`UI/layouts/Editor/Attributes/AttributePrefabs/`):
- `AttributePrefab_Checkbox.layout` — Bool
- `AttributePrefab_Slider.layout` — Float
- `AttributePrefab_Dropdown.layout` — Int single select
- `AttributePrefab_Spinbox.layout` — Int single select
- `AttributePrefab_ButtonBox_Selection.layout` — Int single select
- `AttributePrefab_ButtonBox_MultiSelection.layout` — Vector (flags)

**Config locations** (`Configs/Editor/AttributeLists/`): `Edit.conf`, `Photo.conf`, `Admin.conf`

**Dynamic description classes**:
- `SCR_BoolAttributeDynamicDescription` — shows when bool matches condition.
- `SCR_ValueAttributeDynamicDescription` — shows when float meets condition.

**Pitfall**: `IsServer` only applies to `ReadVariable()` and `WriteVariable()`. `GetEntries()` and `PreviewVariable()` still run client-side.

---

## Entity Tooltips

**Base class**: `SCR_EntityTooltipDetail` (`scripts/Game/Editor/UI/Components/Tooltips/Tooltips/Details/`)

**Methods**:
- `InitDetail(Widget w)` — get widget refs; return true to show. Once shown, cannot be hidden until focus leaves entity.
- `NeedUpdate()` — return true to trigger `UpdateDetail()` after init.
- `UpdateDetail()` — update widget content.

**Config**: `Configs/Editor/Tooltips/EntityTooltips.conf` — single config, all entity types. Array order = tooltip order.

---

## Preview Image Generation

**World**: `Worlds/Editor/Slots/AssetImages/Eden_AssetImages.ent`. Target resolution: 400×300. Set Windows display scale to 100% if images fail.

**Entities**:
- `SCR_EditorImageGeneratorEntity` — main generator.
- `SCR_EditorImagePositionEntity` — spawn position; matched by label set (all position labels must be in prefab labels).
- `SCR_CameraBase` (child of position) — capture camera. FOV not copied from WE.

**Run**: Select prefabs in resource browser → Play. System spawns each at matching label position and captures.

**Prerequisite**: `Create/Update Selected Editable Prefabs` must run first.
