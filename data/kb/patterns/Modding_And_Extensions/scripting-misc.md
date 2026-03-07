# Scripting — Miscellaneous Patterns

---

## Generic (Template) Classes

```
class TAG_EntityCastHelper<Class T>
{
    static T Get(Managed something) { return T.Cast(something); }
    static bool IsValid(Managed something) { return Get(something) != null; }
}

class TAG_ThreeTuple<Class T, Class U, Class V>
{
    protected ref array<T> m_aT = {};
    protected ref array<U> m_aU = {};
    // ...
}
```

**Pitfalls**:
- Script Editor cannot detect errors in template code unless the template is instantiated somewhere.
- Methods used on type `T` must be valid for all intended instantiations. `T.Cast()` works for Managed-derived classes but not `int`.

---

## SQF → Enforce Script: Key Differences

**Coordinate system**: Enfusion uses `{ X, Y, Z }` where Y is up. SQF uses `[X, Z, Y]` (Z is up). A vector pointing up: SQF `[0,0,1]`, Enforce `"0 1 0"`. Enforce is left-handed.

**No `isNil`**: Variables are always defined; content can be null (`if (!myInstance)`).

**No SQF scheduler**: Do not use threads freely. Use `GetGame().GetCallqueue().CallLater(method, milliseconds)` instead of `spawn`.

**`switch` difference**: SQF `default` has no colon; Enforce `default:` has colon.

**Lazy evaluation**: `&&` and `||` short-circuit natively — no need for SQF's `{ }` wrapping trick.

**Array duplication** for ref types requires manual loop or `SCR_ArrayHelper<T>.GetCopy(source)`.

**`exitWith` → `break`** (loops) or `return` (methods).

**`if-then-else` as expression**: Not possible in Enforce Script.

**Map vs HashMap**:
- `Insert(key, value)` — create entry (faster).
- `Set(key, value)` — create or update entry.
- Types are fixed (no mixed-type keys like SQF HashMap).

**`set<T>`** — inserts return false on duplicate (useful for uniqueness).

---

## Game Identity API

**Definition**: One identity per game-platform (Steam or Xbox). Multiple identities can link to one BI account. Two identities linked to same BI account cannot connect to same server simultaneously.

**Get local player identity (client only)**:
```
BackendApi.GetLocalIdentityId()
```

**Get player identity server-side**:
```
BackendApi.GetPlayerIdentityID(int iPlayerId)
```

Note: `platformUID` (SteamID, XboxUID) and BI Account ID are not accessible from script.

---

## Animation Editor: Custom Properties

Open animation in Animation Editor, press **Edit** in preview window to unlock editing.

**Events**: Frame-based, fire on a specific frame. Add/remove via + / - under Events.

**Custom Properties**: Name (string) + value (string, auto-parsed to float/int/vector/3-angles).

**Built-in custom property names**:

| Name | Value format | Effect |
|---|---|---|
| `EntityPos` | `"x,y,z"` | Override total animation translation per loop |
| `EntityRot` | `"x,y,z"` (degrees) | Override total animation rotation per loop |
| `SpeedUpFactor` | float > 0, default `1.0` | Scale animation playback speed |

**Pitfall**: `EntityPos`/`EntityRot` override the `EntityPosition` bone; if that bone is absent, these properties provide the movement values instead.

---

## Asset Browser Mod Integration (Game Master)

**Goal**: Expose mod prefabs in the in-game Editor's Asset Browser.

**Steps**:
1. Create `SCR_PlaceableEntitiesRegistry` config in `Configs/Editor/PlaceableEntities/`.
2. Override `EditorModeEdit.et`: right-click at `$ArmaReforger:Prefabs/Editor/Modes/EditorModeEdit.et` → "Override in [addon]". Keeps same GUID. Overridden assets show puzzle icon in Resource Browser.
3. Add registry to `SCR_PlacingEditorComponent.Registries` in the overridden prefab. Save (Ctrl+S).
4. Populate registry: drag prefabs onto `Prefabs` array, or use `Register Placeable Entities` plugin (set Addon parameter to your addon ID).
5. Add `CONTENT_MODDED` label to `SCR_EditableVehicleComponent` / `SCR_EditableEntityComponent` / `SCR_EditableCharacterComponent` / `SCR_EditableGroupComponent` Authored Labels.

