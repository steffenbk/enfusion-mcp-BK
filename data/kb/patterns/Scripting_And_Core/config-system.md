# Config System, BaseContainer & Prefab Data

---

## Config Classes

### `[BaseContainerProps]` Decorator
Required on any class that should appear in Config Editor or be selectable as root of a `.conf` file.
- Child classes inheriting a decorated class must also be decorated.
- `configRoot: true` — makes the class selectable as config file root.
- Other params: `category`, `description`, `color` (RGBA 0-255), `visible`, `insertable`, `icon`, `namingConvention`.
- `namingConvention` values:
  - `NC_MUST_HAVE_GUID` (default): Workbench auto-generates GUID; display name = classname.
  - `NC_MUST_HAVE_NAME`: Forces user-entered name on creation; that name is displayed.

```c
[BaseContainerProps(configRoot: true)]
class TAG_SuperConfig
{
    [Attribute(defvalue: "DEFAULT", category: "Personal Details")]
    string m_sName;

    [Attribute(defvalue: "100", params: "1 500", category: "Damage")]
    int m_iTotalHealth;
}
```

### `[Attribute]` Decorator
Required on member variables for them to appear in Config Editor.
- Minimum: `[Attribute()]`
- Display name auto-derived: `m_iMyVariable` → strips `m_`, strips type prefix `i`, splits on capitals → "My Variable".

| Parameter | Notes |
|---|---|
| `defvalue` | Always a string: `"0"`/`"1"` for bool, `"0 0 0"` for vector. Cannot default objects or arrays. |
| `uiwidget` | Force specific widget (auto-selected if omitted). |
| `desc` | Tooltip shown on hover. |
| `params` | UI-specific: arrays `"MaxSize=10"`, numbers `"min max step"`, curves `"rangeX rangeY offsetX offsetY"`, vectors `"min max step purpose=coords space=entity"`, resource `"dds edds conf class=TAG_MyClass"`. |
| `enums` | `ParamEnumArray` for ComboBox/Flags: `{ ParamEnum("Text", "Value"), ... }` |
| `category` | Groups properties in World Editor plugins. |
| `precision` | Decimal precision for floats. |

Notable widget types: `ColorPicker`, `ResourceNamePicker`, `ResourcePickerThumbnail`, `Slider`, `Flags` (power-of-two enum), `GraphDialog`, `Callback`, `ComboBox`, `Checkbox`.

`Callback` widget requires `[CallbackMethod()]` decorator + signature `void Method(Managed eventParams)`.

### Using a `.conf` File in an Entity

**ResourceName approach** (allows default value, no live preview):
```c
[Attribute(defvalue: "{GUID}Configs/MyConfig.conf", params: "conf class=SCR_MyConfigClass")]
protected ResourceName m_sConfig;

SCR_MyConfigClass LoadConfig()
{
    if (m_sConfig.IsEmpty()) return null;
    Resource resource = Resource.Load(m_sConfig);
    if (!resource.IsValid()) return null;
    return SCR_MyConfigClass.Cast(
        BaseContainerTools.CreateInstanceFromContainer(resource.GetResource().ToBaseContainer()));
}
```

**Object approach** (inline creation, drag-drop supported; no default value):
```c
[Attribute()]
protected ref SCR_MyConfigClass m_Config;
```

---

## BaseContainer

### What Is a BaseContainer
- Generic data holder for: Prefabs (`.et`), Configs (`.conf`), `IEntitySource`, `IEntityComponentSource`, `WidgetSource`, `UserSettings`, `MetaFile`.
- Has a class name and property values. Inherits unset properties from ancestor BaseContainers.
- **Cannot be `ref`-held in script** — engine manages lifetime. The owning `Resource` must be kept alive.

### Creating / Reading / Writing / Saving
```c
// Create
Resource resource = BaseContainerTools.CreateContainer("GenericEntity");
BaseContainer bc = resource.GetResource().ToBaseContainer();

// Read
int value;
if (bc.Get("m_iValue", value)) Print("OK");

// Write (property must already exist in the class)
if (bc.Set("m_iValue", 42)) Print("OK");

// Save to resource path or absolute path
BaseContainerTools.SaveContainer(bc, resourceName);
BaseContainerTools.SaveContainer(bc, ResourceName.Empty, absolutePath);
```

### WorldEditorAPI — Setting Values on IEntitySource
**IEntitySource MUST be edited via WorldEditorAPI** — direct `Set()` calls are in-memory only and lost on save.
```c
// Root-level variable
worldEditorAPI.SetVariableValue(entitySource, null, "m_iValue", "42");

// Nested path
array<ref ContainerIdPathEntry> path = { new ContainerIdPathEntry("m_SubObject") };
worldEditorAPI.SetVariableValue(entitySource, path, "m_iValue", "42");

// Component variable
array<ref ContainerIdPathEntry> path = { new ContainerIdPathEntry("Components") };
worldEditorAPI.SetVariableValue(entitySource, path, "m_iValue", "42");
```

