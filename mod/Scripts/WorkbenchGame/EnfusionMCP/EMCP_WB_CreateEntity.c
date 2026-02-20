/**
 * EMCP_WB_CreateEntity.c - Create entity from prefab in WorldEditor
 *
 * Creates a new entity from a prefab resource path at the specified position.
 * Position and rotation are passed as "x y z" strings.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_CreateEntity"
 *
 * NOTE: WorldEditorAPI.CreateEntity() is confirmed to exist in the 84-method API
 * (used by GameModeSetupConfigEntry and SCR_PrefabEditingPlugin internally).
 * The signature is: IEntitySource CreateEntity(string prefab, string name, int layerID,
 *                                              IEntitySource parent, vector pos, vector angles)
 */

class EMCP_WB_CreateEntityRequest : JsonApiStruct
{
	string prefab;
	string position;
	string rotation;
	string name;
	int layerID;

	void EMCP_WB_CreateEntityRequest()
	{
		RegV("prefab");
		RegV("position");
		RegV("rotation");
		RegV("name");
		RegV("layerID");
		layerID = -1;
	}
}

class EMCP_WB_CreateEntityResponse : JsonApiStruct
{
	string status;
	string message;
	string entityName;
	string entityClass;
	string position;

	void EMCP_WB_CreateEntityResponse()
	{
		RegV("status");
		RegV("message");
		RegV("entityName");
		RegV("entityClass");
		RegV("position");
	}
}

class EMCP_WB_CreateEntity : NetApiHandler
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
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_CreateEntityRequest();
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_CreateEntityRequest req = EMCP_WB_CreateEntityRequest.Cast(request);
		EMCP_WB_CreateEntityResponse resp = new EMCP_WB_CreateEntityResponse();

		if (req.prefab == "")
		{
			resp.status = "error";
			resp.message = "prefab parameter required (resource path, e.g. '{GUID}Prefabs/Entity.et')";
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
			resp.message = "WorldEditorAPI not available (in game mode?)";
			return resp;
		}

		vector pos = ParseVectorString(req.position);
		vector rot = ParseVectorString(req.rotation);

		// Default to layer 0 if not specified
		int targetLayer = req.layerID;
		if (targetLayer < 0)
			targetLayer = 0;

		// Entity name defaults to empty (auto-generated)
		string entityName = req.name;

		api.BeginEntityAction("CC: Create entity from prefab");

		// CreateEntity(prefab, name, layerID, parent, position, angles)
		IEntitySource entSrc = api.CreateEntity(req.prefab, entityName, targetLayer, null, pos, rot);

		if (!entSrc)
		{
			api.EndEntityAction();
			resp.status = "error";
			resp.message = "CreateEntity returned null. Check prefab path: " + req.prefab;
			return resp;
		}

		// If a name was requested but not set during creation, rename
		if (entityName != "" && entSrc.GetName() != entityName)
		{
			api.RenameEntity(entSrc, entityName);
		}

		api.EndEntityAction();

		resp.entityName = entSrc.GetName();
		resp.entityClass = entSrc.GetClassName();
		resp.position = pos[0].ToString() + " " + pos[1].ToString() + " " + pos[2].ToString();
		resp.status = "ok";
		resp.message = "Entity created from prefab: " + req.prefab;

		return resp;
	}
}
