# World Editor — Tools, Plugins & WorldEditorAPI

---

## Shortcuts

| Shortcut | Function |
|---|---|
| Ctrl+N | New world / sub-scene |
| Ctrl+O | Load world |
| Ctrl+S | Save world |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+X / Ctrl+Shift+V | Copy / Cut / Paste (same position) |
| F5 | Play (arrow = play options) |
| X | Toggle Gizmo Space (World vs Object) |
| F10 | Esc equivalent |
| Q | Ground Manipulation Tool |
| W | Move Tool |
| E | Rotate Tool |
| R | Scale Tool |
| V | Vector Tool |
| Ctrl+T | Terrain Creation Tool |
| F / double-click in Hierarchy | Focus on selected entity |

Play options: Play in viewport, Play fullscreen, Play from camera position, Server localhost, Server localhost + PeerTool.
**Note:** "Server localhost" requires a real IP address, not 127.0.0.1.

---

## Viewport Camera

- Mouse wheel — move forward/back
- RMB held + mouse — look around
- RMB + scroll — change camera speed
- W/S — move along camera, A/D — strafe, Q/Z — move up/down

---

## Tools

### Ground Manipulation Tool (Q)
Moves selected objects to terrain/object/water surface.

Key settings: Snap horizontal (X/Z step in m), Snap vertical (Y step), Snap rotation (Y axis step), Snap separately, Rotate separately, Keep elevation of all, Place using physics.

### Rotate Tool (E)
- Ctrl held during rotation — temporarily enables snap angle.
- Alt+drag — duplicates and rotates the copy.
- Snap angle: free input or presets (1, 5, 10, 15, 20, 30, 45, 60°).
- Rotate separately: each entity on own axis vs. shared.
- **Pitfall**: "Transform children" + "rotate separately" checked means children rotate on own axis and lose relative position to parent.

### Vector Tool (V)
Draws polylines or splines (Bezier). Closed or open.

- Ctrl+LMB — add point after selected
- Alt+LMB — add point before selected
- Operations: Snap to terrain, Reset elevation, Split, Merge, Reverse, Delete, Subdivide, Select all
- Tangent mode: Mirror / Same orientation / Free
- Gizmo mode: 3D (all axes) or 2D flat (X-Z only)
- Anchor snap distance — snap dragged points to neighbours (required for road/powerline junctions)
- Generators accessible via right-click on a ShapeEntity

### Terrain Creation Tool (Ctrl+T)

**Height Map**: Supports `.asc` and 16-bit `.png`. Options: Invert X, Invert Z (both = 180° rotation), Resampling heights (PNG only). Bake Selection — permanently bakes entity terrain modifications into base height map.

**Sculpt controls:**
- Strength: 0–500; Shift+MouseUp/Down to adjust
- Radius: 0–200m; Ctrl+MouseUp/Down to adjust
- Falloff: 0–100; Ctrl+Shift+MouseUp/Down to adjust
- Brush shapes: Linear, Smooth, Sphere, Inv-Sphere
- Brush types: Round, Rect, User
- Sculpt (LMB raise, Alt+LMB lower), Flatten (Space picks height), Smooth, Noise

**Paint Tool:**
- Paints surface materials. **Limit: 5 surfaces per terrain block** (as of v0.9.5).
- First layer = default (cannot be removed).
- Ctrl+X in viewport to visualize painted layers.
- 3×3 grid: Green = free slot, Yellow = selected block, Red = 5-layer limit reached.

### Navmesh Tool
Requirements: World must have `AIWorld` entity with `NavmeshWorldComponent` pointing to a `.nmn` file.

Workflow:
1. Connect to navmesh generation server
2. Press Generate → configure Recast params and area → confirm
3. Enable "Autosave when done" OR manually click Save/Save As

**Pitfall:** If Autosave is not ticked and Save is not clicked, generated navmesh is lost.

### Prefab Management Tool
Batch operations: import XOBs into new prefabs, create children, clone.
- Key params: Addon, Overwrite Files, Suffixes 1-3, XOB Save Path, Parent Prefab, Create Base Prefab.

---

## Generators

General rule: generator must be a **direct child** of a Shape (polyline or spline) entity.

