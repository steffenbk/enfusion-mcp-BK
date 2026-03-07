# Weapon Components & Attachments

---

## Required Component Stack (weapon prefab)

| Component | Role |
|---|---|
| `MeshObject` | Weapon model |
| `RigidBody` | Layer Preset empty, enable Model Geometry |
| `Hierarchy` | Required by RplComponent |
| `SignalsManagerComponent` | Animation/sound/particle bindings |
| `RplComponent` | Network replication |
| `ActionsManagerComponent` | Pickup, custom actions |
| `WeaponSoundComponent` | Audio project assignments, sound points |
| `SCR_WeaponStatsManagerComponent` | Allows stat modification by attachments |
| `SCR_WeaponAttachmentsStorageComponent` | Inventory/slot attributes |

---

## MuzzleComponent

Child of `WeaponComponent`. Defines firing behaviour.

| Property | Notes |
|---|---|
| `MagazineWell` | Class determines magazine compatibility |
| `MagazineTemplate` | Default mag prefab |
| `MagazinePosition` | Uses pivot `slot_magazine` / `snap_weapon` |
| `BulletInitSpeedCoef` | Velocity multiplier |
| `DispersionDiameter` | Spread size |
| `DispersionRange` | Spread distance |

Fire modes (`FireModes` array of `BaseFireMode`):
- `MaxBurst`, `MaxSalvo`, `RoundsPerMinute`
- `BurstType`: `Uninterruptable` / `Interruptable` / `InterruptableAndReseting`

---

## SightsComponent

Child of `MuzzleComponent`.

| Property | Notes |
|---|---|
| `BaseSights` | ADS camera PointInfo (usually `eye` pivot) |
| `SightsRanges` | Zeroing ranges |
| `SightsFOVInfo` | `SCR_FixedFOVInfo` |
| `SightsPointFront` / `SightsPointRear` | Iron sight points |
| `ADSTime` | Blend duration |
| `CameraRecoilAmount` | 0–300% |

Context menu: "Process zeroing data", "Toggle sight point diag".

---

## AttachmentSlotComponent

Defines a slot for optics, flashlights, suppressors, etc.
- Child of `WeaponComponent` (accessories) or `MuzzleComponent` (muzzle attachments).

---

## WeaponAnimationComponent — Variables

| Variable | Notes |
|---|---|
| `TriggerPulled`, `Firing` | Trigger state |
| `State` | Weapon state |
| `SightElevation` | Zeroing elevation |
| `Cocked`, `Empty`, `LastBullet` | Magazine state |
| `Bipod`, `BipodPitch`, `BipodYaw`, `BipodRoll` | Bipod state |
| `OpenBoltState` | Open bolt |

Commands: `CMD_Weapon_Reload`, `CMD_Weapon_MagRelease`, `CMD_Weapon_OpenCover`, `CMD_Weapon_Unfold`.

---

## Weapon Obstruction System

| Property | Notes |
|---|---|
| `Should Handle Obstruction` | Enable obstruction checks |
| `Obstruction Test Character Offset` | Vector from neck to weapon handling point |
| `Obstruction Test BB Scale` | Scales weapon bounding box for detection |
| `Can Go to Full Obstruction` | If false, weapon clips but can still fire |
| `Slight Obstr Weapon Max Z Offset` | Max Z pushback for slight obstruction |

- Slight obstruction: weapon pushed back along Z-axis.
- Significant obstruction: constant IK offset + larger Z pushback.
- **Pitfall**: only uses main `MeshObject` bounding box — modular weapons with stock/barrel attachments need manual BB scale adjustment.

### AI Weapon Type
Values: `None`, `Rifle`, `GrenadeLauncher`, `SniperRifle`, `RocketLauncher`, `MachineGun`, `Handgun`, `FragGrenade`, `SmokeGrenade`.

---

## Weapon Stats-Modifying Attachments

Weapon needs `SCR_WeaponStatsManagerComponent`. Each attachment has `InventoryItemComponent` with custom attribute list.

### Modifiable Stats

| Stat | Scope | Type |
|---|---|---|
| Muzzle Velocity Coefficient | Muzzle | float (multiplier) |
| Dispersion Factor | Muzzle | float |
| Linear/Angular/Turn Recoil Factors | Muzzle | vector |
| Override Shot Sound | Muzzle | bool → `SOUND_SUPPRESSED_SHOT` |
| Muzzle Effect Override | Muzzle | bool |
| Extra Obstruction Length | Global | float (m) |
| Is Bayonet | Global | bool |
| Melee Damage/Range/Accuracy | Global | float multipliers |

