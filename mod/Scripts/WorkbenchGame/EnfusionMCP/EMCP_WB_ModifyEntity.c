/**
 * EMCP_WB_ModifyEntity.c - Modify entity properties and transform
 *
 * Actions: move, rotate, rename, setProperty, clearProperty, getProperty, listProperties,
 *          listArrayItems, addArrayItem, removeArrayItem, setObjectClass
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_ModifyEntity"
 */

class EMCP_WB_ModifyEntityRequest : JsonApiStruct
{
	string name;
	string action;
	string value;
	string propertyPath;
	string propertyKey;
	int    memberIndex;

	void EMCP_WB_ModifyEntityRequest()
	{
		RegV("name");
		RegV("action");
		RegV("value");
		RegV("propertyPath");
		RegV("propertyKey");
		RegV("memberIndex");
	}
}

class EMCP_WB_EntityProperty
{
	string m_sName;
	string m_sType;
	string m_sValue;
}

class EMCP_WB_ModifyEntityResponse : JsonApiStruct
{
	string status;
	string message;
	string entityName;
	string action;
	ref array<ref EMCP_WB_EntityProperty> m_aProperties;

	void EMCP_WB_ModifyEntityResponse()
	{
		RegV("status");
		RegV("message");
		RegV("entityName");
		RegV("action");
		m_aProperties = {};
	}

	override void OnPack()
	{
		if (m_aProperties.Count() > 0)
		{
			StartArray("properties");
			for (int i = 0; i < m_aProperties.Count(); i++)
			{
				EMCP_WB_EntityProperty p = m_aProperties[i];
				StartObject("");
				StoreString("name", p.m_sName);
				StoreString("type", p.m_sType);
				StoreString("value", p.m_sValue);
				EndObject();
			}
			EndArray();
		}
	}
}

class EMCP_WB_ModifyEntity : NetApiHandler
{
	//------------------------------------------------------------------------------------------------
	static vector ParseVectorString(string str)
	{
		vector result = "0 0 0";
		if (str == "")
			return result;

		array<string> parts = {};
		str.Split(" ", parts, true);
		if (parts.Count() >= 3)
		{
			result[0] = parts[0].ToFloat();
			result[1] = parts[1].ToFloat();
			result[2] = parts[2].ToFloat();
		}
		return result;
	}

	//------------------------------------------------------------------------------------------------
	static IEntitySource FindEntityByName(WorldEditorAPI api, string name)
	{
		int count = api.GetEditorEntityCount();
		for (int i = 0; i < count; i++)
		{
			IEntitySource candidate = api.GetEditorEntity(i);
			if (candidate && candidate.GetName() == name)
				return candidate;
		}
		return null;
	}

	//------------------------------------------------------------------------------------------------
	// Build a ContainerIdPathEntry array from a dot-separated path string.
	// Supports array indices: "m_aTriggerActions[0].m_aNames" produces
	//   ContainerIdPathEntry("m_aTriggerActions", 0) then ContainerIdPathEntry("m_aNames").
	// Returns null if the path is empty (meaning target the entity root).
	static array<ref ContainerIdPathEntry> BuildPathEntries(string propertyPath)
	{
		if (propertyPath == "")
			return null;

		array<ref ContainerIdPathEntry> pathEntries = {};
		array<string> pathParts = {};
		propertyPath.Split(".", pathParts, true);
		for (int p = 0; p < pathParts.Count(); p++)
		{
			string part = pathParts[p];
			int bracketPos = part.IndexOf("[");
			if (bracketPos > -1)
			{
				int closeBracket = part.IndexOf("]");
				if (closeBracket <= bracketPos)
				{
					// Malformed bracket syntax — treat the whole part as a plain name
					pathEntries.Insert(new ContainerIdPathEntry(part));
					continue;
				}
				string name = part.Substring(0, bracketPos);
				string idxStr = part.Substring(bracketPos + 1, closeBracket - bracketPos - 1);
				int idx = idxStr.ToInt();
				pathEntries.Insert(new ContainerIdPathEntry(name, idx));
			}
			else
			{
				pathEntries.Insert(new ContainerIdPathEntry(part));
			}
		}
		return pathEntries;
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ModifyEntityRequest();
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ModifyEntityRequest req = EMCP_WB_ModifyEntityRequest.Cast(request);
		EMCP_WB_ModifyEntityResponse resp = new EMCP_WB_ModifyEntityResponse();
		resp.action = req.action;

		if (req.name == "")
		{
			resp.status = "error";
			resp.message = "name parameter required";
			return resp;
		}

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "error";
			resp.message = "WorldEditor module not available";
			return resp;
		}

