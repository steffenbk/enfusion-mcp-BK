/**
 * EMCP_WB_Clipboard.c - Clipboard operations handler
 *
 * Actions: copy, cut, paste, pasteAtCursor, duplicate, hasCopied
 * All operate on the current editor selection.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Clipboard"
 */

class EMCP_WB_ClipboardRequest : JsonApiStruct
{
	string action;

	void EMCP_WB_ClipboardRequest()
	{
		RegV("action");
	}
}

class EMCP_WB_ClipboardResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	bool result;

	void EMCP_WB_ClipboardResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("result");
	}
}

class EMCP_WB_Clipboard : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ClipboardRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ClipboardRequest req = EMCP_WB_ClipboardRequest.Cast(request);
		EMCP_WB_ClipboardResponse resp = new EMCP_WB_ClipboardResponse();
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

		if (req.action == "copy")
		{
			resp.result = api.CopySelectedEntities();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Selected entities copied";
			else
				resp.message = "CopySelectedEntities returned false (nothing selected?)";
		}
		else if (req.action == "cut")
		{
			resp.result = api.CutSelectedEntities();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Selected entities cut";
			else
				resp.message = "CutSelectedEntities returned false (nothing selected?)";
		}
		else if (req.action == "paste")
		{
			resp.result = api.PasteEntities();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Entities pasted at original position";
			else
				resp.message = "PasteEntities returned false (nothing copied?)";
		}
		else if (req.action == "pasteAtCursor")
		{
			resp.result = api.PasteEntitiesAtMouseCursorPos();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Entities pasted at mouse cursor position";
			else
				resp.message = "PasteEntitiesAtMouseCursorPos returned false";
		}
		else if (req.action == "duplicate")
		{
			resp.result = api.DuplicateSelectedEntities();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Selected entities duplicated";
			else
				resp.message = "DuplicateSelectedEntities returned false (nothing selected?)";
		}
		else if (req.action == "hasCopied")
		{
			resp.result = api.HasCopiedEntities();
			resp.status = "ok";
			if (resp.result)
				resp.message = "Clipboard has copied entities";
			else
				resp.message = "Clipboard is empty";
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: copy, cut, paste, pasteAtCursor, duplicate, hasCopied";
		}

		return resp;
	}
}
