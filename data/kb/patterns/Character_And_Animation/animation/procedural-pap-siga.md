# Procedural Animation System — PAP / SIGA Reference

> **LEGACY:** The PAP/SIGA system is being phased out by Bohemia Interactive.
> Use AGF/AGR for all new work. Only use PAP/SIGA when:
> - Reading or modifying existing base game assets that already use `.pap` files
> - You cannot migrate to AGF (e.g. a base game asset you cannot replace)

---

## Section 1: System Overview

### What Is the Procedural Animation Editor?

The Procedural Animation Editor is a separate, signal-driven animation tool in Arma Reforger's Workbench. Unlike the Animation Editor (which works with skeletal animation graphs and blending), it drives **bone transforms (rotation, translation, scale) mathematically using signal networks**.

Use cases:
- Vehicle doors, hatches, and moving parts
- Turret rotations and elevation drives
- Suspension and mechanical linkages
- Any object whose animation is computed from numeric inputs rather than pre-authored keyframes

### File Types

| File | Full Name | Purpose |
|------|-----------|---------|
| `.pap` | Procedural Animation Project | Top-level file. Contains Bone nodes + transform nodes (RotationSet, TranslateSet, ScaleSet). References `.siga` files via Signal nodes. |
| `.siga` | Signal Graph | Signal processing graph. Contains Input nodes (engine values), math/processing nodes, and an Output node that sends the result back to the `.pap`. |

### Data Flow

```
Engine runtime value
    → Input node (in .siga)
    → [math / processing nodes]
    → Output node (in .siga)
    → Signal node (in .pap)  [references the .siga file]
    → RotationSet / TranslateSet / ScaleSet (in .pap)
    → Bone transform applied to model
```

The graph is a **left-to-right dataflow**: sources and inputs on the left, bone transform executors on the right.

To use an existing `.siga` file: drag and drop it from the Resource Browser into the `.pap` Main Window — a Signal reference node is created automatically.

### ProcAnimComponent Prefab Setup

To attach a `.pap` to an entity:

1. Add `ProcAnimComponent` to the entity prefab.
2. Set `ResourceName` = path to the `.pap` file.
3. Set `BoneNames` = list of target bone names that the `.pap` should animate.

### Common Properties on All Nodes

Every node in both `.pap` and `.siga` editors shares:

| Property | Description |
|----------|-------------|
| Name | Node label for orientation in the graph. No runtime effect. |
| Comment | User documentation comment. No runtime effect. |

---

## Section 2: Critical Rules

1. **Signal node `Name` in `.pap` MUST exactly match Output node `Name` in the `.siga`** — case-sensitive. A mismatch produces a silent failure with no error message.
2. **Input node `Name` in `.siga` must exactly match the engine-side identifier** for the variable (the exact string the engine uses, e.g. for vehicle speed or throttle). Wrong name = no data received.
3. **`Update collider` is OFF by default** on RotationSet, TranslateSet, and ScaleSet. Only enable it if physics simulation must read the bone's collision shape. Enabling on purely visual bones wastes CPU cycles.
4. **Each `.siga` file is a separate signal processing graph** — one per signal chain. Design them as single-purpose, reusable units.
5. **The `.pap` file references `.siga` files via Signal nodes.** The Signal node holds the file path to the `.siga` and the output name to read from it.
6. **`ValRT` / `Value` / `Min` / `Max` properties on Input nodes are editor-only** — they have no effect at runtime. If the signal chain contains a Smoother node, `ValRT` has no effect even in the editor (Workbench 0.9.5.x).
7. **Never connect a raw signal directly to RotationSet.** Always build the rotation through a RotationMake node and feed the signal into only the relevant axis input.

---

## Section 3: PAP Nodes — Full Reference

PAP nodes live in the `.pap` file. They reference signal inputs and apply transforms to bones.

---

### Signal

**Purpose:** Bridge node that pulls a computed numeric value from a `.siga` signal graph into the `.pap` project.

Creating via the button also creates a new `.siga` file. To use an existing `.siga`, drag-and-drop it from the Resource Browser instead.

| Property | Description |
|----------|-------------|
| Name | **Must exactly match** the Output node `Name` in the referenced `.siga` file. This is how the `.pap` knows which value to read. |
| Comment | User comment. |
| Path | File path to the `.siga` file this Signal node references. |