		WorldEditorAPI api = worldEditor.GetApi();
		if (!api)
		{
			resp.status = "error";
			resp.message = "WorldEditorAPI not available";
			return resp;
		}

		IEntitySource entSrc = FindEntityByName(api, req.name);
		if (!entSrc)
		{
			resp.status = "error";
			resp.message = "Entity not found: " + req.name;
			return resp;
		}

		resp.entityName = entSrc.GetName();

		if (req.action == "move")
		{
			vector pos = ParseVectorString(req.value);
			IEntity ent = api.SourceToEntity(entSrc);
			if (!ent)
			{
				resp.status = "error";
				resp.message = "Cannot get runtime entity for transform update";
				return resp;
			}

			api.BeginEntityAction("Move entity via NetAPI");

			// Set position via SetVariableValue on the coords property
			BaseContainer entContainer = entSrc.ToBaseContainer();
			if (entContainer)
			{
				api.SetVariableValue(entContainer, null, "coords", req.value);
			}

			api.EndEntityAction();
			resp.status = "ok";
			resp.message = "Entity moved to " + req.value;
		}
		else if (req.action == "rotate")
		{
			vector angles = ParseVectorString(req.value);
			IEntity ent = api.SourceToEntity(entSrc);
			if (!ent)
			{
				resp.status = "error";
				resp.message = "Cannot get runtime entity for rotation update";
				return resp;
			}

			api.BeginEntityAction("Rotate entity via NetAPI");

			BaseContainer entContainer = entSrc.ToBaseContainer();
			if (entContainer)
			{
				api.SetVariableValue(entContainer, null, "angleX", angles[0].ToString());
				api.SetVariableValue(entContainer, null, "angleY", angles[1].ToString());
				api.SetVariableValue(entContainer, null, "angleZ", angles[2].ToString());
			}

			api.EndEntityAction();
			resp.status = "ok";
			resp.message = "Entity rotated to " + req.value;
		}
		else if (req.action == "rename")
		{
			if (req.value == "")
			{
				resp.status = "error";
				resp.message = "value parameter required for rename (new name)";
				return resp;
			}

			api.BeginEntityAction("Rename entity via NetAPI");
			bool renamed = api.RenameEntity(entSrc, req.value);
			api.EndEntityAction();

			if (renamed)
			{
				resp.status = "ok";
				resp.message = "Entity renamed to: " + req.value;
			}
			else
			{
				resp.status = "error";
				resp.message = "RenameEntity returned false";
			}
		}
		else if (req.action == "reparent")
		{
			if (req.value == "")
			{
				resp.status = "error";
				resp.message = "value parameter required for reparent (parent entity name)";
				return resp;
			}

			IEntitySource parentSrc = FindEntityByName(api, req.value);
			if (!parentSrc)
			{
				resp.status = "error";
				resp.message = "Parent entity not found: " + req.value;
				return resp;
			}

			api.BeginEntityAction("Reparent entity via NetAPI");
			api.ParentEntity(parentSrc, entSrc, false); // false = keep local coords (0 0 0), true would convert world pos causing offset
			api.EndEntityAction();

			resp.status = "ok";
			resp.message = "Entity reparented to: " + req.value;
		}
		else if (req.action == "setProperty")
		{
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey parameter required for setProperty";
				return resp;
			}

			array<ref ContainerIdPathEntry> pathEntries = BuildPathEntries(req.propertyPath);