| Generator | Shape type |
|---|---|
| Road Generator | Spline only (polylines NOT supported) |
| Powerline Generator | Polyline or spline |
| Prefab Generator | Polyline or spline |
| Forest/Lake/Wall Generator | Polyline only |
| River Generator | Spline only |

### Road Generator
Hierarchy: `Shape → Road Generator Entity → Road Entity`

Key options: `Adjust Height Map` + Priority, Falloff Start Width, Road Falloff Width, Road Clearance, Road Width.

Road Entity: Width, V Scale (0.5 = 200% length, 2.0 = 50%), Force Full Length, Mid Piece Sequence.

Prefabs: `Data\Prefabs\WEGenerators\Roads`

### Powerline Generator
Hierarchy: `Shape → Powerline Generator Entity`

Pole types: Start, Default, End, Junction.
Options: Distance between poles, Random Pitch/Roll Angle, Random on Both Sides, Apply to Start/End poles, Clearance, Rotate 180° Start/End.

**Junction workflow:**
1. Main polyline needs ≥ 3 points. Set Junction Data class on anchor point.
2. Draw secondary polyline. Enable "Snap to anchors", set Anchor snap distance ≥ 1.
3. Drag secondary end to snap to main anchor point.

Prefabs: `Data\Prefabs\WEGenerators\Powerline`

### Prefab Generator
Entities along a shape. Prefabs in `ArmaReforger > Prefabs > WEGenerators` (mostly `Bushline/`), prefix `PG_`.

Options: Prefab Names + Weights, Distance, Align With Shape, Offset Right/Variance/Gap, Random Spacing, Perlin distribution (Dens, Threshold, Size, Frequency, Seed, Amplitude, Offset).

---

## WorldEditorAPI

### Access (never store as class-level field)
```c
// Always as local variable:
WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
WorldEditorAPI api = worldEditor.GetApi();

// Helper:
WorldEditorAPI api = SCR_WorldEditorToolHelper.GetWorldEditorAPI();

// Inside WorldEditorTool: use m_API directly
// Inside GenericEntity: _WB_GetEditorAPI()
```

**Pitfall:** Storing `WorldEditorAPI` as a class-level member → after script reload, reference is not nulled and points to invalid memory.

### Always wrap edits in Begin/EndEntityAction
```c
api.BeginEntityAction("My Operation");
// ...edits...
api.EndEntityAction();
```
Missing this triggers a VME. Actions within the block = single undo/redo step.

### Setting Values (all as strings)
```c
// bool
api.SetVariableValue(src, null, "m_bFlag", boolValue.ToString(true)); // → "1"/"0"
// float
api.SetVariableValue(src, null, "m_fVal", fValue.ToString());
// vector
api.SetVariableValue(src, null, "m_vPos", vValue.ToString(false)); // → "x y z"
// string — pass directly
api.SetVariableValue(src, null, "m_sName", myString);
```

### Sub-object / Array paths
```c
// Direct sub-object
array<ref ContainerIdPathEntry> path = { new ContainerIdPathEntry("m_SubObject") };

// Array element index 3
array<ref ContainerIdPathEntry> path = { new ContainerIdPathEntry("m_aItems", 3) };

// Component (first)
array<ref ContainerIdPathEntry> path = { new ContainerIdPathEntry("components", 0) };

api.SetVariableValue(src, path, "m_iValue", "42");
```

### Key API Methods
```c
api.SetVariableValue(entitySource, path, name, value)
api.ClearVariableValue(entitySource, path, name)
api.CreateObjectVariableMember(entitySource, path, name, className)
api.CreateObjectArrayVariableMember(entitySource, path, arrayName, className, index)
api.RemoveObjectArrayVariableMember(entitySource, path, arrayName, index)
api.SaveEntityTemplate(entitySource)
api.DeleteEntity(entitySource)           // takes IEntitySource, NOT IEntity
api.GetSelectedEntitiesCount() / GetSelectedEntity(i)
api.SetEntityVisible(entitySource, bool)
api.EntityToSource(IEntity)              // get IEntitySource from live entity
```

**Pitfall:** `BaseContainer.Set*` is in-memory only — does NOT persist to prefab. Use `WorldEditorAPI` methods for all prefab editing.

---

