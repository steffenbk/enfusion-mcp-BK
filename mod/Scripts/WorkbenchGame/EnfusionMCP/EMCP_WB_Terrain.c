/**
 * EMCP_WB_Terrain.c - Terrain operations handler
 *
 * Actions: getHeight, getBounds
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Terrain"
 */

class EMCP_WB_TerrainRequest : JsonApiStruct
{
	string action;
	string x;
	string z;

	void EMCP_WB_TerrainRequest()
	{
		RegV("action");
		RegV("x");
		RegV("z");
	}
}

class EMCP_WB_TerrainResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	float height;
	string boundsMin;
	string boundsMax;

	void EMCP_WB_TerrainResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("height");
		RegV("boundsMin");
		RegV("boundsMax");
	}
}

class EMCP_WB_Terrain : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_TerrainRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_TerrainRequest req = EMCP_WB_TerrainRequest.Cast(request);
		EMCP_WB_TerrainResponse resp = new EMCP_WB_TerrainResponse();
		resp.action = req.action;

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "error";
			resp.message = "WorldEditor module not available";
			return resp;
		}

		if (req.action == "getHeight")
		{
			WorldEditorAPI api = worldEditor.GetApi();
			if (!api)
			{
				resp.status = "error";
				resp.message = "WorldEditorAPI not available";
				return resp;
			}

			float fx = req.x.ToFloat();
			float fz = req.z.ToFloat();
			float surfaceY = api.GetTerrainSurfaceY(fx, fz);
			resp.height = surfaceY;
			resp.status = "ok";
			resp.message = "Terrain height at (" + fx.ToString() + ", " + fz.ToString() + "): " + surfaceY.ToString();
		}
		else if (req.action == "getBounds")
		{
			vector boundsMinVec, boundsMaxVec;
			bool result = worldEditor.GetTerrainBounds(boundsMinVec, boundsMaxVec);

			if (result)
			{
				resp.boundsMin = boundsMinVec[0].ToString() + " " + boundsMinVec[1].ToString() + " " + boundsMinVec[2].ToString();
				resp.boundsMax = boundsMaxVec[0].ToString() + " " + boundsMaxVec[1].ToString() + " " + boundsMaxVec[2].ToString();
				resp.status = "ok";
				resp.message = "Terrain bounds retrieved";
			}
			else
			{
				resp.status = "error";
				resp.message = "GetTerrainBounds returned false (no terrain loaded?)";
			}
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: getHeight, getBounds";
		}

		return resp;
	}
}
