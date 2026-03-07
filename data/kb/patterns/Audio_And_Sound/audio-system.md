# Audio System

---

## Pipeline Overview

- Entities with `SoundComponent`s play sounds defined in `.acp` files (Audio Config Project).
- **Sound Event Names** are strings — the Sound node name in the ACP must exactly match what is called from code/script.
- **Signals** (named floats) flow from game state into the audio graph to modulate parameters in real time.
- One-shots via `SCR_SoundManagerEntity` (no SoundComponent needed). Loops always require a SoundComponent.

---

## Audio Editor

Node-graph tool producing `.acp` files.

**Panels:** Canvas, Palette, Item Detail, Level Monitor, Listener Setup, Playlist, Log Console, Output Tracker, Item Explorer, Resource Browser.

**Key shortcuts:**
- Space — play/stop
- F5 — debug mode
- Shift+F10 — Signals Simulation

---

## Core Node Types

### Mandatory Nodes

| Node | Role |
|---|---|
| **Bank** | Sample player; references `.wav` files (max 1024 per bank). Selection modes: Random/Sequential/CustomSignalIndex/etc. |
| **Sound** | Named event identifier. Has: trigger, priority, spatialization options, master/slave mode, bounding volume. Name must match code call exactly. |

### Signal Processing Nodes

| Node | Role |
|---|---|
| **Shader** | Spatialization — panning + attenuation. Uses Amplitude, Frequency, Spatiality settings sub-nodes. |
| **Amplitude** | Distance attenuation curve (Linear/SCurve/Log/1r/Custom), inner/outer range, directivity. |
| **Frequency** | Air absorption / LP filtering by distance. Directivity LP filter (fc + maxRolloff). |
| **Selector** | Splits chain by signal range value — selects one branch based on signal value. |
| **Bus** | Mixes multiple inputs; source limiting; per-channel volume; feeds Audio Variables. |
| **Signal** | Resource node edited in Signal Editor; transforms inputs to outputs. |
| **Stream** | Audio source for VoN. ID must be `"Stream"`. |
| **Variable** | Reads an Audio Variable value as a signal with a curve. |
| **Generator** | Synthesized test audio (Sine/Square/etc.). |
| **Constants** | Static signal values; drag `.sig` file onto it to auto-link. |

---

## DSP Nodes (inside Filter nodes)

BiquadFilter, Compressor, Distortion, DynamicEqualizer, Equalizer4, Flanger, QuadDelay, LoudnessNormalization, MonoToStereo, OnePoleFilter, PeakLimiter, Phaser, Reverb, Reverb2, SmallRoomReverb, Tremolo, VariableRolloffLPF, NoiseGate, Bitcrusher.

---

## Signal Editor Node Types

| Category | Nodes |
|---|---|
| Interface | Input, Output |
| Value generation | Value, Variable, Random, Generator, Time, LFO, CurveModulator, SquareModulator |
| Math | Sum, Sub, Mul, Div, Mod, Min, Max, Abs, Pow, Cond |
| Conversion | Converter, Interpolate, Env, Smoother, Average, Filter, Delta |
| Unit conversion | Exp, Ln, Log2, Log10, Db2Gain, Gain2Db, St2Gain, Gain2St |
| Saturation | Floor, Ceil, Round, Clamp, ClampMin, ClampMax |
| Trig | Sin, Cos, Tan, ASin, ACos, ATan |

---

## SoundComponent Hierarchy

```
BaseSoundComponent       (minimal)
    SimpleSoundComponent
        SoundComponent              (reads signals, animation events)
            WeaponSoundComponent
            CharacterSoundComponent
            VehicleSoundComponent
            CommunicationSoundComponent
```

Use the most specific component available. `SndSystem` activeness rules apply.

---

## Key Signals by Component Type

| Component | Key Signals |
|---|---|
| Character | Speed, Stance, Surface, MovementSpeed, WeaponStance, ... |
| Vehicle | RPM, Wheels, Damage signals |
| Weapon | Suppressor, TimeSinceAutoSeq, IsADS |
| Global | GInterior, GCurrVehicleCoverage, EnvironmentType |
| Helicopter | ~25 dedicated signals |

**Critical:** Signal Input node name in ACP must exactly match the game signal name.

---

## Audio Variables

**Format:** `.conf` files.

