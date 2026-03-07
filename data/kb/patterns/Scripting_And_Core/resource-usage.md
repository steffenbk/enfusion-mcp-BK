# Resource Loading & Lifetime

---

## Core Rule

Resources are managed by the engine. If the script drops its `Resource` reference, the engine **may immediately dispose** the associated `BaseContainer`/`IEntitySource`. You cannot hold a `ref` to a `BaseContainer` directly.

---

## Correct Patterns

### Wrong — resource ref lost at function return
```c
static BaseContainer GetBaseContainer(ResourceName resourceName)
{
    Resource resource = Resource.Load(resourceName);
    if (!resource.IsValid()) return null;
    return resource.GetResource().ToBaseContainer();
    // resource drops here — returned BaseContainer may become null instantly
}
```

### Correct — caller holds the Resource
```c
static BaseContainer GetBaseContainer(notnull Resource resource)
{
    if (!resource.IsValid()) return null;
    return resource.GetResource().ToBaseContainer();
}

// Usage:
Resource resource = Resource.Load(m_sPrefab);
BaseContainer bc = GetBaseContainer(resource);
string name = bc.GetClassName();  // safe — resource still held
```

### Correct — loop with multiple resources
```c
array<ref Resource> resources = {};
array<BaseContainer> baseContainers = {};
foreach (ResourceName rn : resourceNames)
{
    Resource r = Resource.Load(rn);
    if (!r.IsValid()) continue;
    resources.Insert(r);                                    // keep alive
    baseContainers.Insert(r.GetResource().ToBaseContainer());
}
Process(baseContainers);
resources = null;  // safe to drop after use
```

### Exception — CreateInstanceFromContainer
Creates a `Managed` instance; the resource ref can be dropped after:
```c
static Managed CreateInstanceFromPrefab(ResourceName prefab)
{
    Resource resource = Resource.Load(prefab);
    if (!resource.IsValid()) return null;
    BaseContainer bc = resource.GetResource().ToBaseContainer();
    if (!bc) return null;
    return BaseContainerTools.CreateInstanceFromContainer(bc);
    // resource can drop here — Managed instance persists independently
}
```

### Component member resource cache
```c
protected ref Resource m_NodeRes;

override protected void EOnInit(IEntity owner)
{
    m_NodeRes = Resource.Load(m_rPrefabPath);  // held for lifetime of component
}
```
Must be `ref` or GC drops the object before first use.

---

## Pitfalls

- **`ref BaseContainer m_bc;` is illegal** — BaseContainer cannot be ref-held. Only `Resource` can.
- **Local `Resource` variable + returned `BaseContainer`** = instant null risk.
- **`Resource.Load()` on invalid path** — always check `resource.IsValid()` before use.
