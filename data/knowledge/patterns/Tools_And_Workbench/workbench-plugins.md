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