**Gotcha:** Name mismatch between this node and the `.siga` Output node = silent failure, no animation.

---

### Constants

**Purpose:** Defines constant key-value pairs available throughout the `.pap` project. Use for fixed numeric values (gear ratios, rotation limits, fixed offsets) that can be referenced by other nodes without hardcoding them repeatedly.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Metadata | Additional metadata fields. |
| Constant values | The key-value pairs defined for this node. Each key becomes an output pin. |

---

### Bone

**Purpose:** Identifies which bone in the model will be animated. Does not apply any transform itself — outputs the bone reference for use by transform nodes.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Bone name | Name of the bone as it exists in the preview model. Populated only when a preview model is selected. **Editor preview only — does not affect the actual asset.** |

**Output:** `Out` — bone reference, connected to the `In` input of RotationSet / TranslateSet / ScaleSet.

**Gotcha:** The `Bone name` field is for editor preview only. Actual bone mapping on the final asset is handled by the `BoneNames` property on `ProcAnimComponent`. Always confirm bone names match the target model.

---

### RotationSet

**Purpose:** Applies a rotation to a bone at runtime. Primary executor for rotation animation.

| Property | Default | Description |
|----------|---------|-------------|
| Name | — | Node label. |
| Comment | — | User comment. |
| Update collider | OFF | If enabled, updates the physics collider when this rotation is applied. Enable only when physics needs to track the bone. |

**Inputs:** `In` (bone from Bone node), `Rotation` (rotation vector from RotationMake).
**Output:** `Out` — can be chained.

---

### RotationMake

**Purpose:** Constructs a rotation vector by combining per-axis angle values. Companion to RotationSet — build here, apply there.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Update collider | Default OFF. |
| X axis | Static rotation amount around X (overridden if dynamic input connected). |
| Y axis | Static rotation amount around Y (overridden if dynamic input connected). |
| Z axis | Static rotation amount around Z (overridden if dynamic input connected). |

**Dynamic Inputs:** X axis, Y axis, Z axis — connected input takes precedence over the static property value.

**Pattern:** Connect your signal to only the axis you want to drive. Leave unused axes at 0.

---

### RotationBreak

**Purpose:** Decomposes a rotation vector into its separate X, Y, and Z axis components. Inverse of RotationMake.

**Input:** `In` — a combined rotation vector (e.g. from a RotationMake output).
**Outputs:** `X axis`, `Y axis`, `Z axis`.

---

### TranslateSet

**Purpose:** Applies a translation (position offset) to a bone at runtime.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |

**Inputs:** `In` (bone reference), `Translation` (translation vector from TranslateMake).
**Output:** `Out` — can be chained.

**Note:** No `Update collider` property documented for TranslateSet (unlike RotationSet/ScaleSet).

---

### TranslateMake

**Purpose:** Constructs a translation vector from per-axis values.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| X axis | Static translation on X (overridden if dynamic input connected). |
| Y axis | Static translation on Y. |
| Z axis | Static translation on Z. |

**Dynamic Inputs:** X axis, Y axis, Z axis.
**Output:** `Out` — combined translation vector for TranslateSet's `Translation` input.

---

### TranslateBreak

**Purpose:** Decomposes a translation vector into X, Y, Z axis components. Inverse of TranslateMake.

**Input:** `In` — a translation vector.
**Outputs:** `X axis`, `Y axis`, `Z axis`.

---

### ScaleSet

**Purpose:** Applies a scale transform to a bone at runtime.

| Property | Default | Description |
|----------|---------|-------------|
| Name | — | Node label. |
| Comment | — | User comment. |
| Update collider | OFF | If enabled, updates the collider when scaling is applied. |

**Inputs:** `In` (bone reference), `Scale` (scale vector from ScaleMake).
**Output:** `Out`.

---

### ScaleMake

**Purpose:** Constructs a scale vector from per-axis scale values.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| X axis | Static scale on X. |
| Y axis | Static scale on Y. |
| Z axis | Static scale on Z. |

**Dynamic Inputs:** X axis, Y axis, Z axis.
**Output:** `Out` — scale vector for ScaleSet's `Scale` input.

---

### ScaleBreak

**Purpose:** Decomposes a scale vector into X, Y, Z components. Inverse of ScaleMake.