### API Pattern
```c
// Set (returns false on invalid muzzle)
bool SetXXX(IEntity attach, int iMuzzleIndex, value);
bool ClearXXX(IEntity attach, int iMuzzleIndex);

// Get (returns true if stat is overridden, false = stat not set)
bool GetXXX(int iMuzzleIndex, out value);
```

### Muzzle Effects
```c
// Register on attach
AddMuzzleEffectOverride(IEntity attach, int iMuzzleIndex, MuzzleEffect);
// Clear on detach — stays registered until explicitly cleared
ClearMuzzleEffectOverride(...);
```

### Custom Attribute Classes
- `SCR_WeaponAttachmentSuppressorAttributes`: velocity, dispersion, muzzle effects, obstruction, recoil.
- `SCR_WeaponAttachmentBayonetAttributes`: melee damage/range/accuracy, obstruction.
- Custom subclass must implement `bool ApplyModifiers(...)` and `void ClearModifiers(...)`.
- **Pitfall**: `ItemAttributeCollection` only finds the first matching attribute — only one subclass applies per attachment.

---

## Weapon Collimator Creation

### Required Components
- `SCR_CollimatorSightsComponent` (parent)
- `SCR_CollimatorControllerComponent` (child)
- Do NOT inherit from `WeaponOptic_Base.et` (includes `SCR_2DPIPSightsComponent`). Duplicate it and remove that component, or start from `Attachment_Base.et`.

### Material Setup
- Use `PBRBasic` class. Assign grayscale reticle texture to `Opacity Map`.
- Settings: Sort = `Translucent`, disable Cast/Receive Shadow, Blend Mode = `AlphaBlend`.
- Add `TCModFunc` array with `TCModShift` + `TCModScale`.

### Critical — Manual .emat Edits
Script bindings cannot be set in Workbench GUI. Edit `.emat` in text editor:
```
TCModFuncs {
  TCModShift "{5CDCD917EA1E1A1B}" {
    Refs {
      "ShiftU" "SCR_CollimatorControllerComponent.m_fUCoord"
      "ShiftV" "SCR_CollimatorControllerComponent.m_fVCoord"
    }
  }
  TCModScale "{5D60B8B11F689A05}" {
    Refs {
      "ScaleU" "SCR_CollimatorControllerComponent.m_fUScale"
      "ScaleV" "SCR_CollimatorControllerComponent.m_fVScale"
    }
  }
}
Refs {
  "Color"      "SCR_CollimatorControllerComponent.m_vColor"
  "Emissive"   "SCR_CollimatorControllerComponent.m_vEmissive"
  "EmissiveLV" "SCR_CollimatorControllerComponent.m_fEmissiveLV"
  "OpacityMap" "SCR_CollimatorControllerComponent.m_ReticleMap"
}
```

**Pitfalls:**
- TCModShift inner Refs are **lost on any Workbench save** — re-add manually each time.
- Refs stop working after any material change in Workbench — **full Workbench restart required**.
- Collimator only works in-game, NOT in World Editor.
- Flipped UV on projection plane → wrong sight movement. Check UVs first.

### Collimator Config Properties
| Property | Notes |
|---|---|
| `Collimator Top Left` / `Bottom Right` | Mandatory — define projection plane |
| `Collimator Aspect Ratio` | true by default (1:1 ratio) |
| `Reticle Default Angular Size` (degrees) | If 0, no angular adjustment |
| `Reticle Default Texture Portion` | % of texture covered by reticle |
| `Reticle Colors` | Two per entry: reticle color + glow color |
| `ADS Activation/Deactivation %` | Default 0.5; smaller for very open sights |

---

## Slot and Bone Naming

### Slot Points (on weapon body, named `slot_*`)

| Slot Name | Used By |
|---|---|
| `slot_magazine` | `MuzzleComponent` |
| `slot_optics` | `AttachmentSlotComponent` (dovetail/non-rail) |
| `slot_barrel_muzzle` | `AttachmentSlotComponent` (suppressor/compensator) |
| `slot_underbarrel` | `AttachmentSlotComponent` |
| `slot_bayonet` | `AttachmentSlotComponent` |
| `slot_flashlight` | `AttachmentSlotComponent` |

### Snap Points (on attachments, ALL named `snap_weapon`)
If absent, scene root is used for snapping. `slot_*` on parent aligns with `snap_weapon` on child.

### Functional Bones

| Bone | Purpose |
|---|---|
| `eye` | ADS camera (`SightsComponent`) |
| `barrel_chamber` | Bullet origin (`MuzzleComponent`) |
| `barrel_muzzle` | Firing direction (`MuzzleComponent`) |

### Animation/Simulation Bones

