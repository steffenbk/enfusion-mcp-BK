# Workbench Plugins & WorldEditor API

---

## WorldEditorPlugin Structure

```c
[WorkbenchPluginAttribute(
    name: "My Plugin",
    description: "...",
    shortcut: "Ctrl+Shift+X",
    wbModules: {"WorldEditor"},
    awesomeFontCode: 0xF0C5   // FontAwesome hex, needs 0x prefix
)]
class TC_MyPlugin : WorldEditorPlugin
{
    [Attribute(defvalue: "Prefabs/Generated", desc: "...")]
    string m_sOutputFolder;

    override void Run()
    {
        // Called when plugin is invoked. Show a ScriptDialog here if you
        // want to prompt for settings before executing.
        Workbench.ScriptDialog("Title", "Description text.", this);
    }

    [ButtonAttribute("Do The Thing")]
    void DoTheThing()
    {
        // Actual work goes here. [ButtonAttribute] methods appear as
        // buttons inside the ScriptDialog shown in Run().
    }

    override void Configure()
    {
        // Called from Plugins > Settings > MyPlugin.
        Workbench.ScriptDialog("My Plugin — Settings", "Description.", this);
    }
}
```

**Key rules:**
- Plugin is only visible in the Plugins menu if `Run()` contains code (even just a dialog call).
- `[Attribute()]` fields on the class are auto-rendered in `ScriptDialog` and persisted in Windows registry.
- `[ButtonAttribute("Label")]` methods appear as extra buttons in the dialog.
- `wbModules: {"WorldEditor"}` restricts plugin to World Editor only.

---

## Getting WorldEditor and API

```c
// Local variables only — do NOT store as ref members
WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
WorldEditorAPI api = worldEditor.GetApi();
```

---

## Resolving Addon-Relative Paths

```c
// Correct method: Workbench.GetAbsolutePath (NOT GetAbsPath — does not exist)
// Third param mustExist=false lets you check a path that may not exist yet
string absPath;
bool exists = Workbench.GetAbsolutePath("$TESTINGCLAUD:Prefabs/Generated", absPath, false);
```

Use `mustExist: false` to check existence without an error. Returns `false` if the path
doesn't resolve (addon not loaded, or folder doesn't exist when mustExist=true).

---

## Creating Folders at Runtime

`FileIO.MakeDirectory` works correctly in WorkbenchGame context (confirmed):

```c
string absFolder = "C:/path/to/addon/Prefabs/Generated/";
if (!FileIO.FileExists(absFolder))
    FileIO.MakeDirectory(absFolder);
```

Do NOT use `Workbench.RunCmd("mkdir ...")` — unreliable for paths with spaces.

---

## Creating Prefabs from Selected Scene Entities (inc. base-game instances)

`api.CreateEntityTemplate(entSrc, absPath)` fails with "Resource file registration failed"
when called directly on a locked base-game prefab instance in the scene.

**Working pattern** — try direct first (preserves children), fall back to temp entity:

```c
api.BeginEntityAction("Create Prefab: " + entityName);

// Try direct — works when entity has scene-level children or is in your addon's layer
bool result = api.CreateEntityTemplate(entSrc, absPath);

if (!result)
{
    // Fall back: spawn a fresh temp entity from the ancestor prefab, save it, delete it.
    // Works for simple base-game entities with no children.
    BaseContainer ancestor = entSrc.GetAncestor();
    string ancestorPath;
    if (ancestor)
        ancestorPath = ancestor.GetResourceName();

    if (ancestorPath != string.Empty)
    {
        IEntitySource tempSrc = api.CreateEntity(ancestorPath, "", api.GetCurrentEntityLayerId(), null, vector.Zero, vector.Zero);
        if (tempSrc)
        {
            result = api.CreateEntityTemplate(tempSrc, absPath);
            api.DeleteEntity(tempSrc);  // DeleteEntity takes IEntitySource, NOT IEntity
        }
    }
}

api.EndEntityAction();
```

**Why:** `CreateEntityTemplate` on a scene entity that has children captures the full
hierarchy. The temp-entity fallback only saves the ancestor prefab state (no scene children).

---

## ScriptDialog Return Value

```c
int result = Workbench.ScriptDialog("Title", "Text", this);
// result == 1 → OK clicked
// result == 0 → Cancel clicked
// BUT: [ButtonAttribute] methods run immediately when clicked, before ScriptDialog returns.
// So don't rely on the return value to gate execution — put logic in the button method.
```

---

## api.DeleteEntity Signature

