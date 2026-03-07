# Particle Editor

---

## Overview

- Dedicated tool for creating/editing `.ptc` particle effect files.
- Effects placed via World Editor (`ParticleEffect` entity) or created in script.
- Each effect = one or more emitters.
- Dedicated servers skip loading most emitters (purely visual).

---

## LOD System

Three fixed LOD levels: 0, 1, 2. Engine selects based on distance, resolution, FOV.

Default distances at 1080p / 70° vertical FOV:
- LOD 0: < 25 m
- LOD 1: 25 m – 200 m
- LOD 2: > 200 m

Each emitter has a min/max LOD slider (e.g. 0-1 = active in LOD 0 and 1 only).
- Inactive emitters stop emitting new particles but existing ones finish their life.
- Debug in-game: Diag Menu → Scene → Particles → Show Particle FX LOD.

**Pitfall:** Emitter enable/disable checkbox in Emitters list is preview-only — not saved to file.

---

## Key Emitter Properties

### General / Emission
| Property | Notes |
|---|---|
| `Shape Type` | Box, Point, Sphere, Ellipse |
| `Cone Angle` (X/Y/Z) | Circumferential / inner / outer |
| `Max Num` | Max simultaneous particles — directly affects performance |
| `Birth Rate` | Particles/s |
| `Birth Rate Vel` | Higher speed = more particles |
| `Local Transform` | Local-space sim moves with parent; world-space leaves particles behind |

### Appearance
| Property | Notes |
|---|---|
| `Center X/Y` | Pivot offset (e.g. `0, -1` for muzzle flash growing upward) |
| `Stretch Multiplier` | > 1 = streak mode (requires velocity or gravity) |
| `Streak Full UV` | Stretches full UVs instead of middle-only |
| `Billboarding Type` | `Full` (default), `LockedAxis` (trees/fire), `None` (quads) |
| `Angular Fade Out Start/End` | For LockedAxis/None to prevent side-on artifacts |
| `Vel Angle` | Particle faces velocity direction (cannot combine with Random Angle) |
| `Random U Flip` | 50% texture U-flip |

### Physics
| Property | Notes |
|---|---|
| `Air Resistance` | Must be > 0 to use Wind Influence |
| `Wind Influence` | 0..1 — requires Air Resistance > 0 |
| `Restitution` | Velocity preservation after collision (0 = no collision) |
| `Spring` | Pulls particle toward emitter origin |

### Texture Sheet Animation
| Property | Notes |
|---|---|
| `Anim Once` | Play once, hold last frame (last frame must be transparent to vanish) |
| `Anim FPS` | 0 still animates at 1 FPS — use 0.001 for near-static |
| `Lifetime by Anim` | Lifetime = FPS × frame count; overrides other lifetime settings |
| `Random Frame` | Pick one random frame and hold |

### Lifetime
- `Lifetime`, `Lifetime RND`
- `Lifetime Vel Factor`: `finalLifetime = (lifetime + lifetimeRND) / (1 + velocity * lifetimeVelFactor)`
- `Lifetime Shortening`: after collision, requires Restitution > 0

### Per-particle animation graphs
Color, Alpha, Rotation Speed, Size (per-particle lifetime 0→1).

### Per-emitter master graphs
Color Mast, Alpha Mast, Rotation Speed Mast, Size Mast, B Rate Mast, Air Resistance Mast, Velocity Mast.
Formula: `result = particleProperty * emitterMaster`

---

## Material Editor Properties

| Property | Notes |
|---|---|
| `Emissive` | Normalized, zero default |
| `Alpha To Emissive LV` | `From Alpha Graphs` = cheap; `Per Pixel` = quality |
| `Receive Shadow` / `Receive Lights` | Both off by default |
| `Blend Mode` | Normal or Additive |
| `Gradient Map` | Red channel → U axis of gradient; V axis = birth-to-death color change |
| `Softness` | Soft depth collision with meshes |
| `Camera Blend Near/Far` | Fade in by distance from camera |

---

## Animation Panel Controls

- `Snap to Grid`: X step 0.01, Y step 0.1
- `Lock Horizontal Axis`: Y-only changes, no X movement risk
- `See Through Layers`: show other curves as transparent
- Control points: double-click to create, right-click → Add Point, Ctrl+drag to move all color channels together

---

## Pitfalls

- **Streak mode requires velocity**: `Stretch Multiplier` > 1 → streak mode; velocity or gravity must be set or effect is invisible.
- **Air Resistance prerequisite for Wind**: `Wind Influence` only works if `Air Resistance` > 0.
- **`Anim FPS = 0` still animates**: at 1 FPS. Use 0.001 for near-static.
- **Inactive LOD emitters**: stop emitting new particles but don't kill existing ones — design LOD emitters accordingly.
- **Emitter checkbox not saved**: preview-only toggle.