| Bone | Part |
|---|---|
| `w_bolt` | Bolt |
| `w_trigger` | Trigger |
| `w_fire_mode` | Fire selector |
| `w_safety` | Safety lever |
| `w_ch_handle` | Charging handle |
| `w_ejection_port` | Ejection port |
| `w_mag_release` | Magazine release |
| `w_bolt_release` | Bolt release |
| `w_buttstock` | Buttstock |
| `w_slide` | Pistol slide |
| `w_hammer` / `w_striker` | Hammer/striker |
| `w_cylinder` | Revolver cylinder |
| `w_bipodleg` / `_left` / `_right` | Bipod legs |
| `w_rear_sight` / `w_front_sight` | Iron sights |
| `w_barrel` | Barrel (recoil-operated / rotary cannon) |

---

## Weapon Animation System

### File Structure
```
Assets/Weapons/Rifles/Workspaces/
  weaponname.aw          — Animation Workspace
  weaponname.ast         — Animation Template
  weaponname.agr         — Animation Graph
  weaponname.agf         — Animation Graph File
  weaponname_weapon.asi  — Animation Instance (weapon)
  weaponname_player.asi  — Animation Instance (character)
```

### Setup Workflow (Duplicate-Based — Recommended)
1. Open `ak74.aw` → File → Duplicate Workspace → set target path, rename all entries.
2. Unassign all animations in weapon ASI (right-click → Unassign animations).
3. Edit new `.agr` in text editor — replace `AnimSetTemplate` GUID with value from `.aw`.
4. Remove old `.agf` reference from graph, create/duplicate new graph file; new sheet = "Master".
5. Copy-paste graph nodes between Animation Editor instances (Ctrl+C / Ctrl+V) is supported.

### WeaponAnimationComponent Prefab Assignment
- `Anim Graph` = `.agr`
- `Anim Instance` = `_weapon.asi`
- Enable `Always Active` + `Bind With Injection`
- `Anim Injection` → `Anim Graph` = same `.agr`, `Animation Instance` = `_player.asi`, `Binding Name = "Weapon"`

### IK Pose — Three Exports from One Blender Action
| File | Export Profile |
|---|---|
| `p_rfl_weapon_ik` | `501_IK` |
| `p_rfl_weapon_offset` | `101_FullBodyABS` |
| `p_rfl_weapon_safety` | `502_IK_RightHand` |

Assignments in player ASI:
- `Idle` Erc/Pne + `Safety` Erc/Pne → `_safety.anm`
- `IKOffset` Erc/Pne → `_offset.anm`

`Animation IK Pose` set in `SCR_WeaponAttachmentsStorageComponent > Attributes > Item Animation Attributes` → `_ik.anm`.

`Animation Instance` in `SCR_WeaponAttachmentsStorageComponent`: must match archetype used for IK base pose (`Rifle`, `Pistol`, `LMG`, `RPG`, `LAW`).

### Mechanics Animations
| File | Export Profile | Bone(s) |
|---|---|---|
| `_trigger` | `721_Weapon_Trigger` | `w_trigger` |
| `_bolt_pose` | `724_Weapon_Bolt` | `w_bolt` |
| `_fire` | `726_Weapon_Bolt_Trigger` | `w_bolt` + `w_trigger` |
| `_safety` | `701_Rifle_Idle` | `w_fire_mode` |

Bolt keyframes: 0 = closed, 1 = open, 2+ = closed.
Safety keyframes: one per fire mode (0=safe, 1=semi, 2=auto).

### Pitfalls — Animation System
- After `.agr` duplication: `AnimSetTemplate` GUID still points to old template — **must edit in text editor**.
- `Anim Injection` Binding Name must be exactly `"Weapon"` (matches root graph node name).
- `WeaponAnimationComponent` not present on `Rifle_Base.et` by default — must be added manually.
- Fire selector swap fix (AK74-based): `Pose - SemiPose` node → `Time = 0.5`, `Pose - AutoPose` → `Time = 1`.

### Blender Pitfalls
- Do NOT use Force Connect Children or Automatic Bone Orientation on the Reforger skeleton.
- Enable Net API in Workbench Options before any TXA export.
- If TXA auto-registration fails: right-click `.txa` in Resource Manager → Register & Import.
- When both character and weapon armatures in blend file: set `Character` as main armature, Rigify rig as `Secondary armature name`.

---

## Suppressor Setup (Full Workflow)

1. Inherit from `Prefabs/Weapons/Core/Suppressor_base.et`. Add `_base` suffix for base.
2. Create child prefab inheriting your base for variants/reskins.
3. Mesh: assign to `MeshObject`, enable `Model Geometry` in `RigidBody`.
4. Collider: layer `ItemFireView`, game material `weapon_metal.gamemat`.
5. `snap_weapon` empty at attachment origin, aligned with forward axis.
6. `InventoryItemComponent > Custom Attributes > SCR_WeaponAttachmentSuppressorAttributes`:
   - `Attachment Type` = custom muzzle class
   - Configure velocity, dispersion, obstruction length, recoil factors