## Workbench Plugin System

### Plugin vs Tool
- **Plugin**: runs on menu click or shortcut; no side panel; supports `Run()`, `RunCommandLine()`, `Configure()`.
- **Tool**: persistent side panel (Current Tool tab); World Editor only; inherits `WorldEditorTool`; no shortcut.

### WorkbenchPluginAttribute
```c
[WorkbenchPluginAttribute(
    name: "My Plugin",
    description: "...",
    shortcut: "Ctrl+Shift+I",
    wbModules: { "WorldEditor" },   // empty = all modules
    category: "MyCategory",
    awesomeFontCode: 0xF0C5
)]
class TAG_MyPlugin : WorldEditorPlugin
{
    override void Run() { }         // must be non-empty or plugin hidden from menu
    override void Configure() { }  // must be non-empty or entry hidden from Settings
}
```

### CLI Usage
```
ArmaReforgerWorkbenchSteam.exe -wbmodule=ResourceManager -plugin=MyPlugin -myParam="value" -autoclose=1
```

### Plugin Directory
`Data\Scripts\WorkbenchGame\` — sub-directories by editor module.

### External Process
```c
Workbench.RunCmd(string command, bool wait = false);  // run OS command
ProcessHandle handle = Workbench.RunProcess(string command);
Workbench.KillProcess(handle);
```

### WorldEditorTool-specific
```c
// m_API — direct WorldEditorAPI access
GetModifierKeyState(ModifierKey.CONTROL)
UpdatePropertyPanel()
GetCursorWorldPosition(x, y, out pos)
// Override hooks:
OnActivate() / OnDeActivate()
OnMouseMoveEvent() / OnKeyPressEvent() / OnMouseDoubleClickEvent() / OnWheelEvent()
```

---

## Workbench Metadata (.meta files)

- Created for every registered resource (non-script).
- Contains: GUID, original file path, build configuration (import settings).
- GUID based on file path+name as seed — same path+name always produces same GUID on first generation.
- Moving/renaming within Workbench auto-renames the `.meta` file.

### GUID Conflicts
- Same GUID in different addons → files overwrite each other.
- Same GUID within one addon → warning, one file broken.
- **Never change GUIDs without backing up first.**

---

## Workbench Links

Register `enfusion://` protocol in Resource Manager Options first.

Formats:
```
enfusion://ResourceManager/~AddonId:path/to/file
enfusion://ScriptEditor/scripts/path/file.c;lineNumber
enfusion://WorldEditor/worlds/path/world.ent;x,y,z;rx,ry,0;entityID
```

For platforms that don't support `enfusion://` (e.g. Discord):
```
https://enfusionengine.com/api/redirect?to=enfusion://...
```

---

## Arma 3 → Workbench Equivalents

| Arma 3 | Workbench |
|---|---|
| Addon Builder / Binarize | Resource Manager: Pack Project |
| ImageToPAA | Resource Manager: Import (image) |
| FBX to RTM | Animation Editor |
| Object Builder | External Editor + Resource Manager / World Editor |
| Terrain Builder | World Editor |
| FSM Editor | Behavior Editor |
| Publisher | Resource Manager: Publish Project |
| TexView 2 | Resource Manager: Image Viewport |

---

## Pitfalls

- **WorldEditorAPI as class-level member**: Never. Points to invalid memory after script reload.
- **BaseContainer.Set* does not persist**: Use WorldEditorAPI methods for all prefab editing.
- **Missing BeginEntityAction/EndEntityAction**: Triggers VME, breaks undo.
- **Road Generator requires spline**: Polylines are not supported.
- **Navmesh not saved if Autosave unchecked**: Generated data is lost.
- **5 surface layer limit per terrain block**: Exceeded = Red in 3×3 diagnostics.
- **GUID conflicts**: Same GUID in two addons causes overwrite. Never duplicate meta files.
- **Plugin Run() must be non-empty**: Empty/not overridden = plugin invisible in menu.
- **Tools cannot be launched via CLI**: Only plugins support `-plugin=` CLI parameter.
- **String Editor `wbModules`**: Must be `"LocalizationEditor"`, not `"StringEditor"`.
- **Server localhost**: Requires real IP, not 127.0.0.1.
