# Resource Manager & Enfusion Blender Tools

---

## Resource Manager Overview

Main hub of the Enfusion Workbench. Sections:
1. **Resource Browser** — browse base game + mod resources
2. **Main Window** — tabs for opened resources (Welcome tab when empty)
3. **Log Console** — live logs (toggle: F1)
4. **Window Menu** — access all editors, plugins, options

Backend label (bottom-right): Production = Stable, Submission = Experimental.

---

## Resource Manager Shortcuts

| Shortcut | Function |
|---|---|
| Ctrl+S | Save active tab |
| Ctrl+Shift+S | Save all |
| F5 | Reimport active resource |
| Ctrl+B | Locate active resource in Resource Browser |
| F1 | Toggle Log Console |
| F3 | Toggle Resource Browser window |
| Ctrl+PageUp/Down | Next/Prev tab |
| Ctrl+Tab | Cycle tabs |
| Ctrl+W | Close active tab |
| Ctrl+Shift+R | Reload WB Scripts |
| Ctrl+Shift+E | Edit Selected Prefab(s) |
| Ctrl+Alt+L | Create/Update Selected Editable Prefabs |

---

## Resource Browser

### Search Syntax
- Space-separated keywords search filename
- Search by GUID directly (e.g. `A1F2619C082CFDDF`)
- `#tag` — filter by tag
- `!word` — exclude from results
- Filter by category (File Types), sort by Name/Size/Type/Date

### Context Menu (File)
- **Register** — create .meta file
- **Register and Import** → as Model → creates .xob
- **Reimport** — re-converts source (tiff/fbx) to Enfusion format
- **Override in...** / **Inherit in...** / **Duplicate to...** / **Transfer to...**
- **Copy Resource Name(s)** — `{GUID}path/to/file.ext` format
- **Copy Resource GUID(s)** — GUID only
- **Copy File Path(s)** — absolute OS path
- **Copy Link** — `enfusion://` link
- **Find References** — expensive search through all project files
- **Edit Prefab(s)** — opens in World Editor prefab edit mode

### First Launch
1. Start Arma Reforger Tools in Steam → Resource Manager opens
2. Click **Add Existing** in Projects popup → target `ArmaReforger.gproj` at `<install>\addons\data`
3. Register `enfusion://` protocol: Workbench → Options → Workbench tab → Register enfusion:// protocol

---

## Import Settings (Model / .xob)

| Setting | Effect |
|---|---|
| **Merge Meshes** | Merges visual meshes per LOD with same material (optimization) |
| **Export Skinning** | Load skinning data (max 4 bones per vertex) |
| **Export Scene Hierarchy** | Load bones/dummies as sockets/snap points |
| **Modify Material Names** | Replace `_` → `/` in material names on import |
| **Legacy Support** | Old import pipeline — do NOT use on new assets |
| **Remove LODs** | Remove from lowest LOD up |
| **No Optimize** | Skip topology optimization |
| **Merge Tri Meshes** | Merge UTMs with same Layer Preset |
| **Geometry Params** | Layer Preset, Surface Properties, Mass, Margin per collider |
| **COM Autocenter** | Auto-center of mass to volume center |

**Critical pitfall:** To change Game Material or Layer Preset on colliders after initial import, you MUST first reset **Geometry Params** to default (right-click → Reset to default, or arrow button), then click Reimport.

---

## Texture Import Settings

| Setting | Notes |
|---|---|
| Target Format | EnfusionDDS / DirectXDDS |
| Conversion | None / DXTCompression / Alpha8 / Red / RedGreen / Color / HDR variants |
| Remove Mips | Remove N large mipmaps |
| Max Size | Limit dimensions (powers of 2, up to 16384) |
| Color Space | ToLinear / ToSRGB |
| Mip Map Function | Filter / Normalize / ColorNoise / FoliageAlpha1-5 |
| Mip Map Filter | Box / Triangle / Kaiser |
| Generate Cubemap | Equirectangular → cubemap |

