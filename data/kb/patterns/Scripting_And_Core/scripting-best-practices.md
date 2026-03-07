# Scripting Best Practices & Performance

---

## Code Quality

### Early Return (Avoid Deep Nesting)
```c
// Bad — "Hadouken code"
if (a)
{
    if (b)
    {
        if (c) { DoThing(); }
    }
}

// Good — early return
if (!a) return;
if (!b) return;
if (!c) return;
DoThing();
```

### Cheap Checks First
Put bool variable before method call in `&&`/`||` — short-circuit evaluation avoids the call:
```c
if (m_bActive && GetGame().GetSomething()) { }  // bool checked first, method only if needed
```

### Cache Method Results
```c
// Bad — Count() called every iteration
for (int i = 0; i < arr.Count(); i++) { }

// Good
for (int i = 0, count = arr.Count(); i < count; i++) { }
```

### Prefer foreach over for
Faster and avoids manual index management:
```c
foreach (IEntity entity : m_aEntities) { }
```

### Reverse-iterate When Removing
```c
for (int i = m_aItems.Count() - 1; i >= 0; i--)
{
    if (ShouldRemove(m_aItems[i]))
        m_aItems.Remove(i);
}
```

### Cache Element Access
```c
IEntity target = m_aTargets[i];  // cache — don't access twice
if (target && target.IsActive()) DoSomething(target);
```

---

## Performance Principles

1. **Is it needed?** Remove unnecessary code.
2. **Is it misplaced?** Move to a dedicated manager (Single Responsibility Principle).
3. **Is it ill-conceived?** Avoid O(n) traversal when early exit is possible.
4. **Is it too frequent?** Use `GetGame().GetCallqueue().CallLater()` to throttle.
5. **Is it immediate?** Cache in member variable, calculate async.

### Spread Pattern (heavy work across frames)
```c
protected int m_iProcessIndex;
protected ref array<IEntity> m_aProcessList;

override protected void EOnFrame(IEntity owner, float dt)
{
    int count = Math.Min(m_iProcessIndex + 10, m_aProcessList.Count());
    for (int i = m_iProcessIndex; i < count; i++)
        Process(m_aProcessList[i]);

    m_iProcessIndex = count;
    if (m_iProcessIndex >= m_aProcessList.Count())
        m_iProcessIndex = 0;
}
```

### Expensive Operations
- `TraceMove` (raycasting) — at most one per frame; stagger across frames for multiple players.
- `Replication.FindId()` — cache result, do not call in tight loops.
- `QueryEntitiesBySphere` — throttle with `CallLater`.

---

## Script Profiling

1. Enable: **Diag Menu > Statistics > Script Profiler** — set to `frame` or `continuous`.
2. Memory allocation dump: launch with `-checkInstance`, call `DumpInstances(true)` — outputs CSV to log.

---

## Modding Best Practices

- Name modded files same as originals, place in `Modded/` subfolder mirroring original path.
- Replace `SCR_` prefix with own tag to avoid naming conflicts. Register prefix at OFPEC.
- Use `[Attribute(...)]` on new fields for Workbench-configurable properties.
- Use `protected` visibility on members — allows modded classes to extend behaviour.
- Compile with `Shift+F7`.

### Temporary Feature Flags
```c
// Runtime toggle (config-driven)
[Attribute(defvalue: "0")]
protected bool m_bActivateFeature;

// Compile-time toggle
#define TAG_ACTIVATE_FEATURE
#ifdef TAG_ACTIVATE_FEATURE
    // feature code
#endif
```
- External flag via startup arg: `-scrDefine TAG_ACTIVATE_FEATURE`
- `#ifdef WORKBENCH` — guards Workbench-only code.
- `PLATFORM_CONSOLE` — platform-specific code.
- Pitfall: Script Editor error tracking inside `#ifdef` blocks is not fully reliable.

---

## REST API

```c
// Get context
RestContext ctx = GetGame().GetRestApi().GetContext("https://example.com/");

// Make request
ctx.GET(m_Callback, "endpoint");
ctx.GET(m_Callback, "get?x=10&y=5");

// Callback class
class MyCallback : RestCallback
{
    override void OnSuccess(string data, int dataSize) { }
    override void OnError(int errorCode) { }
    override void OnTimeout() { }
}
```

- Requests are asynchronous.
- Data limit: < 1 MB.
- No custom headers supported.
- **Hold a `ref` to the callback object** — its lifetime is the scripter's responsibility.

---

## UI Hints

```c
// Create
SCR_HintUIInfo hintInfo = SCR_HintUIInfo.CreateInfo("Title", "Description");

// Show
SCR_HintManagerComponent.ShowHint(hintInfo);

// Refresh already-shown
SCR_HintManagerComponent.Refresh();
```

Key properties: `Name`, `Description`, `Icon`, `Priority`, `Duration` (-1 = manual close, 0 = default), `ShowLimit`, `IsTimerVisible`.

---

## RichText Tags

```xml
<b>bold</b>   <i>italic</i>
<color rgba="0,0,255,255">blue</color>
<color hex="0xFFFF6600">orange</color>
<color name="green">green</color>
<outline color="255,128,0,255" size="5">text</outline>
<shadow color="255,0,0" size="5" offset="5,5" opacity="0.5">text</shadow>
<image set="{GUID}path.imageset" name="IconName" scale="2" />
<font name="{GUID}path.fnt" force=1>text</font>
<p align="center">paragraph</p>
<h1 align="center">header x2</h1>   <h2>header x1.5</h2>
<br />
<action name="CharacterFire" scale="1.5" />
<key name="gamepad0:x" mode="text" />
```

- `<b>`, `<i>`, `<outline>`, `<shadow>` require SDF fonts.
- Tags must NOT overlap: `<b><i>text</b></i>` is wrong; nest properly: `<b><i>text</i></b>`.
- Avoid runtime re-wrap on long/heavily-styled text — very slow.

---

## Game Mode Setup

### Mandatory Entities (one per world)
| Type | Role |
|---|---|
| `SCR_BaseGameMode` | Root game mode entity |
| `SCR_FactionManager` | Available factions + API |
| `SCR_LoadoutManager` | Available loadouts + API |
| `SCR_RespawnSystemComponent` | On game mode entity; handles faction/loadout/spawn requests |
| `SCR_RespawnComponent` | On each player controller |

### Game States
`PREGAME` → `GAME` → `POSTGAME`
```c
// Transition to POSTGAME
SCR_GameModeEndData endData = new SCR_GameModeEndData();
endData.SetWinnerFaction(faction);
SCR_BaseGameMode.Cast(GetGame().GetGameMode()).EndGameMode(endData);
```

### Pre-made Prefabs
- FFA: `GameMode_Plain.et`, `FactionManager_FFA.et`, `LoadoutManager_FFA.et`, `SpawnPoint_FFA.et`
- US vs USSR: `FactionManager_USxUSSR.et`, `LoadoutManager_USxUSSR.et`, `SpawnPoint_USSR.et`, `SpawnPoint_US.et`

### API
```c
SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
SCR_FactionManager factionManager = SCR_FactionManager.Cast(GetGame().GetFactionManager());
SCR_LoadoutManager loadoutManager = GetGame().GetLoadoutManager();
```