			api.BeginEntityAction("Set property via NetAPI");
			bool result = api.SetVariableValue(entSrc, pathEntries, req.propertyKey, req.value);
			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Property '" + req.propertyKey + "' set to '" + req.value + "'";
			}
			else
			{
				resp.status = "error";
				resp.message = "SetVariableValue returned false for key: " + req.propertyKey;
			}
		}
		else if (req.action == "clearProperty")
		{
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey parameter required for clearProperty";
				return resp;
			}

			array<ref ContainerIdPathEntry> pathEntries = BuildPathEntries(req.propertyPath);

			api.BeginEntityAction("Clear property via NetAPI");
			bool result = api.ClearVariableValue(entSrc, pathEntries, req.propertyKey);
			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Property '" + req.propertyKey + "' cleared";
			}
			else
			{
				resp.status = "error";
				resp.message = "ClearVariableValue returned false for key: " + req.propertyKey;
			}
		}
		else if (req.action == "getProperty")
		{
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey parameter required for getProperty";
				return resp;
			}

			// WorldEditorAPI has no GetVariableValue — use IEntityComponentSource.Get() instead.
			IEntityComponentSource compSrc = null;
			if (req.propertyPath != "")
			{
				int compCount = entSrc.GetComponentCount();
				for (int ci = 0; ci < compCount; ci++)
				{
					IEntityComponentSource c = entSrc.GetComponent(ci);
					if (c && c.GetClassName() == req.propertyPath)
					{
						compSrc = c;
						break;
					}
				}
				if (!compSrc)
				{
					resp.status = "error";
					resp.message = "Component not found: " + req.propertyPath;
					return resp;
				}
			}

			string val;
			if (compSrc)
				compSrc.Get(req.propertyKey, val);
			else
				entSrc.Get(req.propertyKey, val);

			resp.status = "ok";
			resp.message = val;
		}
		else if (req.action == "listProperties")
		{
			IEntityComponentSource compSrc = null;
			if (req.propertyPath != "")
			{
				int compCount = entSrc.GetComponentCount();
				for (int ci = 0; ci < compCount; ci++)
				{
					IEntityComponentSource c = entSrc.GetComponent(ci);
					if (c && c.GetClassName() == req.propertyPath)
					{
						compSrc = c;
						break;
					}
				}
				if (!compSrc)
				{
					resp.status = "error";
					resp.message = "Component not found: " + req.propertyPath;
					return resp;
				}
			}

			int numVars;
			if (compSrc)
				numVars = compSrc.GetNumVars();
			else
				numVars = entSrc.GetNumVars();

			for (int v = 0; v < numVars; v++)
			{
				string varName;
				if (compSrc)
					varName = compSrc.GetVarName(v);
				else
					varName = entSrc.GetVarName(v);
				string varValue = "";
				if (compSrc)
					compSrc.Get(varName, varValue);
				else
					entSrc.Get(varName, varValue);

				EMCP_WB_EntityProperty prop = new EMCP_WB_EntityProperty();
				prop.m_sName = varName;
				prop.m_sType = "";  // type info not available via script API — leave empty
				prop.m_sValue = varValue;
				resp.m_aProperties.Insert(prop);
			}

			resp.status = "ok";
			resp.message = "Listed " + resp.m_aProperties.Count().ToString() + " properties";
			if (req.propertyPath != "")
				resp.message = resp.message + " of " + req.propertyPath;
		}
		else if (req.action == "listArrayItems")
		{
			// Reads an array-of-objects property and returns each item's class name and index.
			// propertyPath = component class name (or "" for entity level)
			// propertyKey  = array property name (e.g. "Slots", "m_aTriggerActions")
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey (array name) required for listArrayItems";
				return resp;
			}

			IEntityComponentSource compSrc2 = null;
			if (req.propertyPath != "")
			{
				int cc2 = entSrc.GetComponentCount();
				for (int ci2 = 0; ci2 < cc2; ci2++)
				{
					IEntityComponentSource c2 = entSrc.GetComponent(ci2);
					if (c2 && c2.GetClassName() == req.propertyPath)
					{
						compSrc2 = c2;
						break;
					}
				}
				if (!compSrc2)
				{
					resp.status = "error";
					resp.message = "Component not found: " + req.propertyPath;
					return resp;
				}
			}

			BaseContainerList itemList = null;
			if (compSrc2)
				itemList = compSrc2.GetObjectArray(req.propertyKey);
			else
				itemList = entSrc.GetObjectArray(req.propertyKey);

			if (!itemList)
			{
				resp.status = "ok";
				resp.message = "[] (empty or not an object array)";
				return resp;
			}

			string listResult = "";
			int itemCount = itemList.Count();
			for (int li = 0; li < itemCount; li++)
			{
				BaseContainer item = itemList.Get(li);
				string className = "";
				if (item)
					className = item.GetClassName();
				else
					className = "(null)";
				if (listResult != "") listResult += ", ";
				listResult += li.ToString() + ":" + className;
			}

			resp.status = "ok";
			resp.message = "[" + listResult + "] (" + itemCount.ToString() + " items)";
		}
		else if (req.action == "addArrayItem")
		{
			// Creates a new element in an array-of-objects property (the + button in the editor).
			// propertyPath = component class name (or "" for entity level)
			// propertyKey  = array property name (e.g. "m_aTriggerActions")
			// value        = class name of the new item (e.g. "SCR_ScenarioFrameworkActionSpawnObjects")
			// memberIndex  = index to insert at (-1 = append at end)
			if (req.propertyKey == "" || req.value == "")
			{
				resp.status = "error";
				resp.message = "propertyKey (array name) and value (item class name) required for addArrayItem";
				return resp;
			}

			// Use component as topLevel if propertyPath is a component class name.
			// NOTE: CreateObjectArrayVariableMember requires the component as topLevel with null path —
			// passing the entity with a path entry returns false for component arrays.
			BaseContainer addTopLevel = entSrc;
			array<ref ContainerIdPathEntry> pathEntries = null;
			if (req.propertyPath != "")
			{
				int addCC = entSrc.GetComponentCount();
				for (int addCI = 0; addCI < addCC; addCI++)
				{
					IEntityComponentSource addC = entSrc.GetComponent(addCI);
					if (addC && addC.GetClassName() == req.propertyPath)
					{
						addTopLevel = addC;
						break;
					}
				}
				// If not found as component, fall back to path entries
				if (addTopLevel == entSrc)
					pathEntries = BuildPathEntries(req.propertyPath);
			}

			int insertIdx = req.memberIndex;
			if (insertIdx < 0)
				insertIdx = -1; // will be treated as append by the API

			api.BeginEntityAction("Add array item via NetAPI");
			bool result = api.CreateObjectArrayVariableMember(addTopLevel, pathEntries, req.propertyKey, req.value, insertIdx);
			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Added '" + req.value + "' to '" + req.propertyKey + "' at index " + insertIdx;
			}
			else
			{
				resp.status = "error";
				resp.message = "CreateObjectArrayVariableMember returned false — check class name and property key";
			}
		}
		else if (req.action == "removeArrayItem")
		{
			// Removes an element from an array-of-objects property by index.
			// propertyPath = component class name (or "" for entity level)
			// propertyKey  = array property name
			// memberIndex  = 0-based index to remove
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey (array name) required for removeArrayItem";
				return resp;
			}

			// Use component as topLevel if propertyPath is a component class name.
			// NOTE: RemoveObjectArrayVariableMember requires the component as topLevel with null path —
			// passing the entity with a path entry returns false for component arrays.
			BaseContainer removeTopLevel = entSrc;
			array<ref ContainerIdPathEntry> removePathEntries = null;
			if (req.propertyPath != "")
			{
				int removeCC = entSrc.GetComponentCount();
				for (int removeCI = 0; removeCI < removeCC; removeCI++)
				{
					IEntityComponentSource removeC = entSrc.GetComponent(removeCI);
					if (removeC && removeC.GetClassName() == req.propertyPath)
					{
						removeTopLevel = removeC;
						break;
					}
				}
				if (removeTopLevel == entSrc)
					removePathEntries = BuildPathEntries(req.propertyPath);
			}

			// Safety check: if the array is only inherited (not set directly on this container),
			// RemoveObjectArrayVariableMember will crash Workbench. Refuse with a clear error.
			BaseContainerList removeCheckList = removeTopLevel.GetObjectArray(req.propertyKey);
			int removeCheckCount = 0;
			if (removeCheckList)
				removeCheckCount = removeCheckList.Count();

			BaseContainer removeAncestor = removeTopLevel.GetAncestor();
			int ancestorCount = 0;
			if (removeAncestor)
			{
				BaseContainerList ancestorList = removeAncestor.GetObjectArray(req.propertyKey);
				if (ancestorList)
					ancestorCount = ancestorList.Count();
			}

			if (!removeTopLevel.IsVariableSetDirectly(req.propertyKey) && removeCheckCount == ancestorCount)
			{
				resp.status = "error";
				resp.message = "Cannot remove from '" + req.propertyKey + "': all items are inherited from a parent prefab. " +
					"Edit the .et file directly and set an empty '" + req.propertyKey + " {}' block to override inherited items.";
				return resp;
			}

			api.BeginEntityAction("Remove array item via NetAPI");
			bool result = api.RemoveObjectArrayVariableMember(removeTopLevel, removePathEntries, req.propertyKey, req.memberIndex);
			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Removed index " + req.memberIndex + " from '" + req.propertyKey + "'";
			}
			else
			{
				resp.status = "error";
				resp.message = "RemoveObjectArrayVariableMember returned false — check index and property key";
			}
		}
		else if (req.action == "setObjectClass")
		{
			// Changes the class of an existing object property or array element (the dropdown in the editor).
			// propertyPath = component class name (e.g. "SCR_ScenarioFrameworkArea")
			// propertyKey  = property name of the object whose class is being changed
			// value        = new class name
			// The full path to the target is propertyPath + propertyKey.
			if (req.propertyKey == "" || req.value == "")
			{
				resp.status = "error";
				resp.message = "propertyKey and value (new class name) required for setObjectClass";
				return resp;
			}

			// Build path including propertyKey so ChangeObjectClass targets the correct object
			string fullPath = req.propertyPath;
			if (fullPath != "")
				fullPath += ".";
			fullPath += req.propertyKey;

			array<ref ContainerIdPathEntry> pathEntries = BuildPathEntries(fullPath);

			api.BeginEntityAction("Set object class via NetAPI");
			bool result = api.ChangeObjectClass(entSrc, pathEntries, req.value);
			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Changed class of '" + req.propertyKey + "' to '" + req.value + "'";
			}
			else
			{
				resp.status = "error";
				resp.message = "ChangeObjectClass returned false — check class name";
			}
		}
		else if (req.action == "getWorldTransform")
		{
			// Read position and rotation using known property names from the editor.
			// "coords" = world position, "angleX/Y/Z" = euler rotation angles.
			// These are confirmed: "move" uses "coords" for SetVariableValue, "rotate" uses angleX/Y/Z.
			string coords, angleX, angleY, angleZ;
			entSrc.Get("coords", coords);
			entSrc.Get("angleX", angleX);
			entSrc.Get("angleY", angleY);
			entSrc.Get("angleZ", angleZ);

			EMCP_WB_EntityProperty posProp = new EMCP_WB_EntityProperty();
			posProp.m_sName = "position";
			posProp.m_sType = "vector";
			posProp.m_sValue = coords;
			resp.m_aProperties.Insert(posProp);

			EMCP_WB_EntityProperty rotProp = new EMCP_WB_EntityProperty();
			rotProp.m_sName = "rotation";
			rotProp.m_sType = "vector";
			rotProp.m_sValue = angleX + " " + angleY + " " + angleZ;
			resp.m_aProperties.Insert(rotProp);

			resp.status = "ok";
			resp.message = "Transform for: " + req.name;
		}
		else if (req.action == "makeVisible")
		{
			// WorldEditorAPI has no AddToEntitySelection / SetSelectedEntity in the public script API.
			// Return entity position so the user knows where to look. The entity is confirmed to exist.
			string coords;
			entSrc.Get("coords", coords);

			resp.status = "ok";
			resp.message = "Entity '" + req.name + "' found at position " + coords + ". Use wb_entity_select or manually select in hierarchy.";
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: move, rotate, rename, reparent, setProperty, clearProperty, getProperty, listProperties, listArrayItems, addArrayItem, removeArrayItem, setObjectClass, getWorldTransform, makeVisible";
		}

		return resp;
	}
}