---

## Batch Plugins

### Batch Resource Processor
Menu: Plugins → Batch resource processor
- Reprocesses resources matching filters; fixes Prefab/MeshObject/Sound/ParticleEffect meta files
- Parameters: File Types, Path Starts With, Path Contains, Path Ends With
- Options: Fix Meta File, Force Resave Meta File, Report Missing Meta/Configs, Fix Custom Property Values

**CLI usage:**
```
ArmaReforgerWorkbenchSteam.exe -wbModule=ResourceManager -plugin=ResourceProcessorTool -FileTypes="xob,edds" -PathStartsWith="$ArmaReforger:Assets/..."
```

### Re-Save Meta Tool / Re-Save Tool
Menu: Plugins → Re-Save Meta Tool / Re-Save Tool
- Re-save `.meta` or resource files matching given extensions
- Useful when a format changes and all files must be updated
- Extensions provided without dot (e.g. `layout` not `.layout`)

---

## FBX Import Rules

### Naming Conventions
- No spaces or special chars in object/material names (`/\<>:"|?*#` → converted to `_`)
- Blender duplicate names add `.001` suffix → dot stripped on import (e.g. `Material.001` → `Material`) — causes mismatches
- Use unique names for all objects

### Alignment
Assets must point along **Z+ axis** in Enfusion (Y+ in Blender/Max/Maya):
- Weapons: barrel along Z+
- Vehicles: nose pointing Z+
- Buildings: main entrance pointing Z+
- Walls: from origin along X+ (not centered)

### LOD Suffix Convention
- Suffix `_LODx` (case-insensitive): `Car_LOD0`, `Wheel_LOD0`
- Multiple meshes per LOD allowed (all with same `_LODx`)
- No recognized suffix → goes to LOD0
- Missing LOD levels are collapsed (LOD2 without LOD1 behaves as LOD1)

### Collider Prefixes
| Prefix | Shape |
|---|---|
| `UBX_` | Box |
| `UCX_` | Convex |
| `USP_` | Sphere |
| `UCS_` | Capsule |
| `UCL_` | Cylinder |
| `UTM_` | Trimesh |

**Collider rules:**
- Origin of UCL/UCS/USP must be at geometry center (Set Origin → Origin to Geometry in Blender)
- Apply Rotation & Scale (not Location) before export in Blender
- Max 65535 verts/faces per collider
- Static colliders must have no parent; only animated parts are children of bones
- Trimesh: closed mesh, uniform triangles, as few as possible
- Multiple materials per trimesh face allowed; primitives/convex = one material only
- `Merge Tri Meshes` must be ON to merge UTMs with same Layer Preset

### Collider Hierarchy Rule
- Static colliders (always move with root): **no parent**
- Animated parts: children of corresponding bones only

### Special Object Prefixes
| Prefix | Purpose |
|---|---|
| `COM_` | Center of mass dummy (first found wins) |
| `OCC_` | Occluder plane/box |
| `BOXVOL_n` | Box probe volume |
| `SPHVOL_n` | Sphere probe volume (still use box shape!) |
| `BSP_xxx` | BSP geometry (building room connectivity) |
| `PRT_n` | Portal plane (4-vertex, no triangulation) |
| `PRTVOL_m` | Portal volume (clipping) |
| `LC_` | Land Contact (min 2 required for ground snapping) |

### Game Material Assignment
- Material name format: `MaterialName_MaterialGUID` (e.g. `Weapon_metal_3B2D2687F56BB4EF`)
- GUID from: right-click gamemat → Get Resource GUID(s)

### FBX Export Settings (Blender)
- Object Types: check Mesh, Empty, Armature
- Enable **Custom Properties** (required for Layer Presets)
- Enable **Export Scene Hierarchy** (required for sockets/dummies)
- Disable **Leaf Bones**
- Apply transforms (Rotation & Scale, not Location) before export
- FBX format: Binary, version FBX 2014/2015 (7.4)

