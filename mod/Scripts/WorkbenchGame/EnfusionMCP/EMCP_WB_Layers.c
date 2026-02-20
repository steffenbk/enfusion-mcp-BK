/**
 * EMCP_WB_Layers.c - Layer management handler
 *
 * Actions: list, getActive, setVisible, getEntityLayer
 * Layer operations in WorldEditorAPI are limited in the public API.
 * Layers are identified by IDs from IEntitySource.GetLayerID().
 *
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Layers"
 */

class EMCP_WB_LayersRequest : JsonApiStruct
{
	string action;
	int subScene;
	string entityName;
	bool visible;

	void EMCP_WB_LayersRequest()
	{
		RegV("action");
		RegV("subScene");
		RegV("entityName");
		RegV("visible");
		subScene = -1;
	}
}

class EMCP_WB_LayersResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	int currentSubScene;
	int layerID;

	// Layer data collected for list
	ref array<int> m_aLayerIDs;
	ref array<int> m_aEntityCounts;

	void EMCP_WB_LayersResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("currentSubScene");
		RegV("layerID");

		m_aLayerIDs = {};
		m_aEntityCounts = {};
	}

	override void OnPack()
	{
		if (m_aLayerIDs.Count() > 0)
		{
			StartArray("layers");
			for (int i = 0; i < m_aLayerIDs.Count(); i++)
			{
				StartObject("");
				StoreInteger("layerID", m_aLayerIDs[i]);
				StoreInteger("entityCount", m_aEntityCounts[i]);
				EndObject();
			}
			EndArray();
		}
	}
}

class EMCP_WB_Layers : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_LayersRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_LayersRequest req = EMCP_WB_LayersRequest.Cast(request);
		EMCP_WB_LayersResponse resp = new EMCP_WB_LayersResponse();
		resp.action = req.action;

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

		resp.currentSubScene = api.GetCurrentSubScene();

		if (req.action == "list")
		{
			// Enumerate layers by scanning all entities and collecting unique layer IDs
			int entityCount = api.GetEditorEntityCount();
			map<int, int> layerCounts = new map<int, int>();

			for (int i = 0; i < entityCount; i++)
			{
				IEntitySource entSrc = api.GetEditorEntity(i);
				if (!entSrc)
					continue;

				int lid = entSrc.GetLayerID();
				if (layerCounts.Contains(lid))
				{
					int current = layerCounts.Get(lid);
					layerCounts.Set(lid, current + 1);
				}
				else
				{
					layerCounts.Set(lid, 1);
				}
			}

			// Output collected layers
			for (int k = 0; k < layerCounts.Count(); k++)
			{
				int layerKey = layerCounts.GetKey(k);
				int layerCount = layerCounts.GetElement(k);
				resp.m_aLayerIDs.Insert(layerKey);
				resp.m_aEntityCounts.Insert(layerCount);
			}

			resp.status = "ok";
			resp.message = "Found " + layerCounts.Count().ToString() + " layers across " + entityCount.ToString() + " entities";
		}
		else if (req.action == "getActive")
		{
			resp.currentSubScene = api.GetCurrentSubScene();
			resp.status = "ok";
			resp.message = "Current sub-scene: " + resp.currentSubScene.ToString();
		}
		else if (req.action == "getEntityLayer")
		{
			if (req.entityName == "")
			{
				resp.status = "error";
				resp.message = "entityName parameter required for getEntityLayer";
				return resp;
			}

			int count = api.GetEditorEntityCount();
			bool found = false;
			for (int i = 0; i < count; i++)
			{
				IEntitySource entSrc = api.GetEditorEntity(i);
				if (entSrc && entSrc.GetName() == req.entityName)
				{
					resp.layerID = entSrc.GetLayerID();
					found = true;
					break;
				}
			}

			if (found)
			{
				resp.status = "ok";
				resp.message = "Entity '" + req.entityName + "' is on layer " + resp.layerID.ToString();
			}
			else
			{
				resp.status = "error";
				resp.message = "Entity not found: " + req.entityName;
			}
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: list, getActive, getEntityLayer";
		}

		return resp;
	}
}