**Input:** `In` — a scale vector.
**Outputs:** `X axis`, `Y axis`, `Z axis`.

---

## Section 4: SIGA Nodes — Input / Output / Value / Random / Generator

SIGA nodes live in the `.siga` file and form the signal processing graph.

---

### Input

**Purpose:** Entry point for all live, dynamic data from the game engine (e.g. engine RPM, vehicle speed, door open state, throttle position).

| Property | Description |
|----------|-------------|
| Name | **Must exactly match the engine-side identifier.** Wrong name = no data received. |
| Comment | User comment. |
| Value | Editor-only. Sets a test value for previewing in Workbench. No runtime effect. |
| Min | Editor-only. Sets minimum test range. No runtime effect. |
| Max | Editor-only. Sets maximum test range. No runtime effect. |
| ValRT | Editor-only. Real-time value override in editor. No runtime effect. Has no effect when a Smoother node is in the chain (Workbench 0.9.5.x). |

**Gotcha:** The name must match exactly what the engine exposes — consult vehicle configuration or game code for valid identifiers. Use `Value`/`ValRT` to simulate signal values for editor testing.

---

### Output

**Purpose:** Exit point of the signal chain — sends the computed result from the `.siga` back to the `.pap` Signal node.

| Property | Description |
|----------|-------------|
| Name | **Must exactly match the `Name` on the corresponding Signal node in the `.pap` file.** |
| Comment | User comment. |

**Gotcha:** Name mismatch with the `.pap` Signal node = silent failure.

---

### Value

**Purpose:** A user-defined constant numeric value within the signal graph. Use for fixed numbers — scale factors, offsets, reference angles.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Value | The constant number this node outputs. |

**Best practice:** Use a meaningful Name so the graph is self-documenting. Prefer this over hardcoding numbers in Mul/Sub property fields.

---

### Random

**Purpose:** Generates a random float value within a defined range, on a configurable update schedule.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Min | Lower bound of the random range. |
| Max | Upper bound of the random range. |
| Update rate | **Every Get** — new value generated each time the branch is processed (e.g. engine switched on). **Every Frame** — new value generated every game frame. |

**Use case:** Natural variation in procedural animations — slight random vibration offsets, randomized idle amounts.

---

### Generator

**Purpose:** Outputs a specific value at a predefined time interval (in milliseconds). Functions as a periodic pulse — repeatedly emits the configured value on a timer.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Value to generate | The value emitted at each interval. |
| Interval | Time between emissions, in **milliseconds**. |

**Use case:** Autonomous oscillation or timed effects without needing an engine input — blinking lights, mechanical clicks, repeating pulses. Use when the animation is not driven by an engine variable.

---

## Section 5: Math Nodes — Full Reference

Math nodes perform arithmetic operations on signal values. They are the core of the signal processing pipeline.

---

### Sum

**Purpose:** Adds all connected input values together and outputs the result. Accepts multiple inputs.

---

### Sub

**Purpose:** Subtracts the subtracter from the input (`In - Subtracter`).

| Property | Description |
|----------|-------------|
| Subtracter | Static fallback subtracter value (used if `Subtracter` input is not connected). |

**Inputs:** `In` (dividend), `Subtracter` (optional dynamic — overrides property if connected).

---

### Mul

**Purpose:** Multiplies all connected input values together and outputs the product. Accepts multiple inputs.

**Common use:** Scale a normalized signal (0–1) to a rotation range (e.g. multiply by 360 to get degrees).

---

### Div

**Purpose:** Divides the input by the divisor (`In / Divisor`).

| Property | Description |
|----------|-------------|
| Divisor | Static fallback divisor (used if `Divisor` input is not connected). |

**Inputs:** `In` (dividend), `Divisor` (optional dynamic — overrides property if connected).

**Gotcha:** Guard against dividing by zero — the engine does not protect you automatically.

---

### Pow

**Purpose:** Returns the input raised to the power of the exponent (`In ^ Exponent`).

**Inputs:** `In` (base), `Exponent`.

---

### Remainder

**Purpose:** Returns the remainder of dividing the input by the divisor (modulo: `In % Divisor`).

**Inputs:** `In`, `Divisor`.

**Use case:** Keeping a cumulative rotation value within a 0–360 range.

---

### Min

