/**
 * EMCP_WB_GetEntity.c - Entity detail retrieval
 *
 * Finds an entity by name or index and returns detailed information.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_GetEntity"
 */

class EMCP_WB_GetEntityRequest : JsonApiStruct
{
	string name;
	int index;

	void EMCP_WB_GetEntityRequest()
	{
		RegV("name");
		RegV("index");
		index = -1;
	}
}

class EMCP_WB_GetEntityResponse : JsonApiStruct
{
	string status;
	string message;
	string name;
	string className;
	string position;
	string rotation;
	int componentCount;
	int layerID;
	int subScene;
	int varCount;

	// Properties collected before OnPack
	ref array<string> m_aVarNames;
	ref array<string> m_aVarValues;
	ref array<string> m_aComponentClasses;

	void EMCP_WB_GetEntityResponse()
	{
		RegV("status");
		RegV("message");
		RegV("name");
		RegV("className");
		RegV("position");
		RegV("rotation");
		RegV("componentCount");
		RegV("layerID");
		RegV("subScene");
		RegV("varCount");

		m_aVarNames = {};
		m_aVarValues = {};
		m_aComponentClasses = {};
	}

	override void OnPack()
	{
		// Pack properties array
		StartArray("properties");
		for (int i = 0; i < m_aVarNames.Count(); i++)
		{
			StartObject("");
			StoreString("name", m_aVarNames[i]);
			StoreString("value", m_aVarValues[i]);
			EndObject();
		}
		EndArray();

		// Pack components array
		StartArray("components");
		for (int i = 0; i < m_aComponentClasses.Count(); i++)
		{
			StartObject("");
			StoreString("className", m_aComponentClasses[i]);
			StoreInteger("index", i);
			EndObject();
		}
		EndArray();
	}
}

class EMCP_WB_GetEntity : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_GetEntityRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_GetEntityRequest req = EMCP_WB_GetEntityRequest.Cast(request);
		EMCP_WB_GetEntityResponse resp = new EMCP_WB_GetEntityResponse();

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

		// Find entity by name or index
		IEntitySource entSrc = null;

		if (req.name != "")
		{
			// Search by name
			int count = api.GetEditorEntityCount();
			for (int i = 0; i < count; i++)
			{
				IEntitySource candidate = api.GetEditorEntity(i);
				if (candidate && candidate.GetName() == req.name)
				{
					entSrc = candidate;
					break;
				}
			}

			if (!entSrc)
			{
				resp.status = "error";
				resp.message = "Entity not found with name: " + req.name;
				return resp;
			}
		}
		else if (req.index >= 0)
		{
			int count = api.GetEditorEntityCount();
			if (req.index >= count)
			{
				resp.status = "error";
				resp.message = "Index " + req.index.ToString() + " out of range (count: " + count.ToString() + ")";
				return resp;
			}
			entSrc = api.GetEditorEntity(req.index);
			if (!entSrc)
			{
				resp.status = "error";
				resp.message = "Entity at index " + req.index.ToString() + " is null";
				return resp;
			}
		}
		else
		{
			resp.status = "error";
			resp.message = "Provide either name or index (>= 0)";
			return resp;
		}

		// Populate response
		resp.name = entSrc.GetName();
		resp.className = entSrc.GetClassName();
		resp.componentCount = entSrc.GetComponentCount();
		resp.layerID = entSrc.GetLayerID();
		resp.subScene = entSrc.GetSubScene();

		// Get transform from runtime entity
		IEntity ent = api.SourceToEntity(entSrc);
		if (ent)
		{
			vector pos = ent.GetOrigin();
			resp.position = pos[0].ToString() + " " + pos[1].ToString() + " " + pos[2].ToString();

			vector angles = ent.GetAngles();
			resp.rotation = angles[0].ToString() + " " + angles[1].ToString() + " " + angles[2].ToString();
		}
		else
		{
			resp.position = "0 0 0";
			resp.rotation = "0 0 0";
		}

		// Collect variables/properties
		int numVars = entSrc.GetNumVars();
		resp.varCount = numVars;
		int maxVars = numVars;
		if (maxVars > 50)
			maxVars = 50; // Cap to prevent oversized responses

		for (int v = 0; v < maxVars; v++)
		{
			string varName = entSrc.GetVarName(v);
			string varVal;
			entSrc.GetDefaultAsString(varName, varVal);
			resp.m_aVarNames.Insert(varName);
			resp.m_aVarValues.Insert(varVal);
		}

		// Collect components
		for (int c = 0; c < resp.componentCount; c++)
		{
			IEntityComponentSource compSrc = entSrc.GetComponent(c);
			if (compSrc)
				resp.m_aComponentClasses.Insert(compSrc.GetClassName());
			else
				resp.m_aComponentClasses.Insert("null");
		}

		resp.status = "ok";
		resp.message = "Entity details retrieved";
		return resp;
	}
}
