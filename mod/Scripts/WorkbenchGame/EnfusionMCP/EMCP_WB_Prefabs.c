/**
 * EMCP_WB_Prefabs.c - Prefab operations handler
 *
 * Actions: createTemplate, save, getAncestor
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Prefabs"
 */

class EMCP_WB_PrefabsRequest : JsonApiStruct
{
	string action;
	string entityName;
	string templatePath;
	string addonName;

	void EMCP_WB_PrefabsRequest()
	{
		RegV("action");
		RegV("entityName");
		RegV("templatePath");
		RegV("addonName");
	}
}

class EMCP_WB_PrefabsResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	string entityName;
	string ancestorPath;

	void EMCP_WB_PrefabsResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("entityName");
		RegV("ancestorPath");
	}
}

class EMCP_WB_Prefabs : NetApiHandler
{
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
		return new EMCP_WB_PrefabsRequest();
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_PrefabsRequest req = EMCP_WB_PrefabsRequest.Cast(request);
		EMCP_WB_PrefabsResponse resp = new EMCP_WB_PrefabsResponse();
		resp.action = req.action;
		resp.entityName = req.entityName;

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

		if (req.action == "createTemplate")
		{
			if (req.entityName == "" || req.templatePath == "")
			{
				resp.status = "error";
				resp.message = "entityName and templatePath required for createTemplate";
				return resp;
			}

			// Resolve templatePath to an absolute filesystem path.
			// If addonName is provided, use $ADDONNAME:relPath notation to resolve via Workbench.
			// Otherwise treat templatePath as already absolute.
			string absTemplatePath = req.templatePath;

			if (req.addonName != "")
			{
				// Build Workbench resource path: $ADDONNAME:Prefabs/...
				string relPath = req.templatePath;
				relPath.Replace("\\", "/");
				while (relPath.StartsWith("/"))
					relPath = relPath.Substring(1, relPath.Length() - 1);

				string wbPath = "$" + req.addonName + ":" + relPath;
				string resolved;
				if (!Workbench.GetAbsolutePath(wbPath, resolved, false))
				{
					resp.status = "error";
					resp.message = "Could not resolve addon path: " + wbPath + " (addon not loaded?)";
					return resp;
				}
				resolved.Replace("\\", "/");
				absTemplatePath = resolved;
			}

			// Create parent directory if it does not exist
			int lastSlash = absTemplatePath.LastIndexOf("/");
			if (lastSlash > 0)
			{
				string absFolder = absTemplatePath.Substring(0, lastSlash + 1);
				if (!FileIO.FileExists(absFolder))
					FileIO.MakeDirectory(absFolder);
			}

			IEntitySource entSrc = FindEntityByName(api, req.entityName);
			if (!entSrc)
			{
				resp.status = "error";
				resp.message = "Entity not found: " + req.entityName;
				return resp;
			}

			api.BeginEntityAction("Create template via NetAPI");

			// Try direct first — works when entity has children or is in your addon's layer
			bool result = api.CreateEntityTemplate(entSrc, absTemplatePath);

			if (!result)
			{
				// Fallback: spawn temp entity from ancestor prefab, save that, then delete it.
				// This handles locked base-game entities that have no scene children.
				BaseContainer ancestor = entSrc.GetAncestor();
				string ancestorPath;
				if (ancestor)
					ancestorPath = ancestor.GetResourceName();

				if (ancestorPath != string.Empty)
				{
					IEntitySource tempSrc = api.CreateEntity(ancestorPath, "", api.GetCurrentEntityLayerId(), null, vector.Zero, vector.Zero);
					if (tempSrc)
					{
						result = api.CreateEntityTemplate(tempSrc, absTemplatePath);
						api.DeleteEntity(tempSrc);
					}
				}
			}

			api.EndEntityAction();

			if (result)
			{
				resp.status = "ok";
				resp.message = "Template created at: " + absTemplatePath;
			}
			else
			{
				resp.status = "error";
				resp.message = "CreateEntityTemplate returned false for path: " + absTemplatePath;
			}
		}
		else if (req.action == "save")
		{
			if (req.entityName == "")
			{
				resp.status = "error";
				resp.message = "entityName required for save action";
				return resp;
			}

			IEntitySource entSrc = FindEntityByName(api, req.entityName);
			if (!entSrc)
			{
				resp.status = "error";
				resp.message = "Entity not found: " + req.entityName;
				return resp;
			}

			bool result = api.SaveEntityTemplate(entSrc);
			if (result)
			{
				resp.status = "ok";
				resp.message = "Entity template saved for: " + req.entityName;
			}
			else
			{
				resp.status = "error";
				resp.message = "SaveEntityTemplate returned false (entity may not be a template instance)";
			}
		}
		else if (req.action == "getAncestor")
		{
			if (req.entityName == "")
			{
				resp.status = "error";
				resp.message = "entityName required for getAncestor action";
				return resp;
			}

			IEntitySource entSrc = FindEntityByName(api, req.entityName);
			if (!entSrc)
			{
				resp.status = "error";
				resp.message = "Entity not found: " + req.entityName;
				return resp;
			}

			BaseContainer ancestor = entSrc.GetAncestor();
			if (ancestor)
			{
				resp.ancestorPath = ancestor.GetResourceName();
				resp.status = "ok";
				resp.message = "Ancestor prefab: " + resp.ancestorPath;
			}
			else
			{
				resp.ancestorPath = "";
				resp.status = "ok";
				resp.message = "Entity has no ancestor (not a prefab instance)";
			}
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: createTemplate, save, getAncestor";
		}

		return resp;
	}
}
