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
