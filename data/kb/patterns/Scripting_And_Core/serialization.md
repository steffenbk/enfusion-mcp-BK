# Serialization & JSON

---

## JSON Serialization (SCR_JsonSaveContext / SCR_JsonLoadContext)

```c
// Save
SCR_JsonSaveContext saveContext = new SCR_JsonSaveContext();
saveContext.WriteValue("key1", stringValue);
saveContext.WriteValue("key2", integerValue);
string dataString = saveContext.ExportToString();

// Load (JSON is order-independent)
SCR_JsonLoadContext loadContext = new SCR_JsonLoadContext();
loadContext.ImportFromString(dataString);
loadContext.ReadValue("key1", stringValue);
loadContext.ReadValue("key2", integerValue);
```

- Passing empty string as key allows writing/reading a complex top-level struct.

---

## Binary Serialization (SCR_BinSaveContext / SCR_BinLoadContext)

```c
// Save
SCR_BinSaveContext saveContext = new SCR_BinSaveContext();
saveContext.WriteValue("key1", stringValue);
saveContext.SaveToFile("file.bin");

// Load — ORDER MATTERS (names ignored in binary)
SCR_BinLoadContext loadContext = new SCR_BinLoadContext();
loadContext.LoadFromFile("file.bin");
loadContext.ReadValue("key1", stringValue);  // must match write order exactly
```

---

## Object Serialization

### Simple (automatic — all fields serialized)
```c
class MyClass : Managed
{
    protected int m_iVariable = 42;
    protected string m_sVariable;
    protected float m_fVariable = 33.3;
}
```
- Classes must have **no constructor parameters** — they cannot be deserialized otherwise.
- Exclude a field: `[NonSerialized()] protected float m_fVariable;`
  - `[NonSerialized()]` is ignored by `SerializationSave`/`SerializationLoad` — only works with automatic path.

### Advanced (custom control)
```c
bool SerializationSave(BaseSerializationSaveContext context)
{
    if (!context.IsValid()) return false;
    context.WriteValue("theString", m_sVariable);
    context.WriteValue("integer", m_iVariable);
    return true;
}

bool SerializationLoad(BaseSerializationLoadContext context)
{
    if (!context.IsValid()) return false;
    context.ReadValue("theString", m_sVariable);
    context.ReadValue("integer", m_iVariable);
    return true;
}
```
- Defining either method **disables automatic property processing** entirely.

---

## JsonApiStruct

### Purpose
Encodes/decodes script objects to/from JSON, file import/export, and acts as callback object for Backend/REST API responses.

### Declaration
```c
class MyObject : JsonApiStruct
{
    string name;
    string year;

    void MyObject()
    {
        RegV("name");  // case-sensitive; non-registered vars are ignored
        RegV("year");
    }
}
```

### Nested Objects
```c
class MyParent : JsonApiStruct
{
    MyChild obj1;
    void MyParent()
    {
        obj1 = new MyChild();  // must pre-allocate before RegV
        RegV("obj1");
    }
}
```

### File Operations
```c
dummy.ExpandFromRAW(data);       // parse from JSON string
dummy.SaveToFile("file.json");   // save already-packed JSON
dummy.PackToFile("file.json");   // pack then save
dummy.LoadFromFile("file.json"); // load + auto-expand
Print(dummy.AsString());
```

### Manual Packing (OnPack)
```c
void OnPack()
{
    StoreFloat("MyFloat", m_fMyFloat);
    StoreInt("MyInt", m_iMyInt);
    StoreObject("avatar", m_Avatar);

    StartArray("m_aItems");
    foreach (string item : m_aItems)
        ItemString(item);
    EndArray();
}
```

### Supported Types
float, int, bool, string, array, object, array of objects.
**Not supported:** multi-type arrays (mixed strings and ints in one array).

### Error Handling Events
```c
void OnExpand() { }           // called before expand starts
void OnBufferReady() { }      // called after successful pack
void OnSuccess(int errorCode) { }   // EJsonApiError.ETJSON_OK
void OnError(int errorCode) { }     // various EJsonApiError codes
```

### EJsonApiError Codes
| Code | Meaning |
|---|---|
| `ETJSON_OK` | Success |
| `ETJSON_PARSERERROR` | Invalid/corrupt JSON |
| `ETJSON_TIMEOUT` | Timeout on REST send |
| `ETJSON_NOBUFFERS` | Too many objects at once |
| `ETJSON_FAILFILELOAD` | Could not load file |
| `ETJSON_FAILFILESAVE` | Could not save file |

### Validation Pattern
```c
dummy.Pack();
string data1 = dummy.AsString();
dummy.ExpandFromRAW(data1);
dummy.Pack();
string data2 = dummy.AsString();
// data1 == data2 confirms structure is stable
```

---

## Pitfalls

- **Binary serialization is order-sensitive**: `ReadValue` calls must match `WriteValue` order exactly — names ignored.
- **Serializable classes must have no-arg constructors**: Classes deserialized via load contexts must be constructable with zero args.
- **`[NonSerialized()]` ignored by `SerializationSave`/`Load`**: Only works with automatic serialization path.
- **JsonApiStruct child objects must be pre-allocated**: Null registered child → silent skip on expand.
- **JsonApiStruct multi-type arrays not supported**: Mixed-type arrays are valid JSON but not in EnforceScript.
