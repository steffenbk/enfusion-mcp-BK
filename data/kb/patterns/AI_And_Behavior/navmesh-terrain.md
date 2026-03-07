# Navmesh & Terrain

---

## Navmesh Types

| Type | Purpose |
|---|---|
| `Soldiers` | Human AI navigation (required) |
| `BTRLike` | Vehicle AI (disabled as of v0.9.8 — AIs cannot drive yet) |
| `LowRes` | Low-resolution navmesh for streaming on large terrains |

**Streaming recommendation:** For large terrains, enable `Use Navmesh Streaming` on the Soldiers `NavmeshWorldComponent` and link the LowRes navmesh. Do NOT enable streaming on the LowRes component itself.

---

## World Setup

- Drag `SCR_AIWorld.et` into the world's default layer. Only one per world allowed.
- Contains three `NavmeshWorldComponent`s: Soldiers, BTRLike, LowRes.
- Assign `.nmn` files via: `Navmesh Settings > Navmesh Files Config > Navmesh File`.

---

## Generating Navmesh

1. Open Navmesh Tool from toolbar → Navmesh Tool tab.
2. Set Navmesh to `Soldiers`.
3. Click **Connect** → select Soldiers → OK.
4. Click **Generate** → keep Recast params defaults → OK → keep Generator area defaults → OK.
5. Wait for generation.
6. Click **Save** → writes `.nmn` file.
7. Assign `.nmn` to `NavmeshWorldComponent > Navmesh Settings > Navmesh Files Config > Navmesh File`.

---

## Partial Regeneration (preferred for mods)

- **Current Tile:** Move camera over tile → click `Rebuild Tile`. Good for small changes (a few buildings). Large compositions may span multiple tiles.
- **Tile Range (Position):** Generate window → Position tab → set From/To world positions → Generate. Save: use "Save Generated" or select tiles with LMB drag → right-click → Mark tiles → Save Marked.

---

## Modding Existing Terrains (Navmesh Override)

Instead of copying and regenerating the full navmesh:
1. Right-click `Navmesh_GM_Eden_Soldier.conf` → Override → copy in mod project.
2. Add partial `.nmn` to `Navmesh File Overrides` array.
3. Save, reload terrain.

**Everon note:** `CTI_Campaign_Eden.nmn` is over 1 GB. Full regeneration impractical for minor mods (can take 1+ hours).

---

## Terrain Entity

**Class:** `GenericTerrainEntity`. Only 0 or 1 terrain per world.

| Term | Definition |
|---|---|
| Vertex | Point in heightmap grid |
| Block | Smallest LOD unit; 1 block = 1 draw call; 32×32 faces (33×33 verts) at highest detail |
| Tile | 1 to 32 blocks; surface mask, supertexture, normal map mapped per tile; max 5 detail surfaces per block |

**Key properties:**
- `Terrain Grid Size` — face count (e.g. 512 faces = 513 vertices)
- `Grid Cell Size` — distance between vertices; lower = more detail
- `Terrain Size` = Grid Size × Cell Size
- `Heightmap` — 16-bit internal; default scale 0.03125/unit = ~2048 m vertical range

**LOD debug:** Diag Menu (Win+Alt) → Render → Terrain → Block's/Tile's bounding boxes.

---

## New Terrain Setup Workflow

### Step 1 — Create World
1. World Editor → Create new World → type: **Base scene**.
2. Drag `GenericTerrain_Default.et` from Resource Browser into world. (Sets correct Terrain Layer Preset — without it vehicles bounce/collide incorrectly.)
3. Position: **X:0, Y:0, Z:0** (required for collision/tools).
4. Save (Ctrl+S).
5. Right-click `GenericTerrainEntity` → **Create new terrain** → set grid resolution → Create.

### Step 2 — Environment Setup

| Component | Notes |
|---|---|
| `GenericWorldLightEntity` | Angle X (pitch), Angle Y (yaw: 0=South, 90=West, 180=North, 270=East) |
| Sky Preset | Set in world entity properties → `Atmosphere.emat` |
| Celestial bodies | Add to Planet Preset: `Sun_01.emat`, `Moon_01.emat`, `Stars_01.emat` |
| Clouds | Clouds Renderer: `SkyVolCloudsRenderer`; Clouds Preset: `Clouds_Volumetric.emat` |
| Fog | `FogHaze_Default.et` |
| Ocean | Set `Ocean Material` and `Ocean Simulation` |
| Post-Process | `GenericWorldPP_Default.et` (SSR, GodRays, UnderWater, SSDO, HBAO, HDR, PPAA) |
| Weather | `TimeAndWeatherManager.et` + `WeatherStates.conf` + `WeatherParameters.conf`. Set Latitude/Longitude |
| Environment Probe | `EnvProbe_Default.et` |

### Recommended Default Prefabs

| Prefab | Purpose |
|---|---|
| `PreloadManager.et` | Preloads common prefabs |
| `SCR_CameraManager.et` | 3rd person camera etc. |
| `MapEntity.et` | Player map (needs .topo + .edds) |
| `SCR_AIWorld.et` | AI world (navmesh) |
| `PerceptionManager.et` | AI spotting |
| `TimeAndWeatherManager.et` | Weather |
| `ProjectileSoundsManager.et` | Subsonic/supersonic audio |
| `ForestSyncManager.et` | Forest destruction (MP) |
| `DestructionManager.et` / `MPDestructionManager.et` | Destruction |
| `MusicManager_Base.et` | Background music |
| `RadioBroadcastManager.et` | Radio music |
| `AmbientSounds_Everon.et` | Wildlife ambient sounds |
| `SoundWorld_Base.et` | Sound world base |

---

## Terrain Tool

Open terrain tool (mountain icon) → Terrain Tool tab.

**Workflow:**
1. Manage tab → Import height map → import PNG.
2. On first edit: accept "Set normal map options and generate normal map" popup.
3. Sub-tabs: Manage, Sculpt, Paint, Info & Diags.

**Available Generators:** Forest, Lake, Powerline, Prefab, Road, Wall.

---

## Snap and Orient to Terrain Plugin

- Shortcut: `Ctrl+PgDown`
- Snaps and orients selected entities to terrain normal.
- **Pitfall:** Snaps to terrain mesh only — not to other meshes/objects below. For snapping to any surface: use `Ctrl+↓` in WE (does not orient to normal).
