# Prop Creation Workflow

---

## FBX Preparation (Blender)

1. Separate modular sub-parts into their own FBX files.
2. Add sockets (Blender Empty → Plain Axis) with correct position/orientation for snap points (e.g., `snap_wing`, `snap_lid`).
3. For animated parts: add Armature, skin bones. Orient bones correctly (rotation/position = origin of animation, not two-vertex axis like RV engine).
4. Colliders:
   - `UBX_` prefix = box collider
   - `UCX_` prefix = convex mesh
   - `UTM_` prefix = trimesh
   - Assign Layer Preset via custom property (e.g., `PropFireView`).
   - Assign game material name (e.g., `Plastic_6mm`).
   - Use Enfusion Blender Tools for automation.

### FBX Export Settings (Blender)
- Object types: check Empty, Armature, Mesh.
- Enable **Custom Properties** — required for Layer Presets.
- Enable **Export Scene Hierarchy** — required for sockets.
- Disable Leaf Bones.

---

## Import in Workbench

1. Resource Browser → right-click FBX → Register and Import → "as Model" → produces `.xob`.
2. Import Settings:
   - Enable **Export Skinning** for animated meshes.
   - Check **Reimport resource** after changes.
3. Layer Preset and Game Material changes from FBX are only re-imported if `Geometry Params` list is **empty**.

---

## Prefab Setup

- Base prefabs: `Props_Base.et` (non-destructible) or `Destructible_Props_Base.et`.
- Assign XOB to `MeshObject.Object`.
- Texture variants: create child prefabs, swap `MeshObject.Materials` array per variant.

---

## Pitfalls

- Relative material paths are deprecated — do not use.
- **Colliders with "All interaction layers used" error** → Layer Preset not assigned or Custom Properties not exported.
- **Missing game material** → check material name matches exactly (including hash suffix format).
- Not using `Props_Base.et` requires manual collision setup including enabling `Model Geometry` on `RigidBody`.
- Sockets lost → forgot to enable `Export Scene Hierarchy` in FBX import settings.
- Skinning lost → forgot to enable `Export Skinning` in import settings + Reimport.