```c
// Takes IEntitySource — NOT IEntity
api.DeleteEntity(entitySource);          // correct
api.DeleteEntity(api.SourceToEntity(s)); // compile error — types are unrelated
```

---

## Script Editor Key Shortcuts

| Shortcut | Function |
|---|---|
| F7 | Compile |
| F5 | Debug: Continue |
| F9 | Insert/Remove Breakpoint |
| F10 | Step Over |
| F11 | Step Into |
| Shift+F11 | Step Out |
| Ctrl+Space | Autocomplete |
| Ctrl+Shift+F | Find in Files |
| Alt+Shift+S | Find Symbol |
| Alt+Shift+O | Find File |
| Ctrl+G | Jump to Line |
| Ctrl+D | Duplicate Line |

- Breakpoints become **invalidated** when running game code doesn't match editor code (out-of-sync compilation).
- Console: execute code at current stack context. Results appear in Output.
- Debugger connects automatically on default port when Script Editor opens while game runs.

---

## Script Editor Plugin API

```c
[WorkbenchPluginAttribute(name: "...", wbModules: { "ScriptEditor" })]
class TAG_MyScriptPlugin : ScriptEditorPlugin
{
    override void Run() { }
    override void Configure() { }

    // Key ScriptEditor module methods:
    // GetCurrentLine() → int (0-based)
    // GetLineText(out string text)
    // SetLineText(string text)  ← each call = one undo entry
}
```

- Script goes in `WorkbenchGame/ScriptEditor/`, class name must end with `Plugin`.
- For localization editor plugins: inherit `LocalizationEditorPlugin`, use `wbModules: { "LocalizationEditor" }`.

---

## Code Formatter Plugin (SCR_BasicCodeFormatterPlugin)

- **Ctrl+Shift+K** — format current file or selected addon.
- **Ctrl+Alt+Shift+K** — force all lines.

Auto-fixes: trailing spaces, 4-spaces→tab, method separators, semicolons after class-closing braces, final newline, `if(` → `if (`.

Warns about: `new ref`, `array<T> x = new array<T>()` (use `{}`), `auto`/`autoptr`, division that could be multiplication, unbracketed loops, wrongly-prefixed variables, raw `ScriptInvoker` usage, `Print()` without log level.

---

## Fill From Template Plugin (SCR_ScriptTemplatePlugin)

- **Ctrl+T** — insert class skeleton.
- Types: `None`, `Entity`, `Component`, `WidgetComponent`, `ScriptInvoker`, `ScriptedUserAction`, `UIMenu`, `ConfigRoot`, `WorkbenchPlugin`, `WorldEditorTool`.

---

## Object Brush Scripted Tool

- Config: `SCR_ObjectBrushArrayConfig` — drag to Objects Config field. Samples in `Configs/Workbench/ObjectBrush`.
- Key settings: `Radius` (m), `Strength` (entities/hectare = 100×100m), `Scale Fall Off Curve`, `Density Fall Off`.
- Per-prefab: `Weight` (probability; 0 = ignored), `Align To Normal`, random Pitch/Roll/Yaw, `Prefab Offset Y`.
- Obstacle avoidance: `Avoid Objects`, `Avoid Roads`, `Avoid Rivers`, `Avoid Power Lines`, `Avoid Land/Ocean`, `Avoid Forests`, `Avoid Lakes`.

---

## String Editor

- Create `*.st` via Resource Browser → right-click → GUI String table.
- After editing: **Table → Build Runtime Table (Ctrl+B)** — required for in-game use.

### Translation ID Convention
Format: `[ProductCode]-[GameProject]-[PascalCasedName]`
Example: `AR-MainMenu`, `AR-MainMenu_Options`

### Writing Rules
- Never hardcode text in UI/data/code.
- Use `%1`, `%2` for arguments; `%%` for literal `%`.
- **Never assemble sentences from multiple fragments** — word order differs between languages.
  - BAD: `Hold %1 to %2` + `Space` + `Take weapon`
  - GOOD: `Hold %1 to take weapon` (single complete phrase)
- Document `%N` arguments in the Comment field.

---

## Editor Entity Naming (In-game Display Names)

Format: `[Size] [Colour] [Base Descriptor] - [Hyphenated Adjectives]`
- Size: Miniature / Small / Medium / Large / Massive
- Colour list: Red, Orange, Yellow, Green, Cyan, Blue, Magenta, Purple, White, Black, Gray, Silver, Pink, Maroon, Brown, Beige, Tan, Peach, Lime, Olive, Turquoise, Teal, Navy blue, Indigo, Violet.
- Base descriptor: noun-first, avoid prepositions. Adjectives of state appended as `- Adjective`.
- All names in Title Case.