7. `SCR_MuzzleEffectComponent`: assign `Suppressor_Carbine.ptc`; `Effect Position` = `EntitySlotInfo` at suppressor muzzle end; disable `Reset On Fire` for continuous barrel smoke.
8. `SCR_WeaponAttachmentObstructionAttributes`: set incompatible/required attachment types (already on `Suppressor_base.et`).
9. Entity Catalog: `Item Type = WEAPON_ATTACHMENT`, `Item Mode = ATTACHMENT`.
10. Localise `Item Display Name` — without localisation, detach action shows raw `#AR-UserAction_Dettach`.

On the weapon: add `AttachmentSlotComponent` as child of `MuzzleComponent`, `Pivot ID = slot_barrel_muzzle`, `Child Pivot ID = snap_weapon`, set Attachment Type, enable `Show in Inspection`. Add `SCR_WeaponStatsManagerComponent`.

Suppressor sound switching: component auto-switches to `SOUND_SUPPRESSED_SHOT` when suppressor is attached, as long as both normal and suppressed `.acp` files are listed in `WeaponSoundComponent.Filenames`.

---

## PIP Optic / Scope Setup

Inherit from `WeaponOptic_Base.et`. Key component: `SCR_2DPIPSightsComponent`.

### Required Mesh Empties
- `optic_rear` — center of ocular
- `optic_front` — front glass
- `eye` — ADS camera eye point (few cm behind ocular)
- `eye_ironsight` — if backup iron sights exist

All three sight axis points must be on a single aligned axis.

### Materials
- PIP surface mesh: material slot `Optic_pip` → `Optic_PSO1_PIPMaterial.emat` (duplicate)
- Glass lens mesh: `Optic_lensglass` → `Optic_ARTII_Lensglass.emat` (duplicate)
- Enable `Export hierarchy` in Import Settings (required for empties to export)

### RIS Attachment Class Sizes
| Class | Rail length |
|---|---|
| `AttachmentOpticsRIS1913` | ≥250 mm |
| `AttachmentOpticsRIS1913Medium` | ≤120 mm |
| `AttachmentOpticsRIS1913Short` | ≤120 mm |
| `AttachmentOpticsRIS1913VeryShort` | ≤80 mm |

A slot accepting `Medium` also accepts `Short` and `VeryShort`. A `VeryShort` slot only accepts `VeryShort`.

### SCR_2DPIPSightsComponent Config
**BaseSights:**
- `Sight FOV Info`: `SCR_SightsZoomFOVInfo` (fixed) or `SCR_VariableSightsFOVInfo` (variable power)
- `Sights Point Rear/Front/Position`: all on single axis

**Sights / 2DSights:**
- `Objective FOV` (real-life degrees from spec sheets)
- `Magnification`: same as Base Zoom
- `Objective Scale`: 0.5–1.0 (prevent leakage on 16:9)
- `Reticle Texture` / `Reticle Glow Texture`
- `Reticle Base Zoom`: 0 = front focal plane; match magnification = rear focal plane
- `Reticle Angular Size` (degrees)
- `Reticle Portion`: `reticle_pixel_width / texture_width`

**PiPSights:**
- `Scope HDR Material`: duplicate `Optic_ARTII_HDR.emat`, assign reticle to `Reticle Map`
- `Scope Radius`: tweak until PIP matches 2D view
- Disable reticle movement in HDR material to prevent misalignment

### Reticle Texture
- 1024×1024 TGA, alpha channel (black = transparent). Color irrelevant (engine replaces it).
- Use `_UI` or `_Reticle` suffix.
- Fix blurriness: `Conversion Quality = 100`, uncheck `Generate Mips`.

### SCR_CollimatorSightsComponent Key API
```c
SetReticleSize(float angularSize, float reticlePortion)
GetNumReticles() / IsReticleValid(int) / GetReticleByIndex(int)
GetCurrentReticleShape() / ReticleNextShape() / ReticlePreviousShape()
SetReticleShapeByIndex(int) → bool
GetNumColors() / GetColorByIndex(int) → BaseCollimatorReticleColor
GetCurrentColor() / ReticleNextColor() / ReticlePreviousColor()
SetReticleColorByIndex(int) → bool
SetVerticalAngularCorrection(float fAngle)   // mils — for zeroing
SetHorizontalAngularCorrection(float fAngle) // mils — for windage
IsSightActive() / SetSightForcedOff(bool)   // force off only, not force on
EnableManualBrightness(bool) / SetManualBrightness(float, bool bClamp)
GetNormalizedLightIntensity() → 0..1        // for auto-brightness
```
