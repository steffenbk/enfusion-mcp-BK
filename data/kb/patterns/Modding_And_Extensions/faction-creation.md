# Faction Creation

---

## Character Setup

Inherit from `Character_Base.et`. Required components:

| Component | Role |
|---|---|
| `SCR_CommunicationSoundComponent` | Radio protocol audio (config project files via `Filenames` property) |
| `CharacterIdentityComponent` | Voice, head, body — randomly generated from faction config unless `Override` is checked |
| `FactionAffiliationComponent` | `Faction` string must match `Faction Key` in faction config exactly |
| `BaseLoadoutManagerComponent` | Equipment slots: Helmet, Jacket, Pants, Boots, Vest, Backpack. Each: `Name`, `Area`, `Meshes To Hide`, `Prefab` |
| `SCR_InventoryStorageManagerComponent` | `Initial Inventory Items` array: each entry has `Target Storage` (prefab) + `Prefabs to Spawn` |
| `BaseWeaponManagerComponent` + `CharacterWeaponSlotComponent` | Primary/secondary slots via `Weapon Slot Type` + `Weapon Slot Index` |
| `CharacterGrenadeSlotComponent` | Grenade slot |
| `SCR_EditableCharacterComponent` | In-editor preview, budget, labels |

**Equipment retexturing:**
- Wearable items use `Worn Model` + `Item Model` (not `MeshObject`) for visuals.
- Create material duplicates → assign to new prefab or via `Materials Override` list.
- **Pitfall:** `Materials Override` is less reliable — prefer creating a new prefab with custom materials.
- `PreviewRenderAttributes` in `SCR_UniversalInventoryStorageComponent` controls inventory menu preview — does not support material overrides, only prefabs.

---

## Faction Config Fields

| Field | Description |
|---|---|
| `Faction Key` | Unique string ID; must match exactly in `FactionAffiliationComponent.Faction` |
| `Faction Color` | RGBA for UI |
| `Is Playable` | Shows faction in respawn menu |
| `Identity of soldiers` | References a `FactionIdentity_*.conf` |
| `Callsign Info` | References a `Callsigns_*.conf` |
| `Friendly Factions Ids` | List of allied Faction Keys |
| `Entity Catalogs` | Determines arsenal availability etc. |

---

## Groups

Inherit from `Group_Base.et`.
- `Faction` property in Groups tab: must match faction name.
- `SCR_GroupIdentityComponent`: `Identity` property sets NATO APP-6 marker type (`OPFOR`, `BLUFOR`, etc.).
- Group composition: `Unit Prefab Slot` in Group Members tab.

---

## Custom Faction Labels (in-game editor)

```c
modded enum EEditableEntityLabel
{
    FACTION_REDFOR = 1653989487,  // large random number to avoid clashes with vanilla/other mods
}
```
Then override `EditableEntityCore.conf` and add entry with Label Type = your new enum value.

---

## Registering Assets in In-Game Editor

1. Override `EditablePrefabsComponent_EditableEntity.conf` → add `EditablePrefabsLabel_Faction` rule with faction name string.
2. Create `SCR_PlaceableEntitiesRegistry` configs for Characters, Groups, Vehicles.
3. Select prefabs in Resource Browser → Plugins → "Register Placeable Entities" → select config → Run.
4. Manually set `Authored Labels`, Military Symbol (for groups), localised `Name` on each prefab.

**Adding faction to in-game editor faction list:**
- Override `FactionManager_Editor.et` → add faction config to `Factions` array.
- Uncheck `Is Playable` — GM decides at runtime whether faction is available.

---

## File/Directory Conventions

Key folders in a faction mod:
```
Configs/Factions/         — faction .conf files
Configs/Callsigns/        — Callsigns_*.conf
Configs/Identities/       — FactionIdentity_*.conf
Configs/Core/             — core configs
Prefabs/Characters/       — character prefabs
Prefabs/Groups/           — group prefabs
Prefabs/Vehicles/         — vehicle prefabs
Assets/Characters/        — models, materials
Language/                 — .st localisation files
```
