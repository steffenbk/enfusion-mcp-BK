/**
 * EMCP_WB_GetState.c - Full state snapshot handler
 *
 * Returns a comprehensive snapshot of the current Workbench/WorldEditor state.
 * No request parameters needed.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_GetState"
 */

class EMCP_WB_GetStateRequest : JsonApiStruct
{
	void EMCP_WB_GetStateRequest()
	{
		// No request parameters
	}
}

class EMCP_WB_GetStateResponse : JsonApiStruct
{
	string status;
	string message;
	string mode;
	int entityCount;
	int selectedCount;
	int currentSubScene;
	bool isPrefabEditMode;
	string boundsMin;
	string boundsMax;

	// Selected entity names
	ref array<string> m_aSelectedNames;

	void EMCP_WB_GetStateResponse()
	{
		RegV("status");
		RegV("message");
		RegV("mode");
		RegV("entityCount");
		RegV("selectedCount");
		RegV("currentSubScene");
		RegV("isPrefabEditMode");
		RegV("boundsMin");
		RegV("boundsMax");

		m_aSelectedNames = {};
	}

	override void OnPack()
	{
		StartArray("selectedNames");
		for (int i = 0; i < m_aSelectedNames.Count(); i++)
		{
			StoreString("", m_aSelectedNames[i]);
		}
		EndArray();
	}
}

class EMCP_WB_GetState : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_GetStateRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_GetStateResponse resp = new EMCP_WB_GetStateResponse();

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "ok";
			resp.mode = "no_world_editor";
			resp.message = "WorldEditor module not loaded";
			return resp;
		}

		WorldEditorAPI api = worldEditor.GetApi();
		if (!api)
		{
			resp.status = "ok";
			resp.mode = "game";
			resp.message = "In game mode (WorldEditorAPI not available)";

			// Still get terrain bounds from WorldEditor
			vector bMin, bMax;
			if (worldEditor.GetTerrainBounds(bMin, bMax))
			{
				resp.boundsMin = bMin[0].ToString() + " " + bMin[1].ToString() + " " + bMin[2].ToString();
				resp.boundsMax = bMax[0].ToString() + " " + bMax[1].ToString() + " " + bMax[2].ToString();
			}

			return resp;
		}

		// Edit mode - collect full state
		resp.mode = "edit";
		resp.entityCount = api.GetEditorEntityCount();
		resp.selectedCount = api.GetSelectedEntitiesCount();
		resp.currentSubScene = api.GetCurrentSubScene();
		resp.isPrefabEditMode = worldEditor.IsPrefabEditMode();

		// Terrain bounds
		vector bMin, bMax;
		if (worldEditor.GetTerrainBounds(bMin, bMax))
		{
			resp.boundsMin = bMin[0].ToString() + " " + bMin[1].ToString() + " " + bMin[2].ToString();
			resp.boundsMax = bMax[0].ToString() + " " + bMax[1].ToString() + " " + bMax[2].ToString();
		}

		// Selected entity names (cap at 50)
		int maxSel = resp.selectedCount;
		if (maxSel > 50)
			maxSel = 50;

		for (int i = 0; i < maxSel; i++)
		{
			IEntitySource selSrc = api.GetSelectedEntity(i);
			if (selSrc)
				resp.m_aSelectedNames.Insert(selSrc.GetName());
			else
				resp.m_aSelectedNames.Insert("");
		}

		resp.status = "ok";
		resp.message = "State snapshot: " + resp.entityCount.ToString() + " entities, " + resp.selectedCount.ToString() + " selected";

		return resp;
	}
}
