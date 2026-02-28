/**
 * EMCP_WB_ModifyEntity.c - Modify entity properties and transform
 *
 * Actions: move, rotate, rename, setProperty, clearProperty, getProperty, listProperties
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_ModifyEntity"
 */

class EMCP_WB_ModifyEntityRequest : JsonApiStruct
{
	string name;
	string action;
	string value;
	string propertyPath;
	string propertyKey;

	void EMCP_WB_ModifyEntityRequest()
	{
		RegV("name");
		RegV("action");
		RegV("value");
		RegV("propertyPath");
		RegV("propertyKey");
	}
}

class EMCP_WB_ModifyEntityResponse : JsonApiStruct
{
	string status;
	string message;
	string entityName;
	string action;

	void EMCP_WB_ModifyEntityResponse()
	{
		RegV("status");
		RegV("message");
		RegV("entityName");
		RegV("action");
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
			api.ParentEntity(parentSrc, entSrc, true);
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

			api.BeginEntityAction("Set property via NetAPI");

			// Build component path: propertyPath is the component class name (e.g. "SCR_ScenarioFrameworkLayerTaskKill")
			array<ref ContainerIdPathEntry> pathEntries = null;
			if (req.propertyPath != "")
			{
				pathEntries = {};
				array<string> pathParts = {};
				req.propertyPath.Split(".", pathParts, true);
				for (int p = 0; p < pathParts.Count(); p++)
				{
					pathEntries.Insert(new ContainerIdPathEntry(pathParts[p]));
				}
			}

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

			api.BeginEntityAction("Clear property via NetAPI");

			array<ref ContainerIdPathEntry> pathEntries = null;
			if (req.propertyPath != "")
			{
				pathEntries = {};
				array<string> pathParts = {};
				req.propertyPath.Split(".", pathParts, true);
				for (int p = 0; p < pathParts.Count(); p++)
				{
					pathEntries.Insert(new ContainerIdPathEntry(pathParts[p]));
				}
			}

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

			// Find component by class name via GetComponent(), or use entity directly
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
			string result = "";

			if (req.propertyPath != "")
			{
				IEntityComponentSource compSrc = null;
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
				int numVars = compSrc.GetNumVars();
				for (int v = 0; v < numVars; v++)
				{
					if (result != "") result += ", ";
					result += compSrc.GetVarName(v);
				}
			}
			else
			{
				int numVars = entSrc.GetNumVars();
				for (int v = 0; v < numVars; v++)
				{
					if (result != "") result += ", ";
					result += entSrc.GetVarName(v);
				}
			}

			resp.status = "ok";
			resp.message = result;
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: move, rotate, rename, reparent, setProperty, clearProperty, getProperty, listProperties";
		}

		return resp;
	}
}