**Pitfall**: Only localised strings are searchable by name. Non-localised display names are not searchable.

---

## Doxygen Documentation Standard

**Preferred comment syntax**: `//!` (block) and `//!<` (inline). Avoid `/* */` to keep block-comment ability.

**Document**: public methods (protected second), dangerous code. Do NOT document trivially self-explanatory methods.

**Tags**:
```
//! \param[in] myParam   description
//! \param[out] myParam  description
//! \param[in,out] myParam description
//! \return description (including error cases)
```

**Anti-patterns to avoid**:
- Description that restates only the method name.
- Param descriptions that repeat the param name.
- `\return true or false` (meaningless).
- Incorrect documentation — a wrong comment is worse than no comment. Prefer `// TODO`.

**Grouping**: Use `\addtogroup` / `\{` / `\}` for multi-class systems.

---

## Floaters Finder Plugin (World Editor)

**Shortcut**: Ctrl + Alt + PgDown

Detects misplaced entities. Key parameters:
- `Active Layer Only` — scope limiter.
- `Search For Entities Below Terrain` — checks bbox vertices vs terrain.
- `Search For Vegetation` — checks floating/sunken trees.
- `Camera Search Radius` (metres, 0 = all entities).
- `Max Selected Entities` — cap on WE selection count.
- `Output Findings To File` / `Use Web Prefix` — write findings to file.

---

## Scenario Framework Update Plugin (1.0.0 → 1.1.0)

Migration procedure (order is mandatory):
1. Back up the world.
2. Load the SF world.
3. Plugins → Update/1.0.0 to 1.1.0 → **Phase 1** → Save.
4. **Reload the world** (mandatory before Phase 2).
5. Plugins → Update/1.0.0 to 1.1.0 → **Phase 2** → Save.

**Pitfall**: Running plugin on an already-1.1.0 scenario has undocumented behavior.

---

## Action Context Setup (ActionsManagerComponent)

**Requirements for user actions to work on an entity:**
- `RplComponent` (for MP sync)
- `MeshObject` with valid mesh
- `RigidBody` with `Model Geometry` checked
- `ActionsManagerComponent` (distinct from `ActionManager` which handles input)

**Setup:**
1. Add `ActionsManagerComponent` to entity.
2. `Action Contexts` array: each context has `Context Name` (unique string), `Position` (PointInfo), UIInfo.
3. `Additional Actions`: general actions added here, each referencing a context via `Parent Context List`.
4. Component-provided actions (door, compartment): configure on the component (e.g. `DoorComponent.DoorAction`), link to context via `Parent Context List`.
5. One action can appear in multiple contexts by adding multiple entries to its `Parent Context List`.

**ScriptedUserAction methods:**
```c
class SCR_MyUserAction : ScriptedUserAction
{
    override void Init(IEntity pOwnerEntity, GenericComponent pManagerComponent) { }
    override bool CanBeShownScript(IEntity user) { return CanBePerformedScript(user); }
    override bool CanBePerformedScript(IEntity user) { return true; }
    override bool HasLocalEffectOnlyScript() { return true; } // client-local effect
    override void PerformAction(IEntity pOwnerEntity, IEntity pUserEntity) { }
}
```

Script file location: any subfolder of `Scripts/Game/`.

---

## Development Executables (Diag Builds)

Since v1.1.0. Diag and non-Diag executables are **completely incompatible** — a non-Diag client cannot connect to a Diag server and vice versa.

**Executable names**:
- `ArmaReforgerWorkbenchSteamDiag.exe`
- `ArmaReforgerSteamDiag.exe`
- `ArmaReforgerServerDiag.exe`

**What Diag provides**: Full Diag Menu and developer tools; Workbench can debug client/server (not just Workbench Game/Peer Tool).