### Iterating BaseContainerList
```c
for (int i, count = baseContainerList.Count(); i < count; ++i)
{
    BaseContainer bc = baseContainerList.Get(i);
}
```

### Utility Classes
- `BaseContainerTools` (engine): `CreateContainer`, `SaveContainer`, `CreateInstanceFromContainer`.
- `SCR_BaseContainerTools` (script): `CreateInstanceFromPrefab`, etc.
- `SCR_ConfigHelperT<T>.GetConfigObject(...)` — typed config loading helper.

---

## Prefab Data (Shared Instance Data)

Variables shared across all prefab instances go in the `*Class` companion class. Accessed at runtime via `GetPrefabData()` (entity) or `GetComponentData()` (component).

```c
class SCR_AIGroupClass : ChimeraAIGroupClass
{
    [Attribute("42")]
    int m_iValue;
}

class SCR_AIGroup : ChimeraAIGroup
{
    int GetValue()
    {
        SCR_AIGroupClass prefabData = SCR_AIGroupClass.Cast(GetPrefabData());
        if (!prefabData) return -1;
        return prefabData.m_iValue;
    }
}
```

- Use when: 100+ instances with multiple shared variables.
- Cache as member if accessed every frame — `GetPrefabData()` + cast is not free.
- Skip when: few instances, or variables accessed every frame on many instances.

### Prefab Inheritance Rules
- Every property level can override a value. Unset values read from ancestors.
- Bold property names in editor = overridden value.
- Prefab Edit Mode loads empty terrain — save the world first. `Ctrl+S` saves prefab only.
- Cannot remove elements from an overridden prefab/config — only additions and value changes allowed.

### Data Modding Modes

| Action | GUID | Behavior |
|---|---|---|
| Override | Same as original | Selectively modifies; cannot remove elements |
| Replacement | Same as original | Fully replaces binary assets |
| Duplicate | New GUID | Copy; changes don't affect original |
| Inherit | New GUID | Child inherits all; can add overrides |

- Prefabs/configs/layouts **cannot be fully replaced** — always override mode.
- Script files replaced when same relative path + filename appears in another addon. Requires `modded` keyword.
- Engine cares only about GUID for replacement — filename/path need not match.

---

## File Types Reference

| Extension | Type |
|---|---|
| `.c` | Enforce Script source |
| `.conf` | Generic config |
| `.et` | Entity prefab |
| `.ct` | Component prefab |
| `.emat` | Material definition |
| `.edds` | Enfusion DDS texture |
| `.layout` | UI layout |
| `.bt` | Behavior tree |
| `.anm` | Binary animation |
| `.agf` / `.agr` | Animation graph file / root |
| `.acp` / `.sig` | Audio component / signal |
| `.st` | String table (localization) |
| `.xob` | Binary 3D model |
| `.ptc` | Particle system |
| `.ent` | World scene |
| `.layer` | World layer |
| `.meta` | Asset metadata + GUID |

### Key Directory Structure
```
AI/              — Behavior trees, AI config
Anims/           — Animations
Assets/          — All game assets
Common/          — Shared textures, particles, physics materials
Configs/         — Config files
Language/        — Localization string tables
Missions/        — Scenario configurations
Prefabs/         — Entity/component prefabs
PrefabsEditable/ — Prefabs available in in-game editor (Auto/ is auto-generated — do not edit)
Scripts/
  Game/          — Common scripts
  GameCode/      — Main game-specific
  Workbench/     — Common editor plugins
  WorkbenchGame/ — Project-specific editor plugins
Sounds/          — Audio samples and config
UI/              — Layouts, fonts, imagesets
Worlds/          — World files, terrains
```

---

## Pitfalls

- **Resource ref loss**: Returning `BaseContainer` from a function where `Resource` was local → instant null. Hold the `Resource` in the caller or in a `ref` array.
- **`BaseContainer` cannot be `ref`-held**: `ref BaseContainer m_bc;` is illegal. Only `Resource` can be held.
- **IEntitySource edits via direct `Set()`**: In-memory only, lost on save. Use `worldEditorAPI.SetVariableValue()`.
- **JsonApiStruct child objects must be pre-allocated**: If registered child is null during expand, it is silently skipped. Allocate in constructor before `RegV()`.
- **Script replacement requires exact relative path + filename**: Use `modded` keyword for class modification.
- **`PrefabsEditable/Auto/`**: Auto-generated — do not edit manually.