### Import Process
1. Resource Browser → right-click FBX → Register and Import → as Model
2. Set Import Settings, click Import Resource (or Reimport from context menu)
3. Materials and .meta files auto-created beside FBX using material names from FBX
4. Verify skeleton in Bones section if skinning was imported

---

## Probes & Portals (Buildings)

### Probe Volumes
- `BOXVOL_n` / `SPHVOL_n` — interior lighting probe volumes
- Assign material `dummyvolume`
- After import: re-link dummyvolume.emat to `/Common/Materials/dummyvolume.emat`
- Probe entity in prefab: inherit from `ProbeHouse_Base.et`, `ProbeExterior_Base.et`, or `ProbeEnvCave_base.et`

### Portals
- Plane primitive, 4 vertices, no triangulation
- Normal facing inward
- Size slightly larger than actual opening
- Position in middle of window/door geometry
- Material class: `MatLightPortal`
- Naming: `PRT_n`

### BSP Geometry
- Simple mesh representing rooms (walls/ceilings with door/window openings)
- Naming: `BSP_xxx`
- Material: `dummyvolume`
- Enable **Generate BSP** in import settings before reimporting

---

## Enfusion Blender Tools (EBT)

Blender 4.2 LTS only (3.6 LTS no longer supported).

### Installation
1. Download Arma Reforger Tools from Steam
2. Install `Arma Reforger Tools\Blender\EnfusionBlenderTools-Plugin.zip` as Blender addon (do NOT unzip)
3. In Workbench → Options → Workbench settings: enable **Enable net API**
4. For TXA export: unzip `EnfusionBlenderTools-Data.zip` and set Export Profile Folder in addon prefs

**Update procedure:** Remove old addon in Blender Preferences, close Blender, reopen, reinstall. Must fully restart to avoid residual in-memory bits.

### Features
**Import:** ASC elevation, P3D (Arma 3), FBX with Enfusion Shaders, Prefab (.et) models
**Export:** ASC elevation, TXA animation, FBX (single or batch)
**Misc:** Model Quality Assurance, NLA Strips Baking, Rig Updater, Portal Tools

### Object Tools — Sort Objects
Auto-sorts objects into collections mirroring Workbench structure:

| Prefix/Suffix | Collection |
|---|---|
| `UCL_`, `UCX_`, `UBX_`, `UTM_`, `USP_`, `UCS_`, `COM_`, `LC_` | Colliders |
| `PRT_`, `Light` | Portals |
| `BOXVOL_` | Volumetric Boxes |
| `OCC_` | Occluders |
| `SOCKET_` | Memory Points |
| `_LODxx` | LODx |

Options: Fold collections, Hide collections (all except LOD0), Separate by materials.

### Collider Setup (EBT)
- Select objects in Colliders collection → use Collider Setup button
- Object Mode: applies material to whole object, can change Layer Preset
- Edit Mode: assign different game materials per face
- Note: game materials ending in `_base` are hidden from menu

### Model Quality Assurance
Checks for common configuration and topology errors. Run before export.

---

---

## Resource Manager Options (Workbench > Options)

**Project settings:** ID, GUID, Title, Dependencies (GUIDs), Engine/Game settings paths.

**Dependency rules (critical):**
- Any mod requires `ArmaReforger` as dependency; `ArmaReforger` implies `core` — do not list both.
- **NEVER** clear a dependency by emptying the text field — engine treats empty string as blank GUID → fails to load. Use the **minus (-)** button to remove.
- After adding dependencies: restart Workbench.
- Broken/missing dependency: manually edit `.gproj` in a text editor.

**Workbench tab settings:**
- `Enable net API` — mandatory for EBT communication
- `Register "enfusion://" protocol` — enables wiki enfusion:// links
- `Auto-rebuild scripts` — triggers rebuild on Script Editor save (otherwise Ctrl+Shift+R)
- `FPS limit` — set to screen refresh rate (60/144 Hz)
- `Use SVN integration` — requires SVN CLI tools + restart