**Source types:** Volume, Amplitude, PlayTime, Constant, External.

**Operators:** Sum, Max, Min.

**External variables (from script):**
```c
AudioSystem.SetVariableByName("MyVar", value);
AudioSystem.SetVariableByID(id, value);
```

Bus, Sound, and Amplitude nodes can feed into Audio Variables. The Variable node reads them back with a curve.

---

## Directivity

Variable-rolloff LP filter based on listener angle to source (approximated as high-shelf biquad).

**Parameters:** `fc` (cutoff frequency) + `maxRolloff` (dB/decade at 180°).

Set in Frequency node's Directivity section.

---

## Occlusion

- **Building occlusion:** via `GInterior` / `Interior` / `GRoomSize` / `RoomSize` signals.
- **Vehicle occlusion:** via `GCurrVehicleCoverage` signal (supplied by `CompartmentManagerComponent` base + `SlotManagerComponent` slot contributions).
- Same-room logic: if both source and listener are in the same room, occlusion is reduced.

---

## SCR_SoundManagerEntity

- One per world. Always present.
- No SoundComponent needed — plays one-shot sounds.
- **Two workflows:**
  1. By string → uses `SCR_SoundDataComponent` on the entity.
  2. By `SCR_AudioSourceConfiguration`.
- **Cannot manage loops.** Signals must be set before playback only.
- Not for console platforms. Not for UI sounds.
- **Prefer this over adding a SoundComponent for one-shots.**

---

## Music Manager

- `MusicManager` entity in world.
- `LocationMusic` — location-based music.
- `ScriptedMusic` — code-driven music.
- **Categories:** Ambient / Menu / Misc / USER1–3.
- Music sounds must route to Mixer's `"Music"` port.
- Interrupted by gunshots/explosions if volume >= threshold.

---

## Radio Broadcast Manager

Synchronized DJ + music playlist across all players.

**Required signals in ACP:** Offset, MusicTrackID, DJTrackID, BroadcastType.

**Bank selection:** Must use `CustomSignalIndex` selection mode.

**Required entity components:** `RplComponent`, `SignalsManagerComponent`, `ActionsManagerComponent`, `RadioBroadcastComponent`, `RadioBroadcastSoundComponent`.

---

## Voice over Network (VoN)

- `VoNComponent` on both sender and receiver.
- ACP uses **Stream** node with ID `"Stream"` as audio source.
- Events: `VON_DIRECT` / `VON_RADIO` / `VON_RAW`.
- Active signals during playback: TransmissionQuality, Distance, Interior, RoomSize, GInterior, etc.

---

## Building Doors

- Uses `AudioSystem` direct calls — no SoundComponent.
- ACP file assigned to `DoorComponent.SoundFileName`.
- Events: `SOUND_OPEN_START`, `SOUND_OPEN_FINISH`, `SOUND_CLOSE_START`, `SOUND_CLOSE_FINISH`, `SOUND_MOVEMENT`.

---

## Collision Sounds

- Vegetation contacts: `BushContact`, `BushHeight` signals.
- Special entities (barbed wire etc.): `SpecialContact`, `SpecialContactEntityHeight` signals.

---

## Multiphase Destruction (MPD) Audio

- Requires central ACP + `MPDestructionManager` entity in world.
- Sound name format: `SOUND_MPD_` + enum string.
- Mod via `modded enum SCR_EMaterialSoundTypeBreak` (prefix `BREAK_`) or `SCR_EMaterialSoundTypeDebris`.
- Signals: `PhasesToDestroyed`, `EntitySize`, `CollisionDV`.
- **Pitfall:** Per-instance prefab changes to MPD are ignored.

---

## Tree Destruction

- `SCR_TreeDebrisSmallEntity` with `AudioSourceConfiguration Break` (`SOUND_TREE_BREAK`) and `Impact` (`SOUND_TREE_IMPACT`).
- `DestructionManager` entity required in world.

---

## Key Pitfalls

- Sound Event Name must match ACP Sound node name exactly (case-sensitive).
- Signal Input node name must match game signal name exactly.
- Loops always need a `SoundComponent` — `SCR_SoundManagerEntity` cannot manage loops.
- `MPDestructionManager` must be in world or MPD sounds never play.
- Regenerate Times when bank `.wav` files change (stale timing cache).
- Do not use `SCR_SoundManagerEntity` for UI sounds.
