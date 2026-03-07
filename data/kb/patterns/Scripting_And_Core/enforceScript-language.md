# EnforceScript Language Quirks & Conventions

---

## !! NO TERNARY OPERATOR !! — Most Common Compile Error

`?:` does **not exist** in EnforceScript. Every occurrence causes a compile error.
Always use `if/else` instead — no exceptions:

```c
// COMPILE ERROR — DO NOT USE
string name = (count > 0) ? "Yes" : "No";
return isLeft ? m_LeftPrefab : m_RightPrefab;
int n = m_aArray ? m_aArray.Count() : 0;

// CORRECT
string name;
if (count > 0) name = "Yes"; else name = "No";

if (isLeft) return m_LeftPrefab;
return m_RightPrefab;

int n = 0;
if (m_aArray) n = m_aArray.Count();
```

---

## Component Class Header Convention

```c
[ComponentEditorProps(category: "WW2Vehicles/SubCategory", description: "...")]
class MyComponentClass : ScriptComponentClass {}

class MyComponent : ScriptComponent
{
    [Attribute("defaultValue", UIWidgets.EditBox, "Description")]
    protected float m_fMyValue;
    ...
}
```

---

## `switch` with `default:` Does NOT Satisfy Return Analysis

The compiler does not treat a `default:` case as a guaranteed exit path.
Always add an explicit `return` after the `switch` block:
```c
string GetName(int index)
{
    switch (index)
    {
        case 0: return "Zero";
        case 1: return "One";
        default: return "Other";  // compiler still complains!
    }
    return "Other";  // required — add this line
}
```

---

## `[BaseContainerProps()]` Required for Inline Array Element Classes

Any class that appears as an element in a `ref array<ref T>` component attribute
must be annotated so Workbench can instantiate and edit it:
```c
[BaseContainerProps()]
class SCR_MyPattern
{
    [Attribute("0.3", UIWidgets.Slider, params: "0.05 2.0 0.05")]
    float m_fInterval;
}

class SCR_MyComponent : ScriptComponent
{
    [Attribute()]
    ref array<ref SCR_MyPattern> m_aPatterns;
}
```

**Pitfall:** Missing `[BaseContainerProps()]` causes Workbench error: "array property has no base class".

---

## No Closures

EnforceScript has no closures, so you cannot capture a variable in a lambda or callback.
Use member variables to pass state into callbacks:
```c
protected IEntity m_ePendingTarget;

protected void ScheduleDelete(IEntity ent)
{
    m_ePendingTarget = ent;
    GetGame().GetCallqueue().CallLater(DoDelete, 3000, false);
}

protected void DoDelete()
{
    if (m_ePendingTarget)
        SCR_EntityHelper.DeleteEntityAndChildren(m_ePendingTarget);
    m_ePendingTarget = null;
}
```

For multiple queued entities, use a member array and pop one per callback:
```c
protected ref array<IEntity> m_aPending = new array<IEntity>();

protected void DeleteOneFromQueue()
{
    for (int i = m_aPending.Count() - 1; i >= 0; i--)
    {
        IEntity e = m_aPending[i];
        m_aPending.RemoveOrdered(i);
        if (e)
        {
            SCR_EntityHelper.DeleteEntityAndChildren(e);
            return; // one per call
        }
    }
}
```
Cancel in `OnDelete`: `GetGame().GetCallqueue().Remove(DeleteOneFromQueue);`

---

## Types & Primitives

| Type | Default | Prefix | Passed by |
|------|---------|--------|-----------|
| bool | false | b | value |
| int | 0 | i | value |
| float | 0.0 | f | value |
| string | "" | s | value |
| vector | {0,0,0} | v | value |
| enum | (int) | e | value |
| array/set/map/class | null | a/m/(none) | reference |

- `string` is **never null** — check empty with `.IsEmpty()`.
- **float comparison**: never use `==`. Use `float.AlmostEqual(a, b)` (optional epsilon, default 0.0001).
- **int division floors**: `5/3 == 1`. Cast to float if decimal result needed.
- **`%` is int-only**: use `Math.Repeat()` for float modulo.
- **Vector**: Y is up (left-handed). `{X,Y,Z}`. Init from string: `vector v = "0 0 1";`

---

## Collections

```cpp
array<int> arr = {};                           // dynamic typed array
int arr2[3];                                   // static fixed-size array — fastest [] access
set<string> s = new set<string>();             // unique, unordered
map<int, string> m = new map<int, string>();
```