---

## RM Config Editor

- Non-default values are **bolded**; reset arrow appears to right.
- Arrays: +/- buttons; right-click for move/duplicate options.
- Drag a config onto a field to fill it with that config's values.
- `.conf` button on a field opens sub-config in its own tab — changes propagate.
- Create inherited config: right-click config in Resource Browser > "Create Inherited File".

---

## RM Layout Editor

- Root size: minimum officially supported resolution 1920×1080.
- Live Preview: test different resolutions and languages.
- Hierarchy panel: lists all widgets, searchable, rename by double-click.
- **Convert into / Wrap into** — change widget type or re-parent while keeping children.
- "Show only modified properties" hides defaults.
- Save as prefab / Open prefab available in context menu.
- Widget events: OnMouseEnter/Leave/ButtonDown/ButtonUp, OnKeyDown/Up, OnDrag/Drop, OnResize, OnFocus, OnUpdate, OnModalResult, etc.

---

## RM Imageset Editor

- An imageset packs multiple sub-images on one texture (memory/load efficiency).
- Quads define sub-image regions by X, Y, W, H (pixels, top-left origin).
- Add 3×3 preset: creates nine 30×30 named quads (LeftTop, Top, RightTop, etc.).

---

## Additional RM Plugins

### Batch Texture Processor
Checks: Missing Meta File, Configurations (class correctness), Ancestors, Unnecessary PC settings, Suspicious non-PC settings, Wrong property values. Reimport Changed option.

### Find Linked Resources
Reads selected resources and outputs all resources they reference. Filter by extension (e.g. `et,edds,xob`). Very slow on large selections.

### Data To Spreadsheet
Exports prefab/config parameters to clipboard (paste to spreadsheet). Imports from clipboard.
- Config-driven via `SCR_DataToSpreadsheetTemplates`.
- Element types: `Attribute` (by name), `Component` (by class), `Object` (by name), `ObjectIndex` (array index), `ObjectArray` (retrieve array).
- Use "Copy property path" in Workbench to get engine-internal names (UI names are beautified).
- Child components not found via `Component` type — use `ObjectArray` + `Object` instead.

### Generate Class From Layout
Generates EnforceScript class with member variables and widget-finder code from a `.layout`.
- Layout must be open in focused tab; must have `SCR_WidgetExportRuleRoot`.
- Exported widget names must be prefixed with `m_` (convention: `m_w`).

---

## EBT Advanced Workflows

### Batch FBX Export
- Right-click collections in Blender Outliner → each collection exports as separate FBX named by collection.
- "Only Visible": if unchecked, exports all regardless of visibility; collection visibility overrides object visibility.

### TXA Animation Export
- TXA (text) → compiled by Workbench to ANM (binary runtime).
- Prerequisites: Armature + Action, Export Profile Folder configured, Workbench net API enabled.
- Per-action: set Export Profile (must match skeleton), output filename, optional Diff Pose for additive animations.
- Actions marked as Blender Assets are hidden from export list.
- Auto-registers TXA if save location is within a loaded Workbench addon. Symbolic links require manual registration.
- **Troubleshooting:** "TXA registration failed (Unable to translate to relative path)" → save location is outside loaded projects, or symbolic links used. Disable relative path for different-drive saves.

### Materials Library
- Setup: Blender > Preferences > File Paths > Asset Libraries → add `EnfusionBlenderTools\data`.
- Import Method must be **Append**.
- Drag materials from Asset Browser onto meshes in Object Mode only.
- Rename material from shader class name to meaningful name (e.g. `MatPBRBasic` → `Bricks`).