**Purpose:** Returns the smallest value among all connected inputs. Accepts multiple inputs.

---

### Max

**Purpose:** Returns the largest value among all connected inputs. Accepts multiple inputs.

---

### Abs

**Purpose:** Returns the absolute value of the input — always non-negative, sign stripped.

**Use case:** When you need the magnitude of a value regardless of direction (e.g. speed in either direction).

---

### Exp

**Purpose:** Returns `e ^ input` (Euler's number raised to the power of the input).

---

### Ln

**Purpose:** Returns the natural logarithm (base e) of the input.

---

### Log2

**Purpose:** Returns the base-2 logarithm of the input.

---

### Log10

**Purpose:** Returns the base-10 logarithm of the input.

---

### Average

**Purpose:** Computes a rolling average of the input values over time using an internal buffer.

| Property | Description |
|----------|-------------|
| Capacity | Size of the averaging buffer. **Rounded to the nearest power of two** (e.g. entering 6 yields capacity 8). Controls how many past values are included. |

**Use case:** Smoothing rapidly fluctuating engine values for gauge needle animations. More natural than a single-frame sample.

---

## Section 6: Conversion Nodes — Full Reference

Conversion nodes transform a value from one unit or scale system to another.

---

### Convertor

**Purpose:** Range-based mapping — maps input value ranges to specific output values. You define multiple ranges; when the input falls within a range, the corresponding output value is emitted.

| Property | Description |
|----------|-------------|
| Input as default | If checked, the raw input value is used as output when no range condition is met. |
| Default | Output value when no range is matched (when `Input as default` is unchecked). |
| Ranges | List of range definitions (see below). |

**Range sub-properties:**

| Sub-Property | Description |
|-------------|-------------|
| Min | Lower bound of this input range. |
| Max | Upper bound of this input range. |
| Out | Value emitted when input falls within [Min, Max]. |

**Example:** Input range 0–1, range Min=0.1, Max=0.2, Out=100 — output is 100 whenever input is between 0.1 and 0.2.

**Use case:** Discretizing a continuous signal into stepped outputs. Mapping vehicle speed ranges to distinct animation states. Prefer over continuous interpolation when animation should snap between states.

---

### Db2Gain

**Purpose:** Converts decibels to linear gain amplitude.

Formula: `gain = 10^(dB / 20)`

---

### Gain2Db

**Purpose:** Converts linear gain amplitude to decibels.

Formula: `dB = 20 * log10(gain)`

---

### St2Gain

**Purpose:** Converts semitones to gain ratio.

---

### Gain2St

**Purpose:** Converts linear gain ratio to semitones.

---

### Freq2Oc

**Purpose:** Converts frequency to octave.

---

## Section 7: Signal Shaping & Processing Nodes — Full Reference

These nodes shape how a signal behaves over time — controlling fade-in/out, interpolation between states, and temporal smoothing.

---

### Env (Envelope)

**Purpose:** Shapes the output value over a four-point A-B-C-D region. Defines a rise segment (A to B) and a fall segment (C to D), each with a configurable interpolation curve.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| A | x Min — start of the fade-in (rise) segment. |
| B | x Max — end of the fade-in segment. |
| C | x Min — start of the fade-out (fall) segment. |
| D | x Max — end of the fade-out segment. |
| Fade-in | Interpolation curve type applied between A and B. |
| Fade-out type | Interpolation curve type applied between C and D. |

See Section 10 for available curve types.

---

### Interpolate

**Purpose:** Interpolates between output values across a four-point range. Also acts as a **threshold gate** when all four points collapse to two values.

**Threshold gate special case:**
```
if (A == B && C == D):
    output = 1  when input is in [A, C)
    output = 0  otherwise
```
When A equals B and C equals D, the node acts as a binary switch.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| A | x Min — start of fade-in region. |
| B | x Max — end of fade-in region. |
| C | x Min — start of fade-out region. |
| D | x Max — end of fade-out region. |
| Fade-in | Curve type between A and B. |
| Fade-out type | Curve type between C and D. |

---

### Smoother

**Purpose:** Smooths the input value over time — acts as a temporal low-pass filter. Rapid input changes are eased into gradual transitions using configurable fade-in and fade-out curves and time constants.

| Property | Description |
|----------|-------------|
| Name | Node label. |
| Comment | User comment. |
| Fade-in time | Time in **milliseconds** for value to transition from lower to higher (e.g. 0 → 1). |
| Fade-in type | Interpolation curve type during fade-in phase. |
| Fade-out time | Time in **milliseconds** for value to transition from higher to lower (e.g. 1 → 0). |
| Fade-out type | Interpolation curve type during fade-out phase. |
| Input resets timer | If checked, a new incoming value resets the interpolation timer, restarting from current position. |
| Always interpolate | When checked, completes current interpolation before accepting a new target value mid-transition. |

**Gotcha:** When a Smoother is present in the chain, the `ValRT` property on Input nodes has no effect (Workbench 0.9.5.x).

---

## Section 8: Rounding & Clamping Nodes — Full Reference

These nodes constrain or discretize numeric values.

---

### Floor

**Purpose:** Rounds downward — returns the largest integer not greater than the input.

Examples: `Floor(3.9) = 3`, `Floor(-1.1) = -2`

---

### Ceil

**Purpose:** Rounds upward — returns the smallest integer greater than the input.

Examples: `Ceil(3.1) = 4`, `Ceil(-1.9) = -1`

---

### Round

**Purpose:** Rounds to the nearest integer (standard rounding).

Examples: `Round(3.5) = 4`, `Round(3.4) = 3`

---

### Clamp

**Purpose:** Constrains the input to stay within a min-max interval. Values below Min are raised to Min; values above Max are lowered to Max.

| Property | Description |
|----------|-------------|
| Min | Static minimum (used if Min input not connected). |
| Max | Static maximum (used if Max input not connected). |

**Dynamic Inputs:** `In`, `Min` (overrides property), `Max` (overrides property).

**Use case:** Preventing a rotation from exceeding physical limits (e.g. a turret that can only rotate -180° to +180°).

---

### ClampMin

**Purpose:** Ensures the input never goes below the defined minimum. No upper limit applied.

| Property | Description |
|----------|-------------|
| Min | Static minimum value. |

**Dynamic Inputs:** `In`, `Min` (overrides property).

---

### ClampMax

**Purpose:** Ensures the input never exceeds the defined maximum. No lower limit applied.

| Property | Description |
|----------|-------------|
| Max | Static maximum value. |

**Dynamic Inputs:** `In`, `Max` (overrides property).

---

## Section 9: Trigonometry Nodes — Full Reference

All angle inputs and outputs are in **radians**.

---

### Sin

**Purpose:** Returns the sine of the input angle (radians). Output range: -1 to +1.

**Use case:** Oscillating back-and-forth motion (e.g. a pendulum driven by a time input).

---

### Cos

**Purpose:** Returns the cosine of the input angle (radians). Output range: -1 to +1.

**Use case:** Circular motion, phase-shifted oscillation relative to Sin.

---

### Tan

**Purpose:** Returns the tangent of the input angle (radians). Output range: -inf to +inf.

**Gotcha:** Discontinuous at π/2 + nπ — use with care to avoid singularities.

---

### ASin

**Purpose:** Returns the arcsine (inverse sine) of the input. Outputs the angle in radians whose sine equals the input.

Input must be in range [-1, 1]. Output range: -π/2 to +π/2.

---

### ACos

**Purpose:** Returns the arccosine (inverse cosine) of the input. Outputs the angle in radians whose cosine equals the input.

Input must be in range [-1, 1]. Output range: 0 to π.

---

### ATan

**Purpose:** Returns the arctangent (inverse tangent) of the input. Outputs the angle in radians whose tangent equals the input.

Output range: -π/2 to +π/2.

---

## Section 10: Interpolation Curve Types Reference

Used by: Env, Interpolate, Smoother (Fade-in and Fade-out curve selection).

| Curve Type | Formula | Character / Behavior |
|-----------|---------|---------------------|
| Linear | f(x) = x | Constant rate of change. Straight line. No easing. |
| S-Curve | Smooth sigmoidal | Starts slow, accelerates through the middle, ends slow. Natural-feeling transition. |
| Power of 1.41 | f(x) = x^1.41 | Slight ease-in. Gentle acceleration. |
| Power of 2 | f(x) = x^2 | Quadratic ease-in. Slow start, fast end. Good for gradual start. |
| Power of 3 | f(x) = x^3 | Cubic ease-in. More aggressive acceleration. Pronounced slow start. |
| Power of 1/1.41 | f(x) = x^(1/1.41) | Slight ease-out. Gentle deceleration. Opposite of Power of 1.41. |
| Power of 1/2 | f(x) = x^(1/2) = sqrt(x) | Square root. Ease-out. Fast start, slow end. |
| Power of 1/3 | f(x) = x^(1/3) | Cube root. More aggressive ease-out. Very fast start, slow end. |

**Choosing the right curve:**
- Mechanical motion (doors, hatches): Power of 2 fade-in + Power of 1/2 fade-out — natural feel.
- Snap-to-position: Power of 3 fade-in for a slow wind-up.
- Natural oscillation: S-Curve on both directions.
- Precise control with no shaping: Linear.

---

## Section 11: Key Design Patterns & Best Practices

### Wheel Rotation Signal Chain

```
Engine speed signal
  → Input (siga, Name = engine speed identifier)
  → Mul (scale to rotation degrees per second)
  → Output (siga, Name = "WheelRotation")
  → Signal (pap, Name = "WheelRotation", Path = wheel.siga)
  → RotationMake (connect to X or Z axis only, others = 0)
  → RotationSet (Update collider OFF)
  → Bone ("wheel_front_left")
```

### Steering Signal Chain

```
Steering input signal
  → Input (siga, Name = steering identifier)
  → Clamp (Min = -1, Max = 1)            [prevent over-rotation if input exceeds ±1]
  → Mul (scale to max steering angle in degrees)
  → Smoother (Fade-in ~100ms, Fade-out ~100ms)   [damped response]
  → Output (siga, Name = "SteeringAngle")
  → Signal (pap, Name = "SteeringAngle")
  → RotationMake (Y axis only for left/right yaw)
  → RotationSet
  → Bone ("steering_wheel")
```

### Pattern: Always Clamp Before Bone Transforms

Place a Clamp or ClampMin/ClampMax node at the end of every signal chain, immediately before connecting to RotationSet/TranslateSet/ScaleSet. An unclamped signal can produce jarring or physically impossible bone transforms. Never skip this step for physically driven inputs.

### Pattern: Smoother for Damped Response

Any signal from engine physics (speed, RPM, suspension compression) can fluctuate rapidly frame to frame. Place a Smoother node in the chain. Set Fade-in and Fade-out times (in milliseconds) based on how fast the animation should respond. Short times (50–100ms) = responsive but still smoothed. Long times (500ms+) = heavy damping.

### Pattern: Convertor to Remap Engine Ranges

Use Convertor when an animation must snap between discrete states rather than interpolate continuously. Define ranges for each state and assign a specific output value. Example: engine speed ranges 0–10 → gear indicator position 1, 10–20 → position 2, etc.

### Pattern: Generator for Autonomous Oscillation

When an animation must cycle continuously without requiring an engine input variable (blinking lights, mechanical pulses, idle vibration without physics data), use a Generator node as the source. Set Value to the pulse magnitude and Interval to the period in milliseconds.

### Pattern: Trigonometry for Oscillation Without Generator

Feed a time-based signal through Sin or Cos. Output oscillates naturally between -1 and +1. Scale with Mul to the desired rotation magnitude. Offset with Sum to center the oscillation around a non-zero value if needed.

### Pattern: Use Average for Gauge Needles

For instruments and gauges driven by rapidly fluctuating engine values, place an Average node (moderate Capacity, e.g. 8–16) before the bone transform. Produces a smooth, physically plausible needle that represents the rolling average of recent readings rather than jittering on every frame.

### Pattern: Value Nodes for Named Constants

Instead of hardcoding a number directly in a Mul or Sub property field, connect a Value node with a meaningful Name. This makes the graph self-documenting and makes it easy to update the constant in one place.

### Pattern: Reusable SIGA Files

Design each `.siga` as single-purpose and reusable. A "normalize RPM to 0–1" graph can be shared by multiple bones in multiple `.pap` files. Avoid cramming multiple signal chains into one `.siga`.

### Pattern: Test with Editor-Only Values

Use `Value`, `Min`, `Max`, and `ValRT` on Input nodes to simulate signal values inside the editor and preview animation without running the full game. Remember these are editor-only — confirm the engine-side signal is wired correctly before final delivery.
