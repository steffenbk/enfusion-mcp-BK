/**
 * EMCP_WB_EditorControl.c - Editor mode control handler
 *
 * Supports actions: play, stop, save, undo, redo, openResource
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_EditorControl"
 */

class EMCP_WB_EditorControlRequest : JsonApiStruct
{
	string action;
	bool debugMode;
	bool fullScreen;
	string path;

	void EMCP_WB_EditorControlRequest()
	{
		RegV("action");
		RegV("debugMode");
		RegV("fullScreen");
		RegV("path");
	}
}

class EMCP_WB_EditorControlResponse : JsonApiStruct
{
	string status;
	string action;
	string message;

	void EMCP_WB_EditorControlResponse()
	{
		RegV("status");
		RegV("action");
		RegV("message");
	}
}

class EMCP_WB_EditorControl : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_EditorControlRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_EditorControlRequest req = EMCP_WB_EditorControlRequest.Cast(request);
		EMCP_WB_EditorControlResponse resp = new EMCP_WB_EditorControlResponse();
		resp.action = req.action;

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "error";
			resp.message = "WorldEditor module not available";
			return resp;
		}

		if (req.action == "play")
		{
			worldEditor.SwitchToGameMode(req.debugMode, req.fullScreen);
			resp.status = "ok";
			resp.message = "Switched to game mode";
		}
		else if (req.action == "stop")
		{
			worldEditor.SwitchToEditMode();
			resp.status = "ok";
			resp.message = "Switched to edit mode";
		}
		else if (req.action == "save")
		{
			bool saved = worldEditor.Save();
			resp.status = "ok";
			if (saved)
				resp.message = "World saved";
			else
				resp.message = "Save returned false (may already be up to date)";
		}
		else if (req.action == "saveAs")
		{
			// WorldEditor does not expose SaveAs directly; fall back to Save
			bool saved = worldEditor.Save();
			resp.status = "ok";
			resp.message = "SaveAs not available, used Save instead";
		}
		else if (req.action == "undo")
		{
			WorldEditorAPI api = worldEditor.GetApi();
			if (api)
			{
				// Undo is available via GameWorldEditor or WorldEditorIngame
				// Use ExecuteAction as a safe fallback
				array<string> menuPath = {};
				menuPath.Insert("Edit");
				menuPath.Insert("Undo");
				worldEditor.ExecuteAction(menuPath);
				resp.status = "ok";
				resp.message = "Undo executed";
			}
			else
			{
				resp.status = "error";
				resp.message = "WorldEditorAPI not available for undo";
			}
		}
		else if (req.action == "redo")
		{
			array<string> menuPath = {};
			menuPath.Insert("Edit");
			menuPath.Insert("Redo");
			worldEditor.ExecuteAction(menuPath);
			resp.status = "ok";
			resp.message = "Redo executed";
		}
		else if (req.action == "openResource")
		{
			if (req.path == "")
			{
				resp.status = "error";
				resp.message = "path parameter required for openResource action";
			}
			else
			{
				bool opened = worldEditor.SetOpenedResource(req.path);
				resp.status = "ok";
				if (opened)
					resp.message = "Opened resource: " + req.path;
				else
					resp.message = "SetOpenedResource returned false for: " + req.path;
			}
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: play, stop, save, saveAs, undo, redo, openResource";
		}

		return resp;
	}
}
