/**
 * EMCP_WB_ModifyEntity.c - Modify entity properties and transform
 *
 * Actions: move, rotate, rename, setProperty, clearProperty
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
		else if (req.action == "setProperty")
		{
			if (req.propertyKey == "")
			{
				resp.status = "error";
				resp.message = "propertyKey parameter required for setProperty";
				return resp;
			}

			api.BeginEntityAction("Set property via NetAPI");

			BaseContainer entContainer = entSrc.ToBaseContainer();
			if (!entContainer)
			{
				api.EndEntityAction();
				resp.status = "error";
				resp.message = "Cannot get BaseContainer for entity";
				return resp;
			}

			// Build container path if propertyPath is specified
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

			bool result = api.SetVariableValue(entContainer, pathEntries, req.propertyKey, req.value);
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

			BaseContainer entContainer = entSrc.ToBaseContainer();
			if (!entContainer)
			{
				api.EndEntityAction();
				resp.status = "error";
				resp.message = "Cannot get BaseContainer for entity";
				return resp;
			}

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

			bool result = api.ClearVariableValue(entContainer, pathEntries, req.propertyKey);
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
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: move, rotate, rename, setProperty, clearProperty";
		}

		return resp;
	}
}
