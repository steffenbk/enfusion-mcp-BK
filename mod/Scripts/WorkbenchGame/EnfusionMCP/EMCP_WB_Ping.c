/**
 * EMCP_WB_Ping.c - Health check handler for EnfusionMCP Workbench bridge
 *
 * Returns status and current editor mode (edit vs game).
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Ping"
 */

class EMCP_WB_PingRequest : JsonApiStruct
{
	void EMCP_WB_PingRequest()
	{
		// No request parameters needed for ping
	}
}

class EMCP_WB_PingResponse : JsonApiStruct
{
	string status;
	string mode;
	string message;

	void EMCP_WB_PingResponse()
	{
		RegV("status");
		RegV("mode");
		RegV("message");
	}
}

class EMCP_WB_Ping : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_PingRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_PingResponse resp = new EMCP_WB_PingResponse();

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "ok";
			resp.mode = "no_world_editor";
			resp.message = "EnfusionMCP Workbench bridge active (no WorldEditor module)";
			return resp;
		}

		WorldEditorAPI api = worldEditor.GetApi();
		if (api)
		{
			resp.status = "ok";
			resp.mode = "edit";
			resp.message = "EnfusionMCP Workbench bridge active";
		}
		else
		{
			resp.status = "ok";
			resp.mode = "game";
			resp.message = "EnfusionMCP Workbench bridge active (game mode)";
		}

		return resp;
	}
}