- `array ==` compares **references**, not content.
- To copy array of refs: use `foreach` re-insert, NOT `array.Copy()`.
- `map.Get(missingKey)` returns type default (not null/error). Use `.Contains()` first.
- `set` order not guaranteed — `.Get(0)` is not "first inserted".
- `map.Insert()` is faster than `map.Set()` for new entries. `Set()` updates existing.

---

## Casting

```cpp
// Upcast — implicit
Dog d = new Cocker();

// Downcast — explicit, returns null on failure (no exception)
Cocker c = Cocker.Cast(dog);
if (!c) return;  // always null-check

// Numeric cast truncates (does not round)
int x = 4.9;  // x == 4
```

---

## OOP Reference

### Visibility
- `public` (default): accessible everywhere.
- `protected`: class + children. **Prefer for moddability.**
- `private`: class only; children cannot access or override.

### Inheritance & Override
```cpp
class Child : Parent { }   // or "extends"
override void MyMethod() { super.MyMethod(); }  // "override" required; signature must match exactly (incl. param names)
sealed class Foo { }       // cannot inherit
sealed void Bar() { }      // cannot override
```

### Static Members
- Belong to class, not instance. Access via `ClassName.Method()`.
- **Static variables reset on every scenario start/leave** (full script reload). Do not rely on persistent static state.

### modded class
```cpp
modded class SCR_Something { }  // replaces original in hierarchy
```
- Must be in the **same module** as the original class.
- `super.Method()` — calls previous modded version. `vanilla.Method()` — calls original pre-mod version.
- Can access private members of the original.
- Multi-mod load order is **arbitrary** if no dependency declared.

### Memory / ref / ARC
- `ref` = strong reference (ARC). Use in arrays: `array<ref MyClass>`.
- **Cyclic `ref` = memory leak** (island of isolation). Fix: child holds non-`ref` parent pointer and null-checks.
- `delete obj` throws VM exception if any external reference still exists.
- `autoptr` is unnecessary — all classes inherit `Managed`.

---

## Preprocessor

```cpp
#define MY_FLAG
#ifdef MY_FLAG
    // Workbench-only or debug code
#endif
#ifndef MY_FLAG
    // ...
#endif
#include "scripts/path/file.c"
```

- `__FILE__` → relative path string of current file.
- `__LINE__` → line number string.
- `#ifdef WORKBENCH` — guards Workbench-only code paths.
- Flags set externally via `scrDefine` startup parameter.

---

## Naming Conventions

| Item | Style | Example |
|------|-------|---------|
| Class / file | PascalCase + tag | `SCR_MyClass` |
| Enum type | `TAG_E` prefix | `TAG_EMyEnum` |
| Enum values | ALL_CAPS | `VALUE_ONE` |
| Method | PascalCase | `GetHealth()` |
| Member variable | `m_` + type prefix | `m_iHealth`, `m_bActive` |
| Static variable | `s_` + type prefix | `s_iCount` |
| Const | ALL_CAPS, no prefix | `MAX_COUNT` |
| Local / param | camelCase | `health`, `playerName` |
| Global | `g_` prefix — **avoid** | — |

- Brace style: **Allman** (braces always on new lines).
- Tabs for indentation (4-space width).
- Methods separated by `//` + 96 dashes.
- Doxygen docs: `//!` with `\param`, `\return`.

### Method Order in Class (top to bottom)
1. General methods
2. `EOnFrame`
3. `EOnInit`
4. Constructor
5. Destructor

---

## Additional Pitfalls

- `switch default:` does **not** satisfy compiler return analysis — add explicit `return` after the switch block.
- `thread` in game context — not recommended. Use `GetGame().GetCallQueue().CallLater()` instead.
- `notnull` param modifier — engine throws at call site if null passed; caller must still guard before calling.
- `const` on objects **only freezes the reference** — object contents can still be modified.
- `"text" + 3` valid; `3 + "text"` is a **parse error** (left side must be string for `+`).
- Scripts outside recognised module directories (`Core`, `GameLib`, `Game`, `GameCode`, `Workbench`, `WorkbenchGame`) are **silently ignored**.
- Two methods with identical signatures (even differing only by return type) → **compile error**.
- Override parameter **names** must match exactly — mismatched names silently fail the override.