### Materials Preview (MP)
Supports: MatPBRBasic, MatPBRMulti, MatPBRDecal, MatPBRBasicGlass.
- Export material (.emat) via Export FBX (registers new materials, skips already-registered).
- Materials land in `Data/` next to FBX.
- Materials Synchronisation: "Update Materials" button syncs Workbench changes back to Blender.
- **Pitfall:** Do NOT manually edit texture slot text fields. Only set textures that have a .meta file.
- Cannot import materials from vanilla Reforger or read-only mods.

### Model Quality Assurance (MQA)
Runs in Object Mode on selected mesh objects. Results go to Blender Info Log (hover Info editor to refresh).
- **Convention checks:** Valid prefixes/suffixes, reports `.000`/`.001` duplicates (skipped by Workbench).
- **Collider checks:** `usage` property missing/empty/invalid.
- **Mesh checks:** Short edges, small faces, UCX non-manifold/non-planar/non-convex, UVs outside <-32, 32> range, non-unwrapped faces.

### MLOD Baking
1. Import source model with EBT importer.
2. Select LOD0 and MLOD target.
3. Remove existing MLOD material; add image texture (empty texture node).
4. Cycles engine, Bake type: Diffuse, Contributions: Color only.
5. Enable Selected to Active; set Extrusion to cover LOD0/MLOD difference.
6. MLOD must be active (yellow); save result as **TIFF with LZW compression**.

### NLA Strips Baking
- Select NLA Track via NLA Tracks Fetcher → press Bake NLA Strips.
- Each strip bakes to new action named `<strip name> Baked`.

### Portal Tools (automated)
- Auto-generates PRT_ and PRTVOL_ for structures.
- Prerequisites: collider with FireView/FireGeo, door/window sockets, Workbench net API.
- Portal material auto-assigned by size; non-standard openings need manual correction in Workbench.
- PRTVOL: select 2+ portals → Generate PRTVOL → box with Geometry Nodes auto-resizes → press Apply PRTVOL (assigns dummyvolume, moves to "Light Portals" collection).

### P3D Conversion (Arma 3 → Enfusion)
- Only MLOD (unbinarized) P3Ds; ODOL (binarized) cannot be imported.
- Requires Workbench net API (addon ≥ 0.9.7).
- Auto-renames: resolution LODs → `_LOD0–_LOD15`; geometry → `UTM_` prefix.
- Max 16 resolution LODs; visuals above that are discarded.
- Batch: `convertToFBX.bat` (configure Blender exe path in the file before use).

### Rig Updater
- Replaces character rig with newer version from provided `.blend` file.
- Source: `Character_AnimationRig_RigUpdater.blend` from BI Arma-Reforger-Samples GitHub.
- Restores: all NLA tracks, bone constraints, constraints on non-rig objects pointing to old rig.
- Deletes and replaces: LOD0, Rig, Reference, IK Targets, Extra collections. Always back up first.

---

## Pitfalls

- **Material name with special chars**: `/\<>:"|?*#` → converted to `_`; dot (`.`) → stripped (Blender `.001` duplicates). Both break EBT material matching.
- **Geometry Params not reset**: Changed game material/Layer Preset ignored on reimport until Geometry Params reset.
- **Legacy Support**: Must not be used on new assets.
- **SPHVOL must be box shape in FBX**: Engine cannot read actual sphere mesh transforms; always create as box.
- **BSP debugging options**: Force create portals, Export opaque leaves, BSP occupancy/connectivity/geometry — for debugging only; uncheck before publishing.
- **Occluder rules**: Must be aligned with one axis, min ~4-5m, max 3-4 per building, no triangulation. Boxes <30cm become planes.
- **Portal position**: Must be in middle of opening, not aligned with wall surface — degenerate cases result otherwise.
- **EBT update**: Must fully remove old addon and restart Blender; partial installs leave residual memory that breaks new install.
- **FBX Blender duplicate names**: Dots stripped on import — use unique names.
- **Center of mass**: If no `COM_` dummy present, engine places it at 0,0,0.
