/**
 * EMCP_WB_ExecuteAction.c - Generic menu action executor
 *
 * Executes arbitrary Workbench menu actions by path.
 * menuPath is comma-separated, e.g. "Edit,Select All" or "Tools,Reload Scripts"
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_ExecuteAction"
 */

class EMCP_WB_ExecuteActionRequest : JsonApiStruct
{
	string menuPath;

	void EMCP_WB_ExecuteActionRequest()
	{
		RegV("menuPath");
	}
}

class EMCP_WB_ExecuteActionResponse : JsonApiStruct
{
	string status;
	string menuPath;
	string message;

	void EMCP_WB_ExecuteActionResponse()
	{
		RegV("status");
		RegV("menuPath");
		RegV("message");
	}
}

class EMCP_WB_ExecuteAction : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ExecuteActionRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ExecuteActionRequest req = EMCP_WB_ExecuteActionRequest.Cast(request);
		EMCP_WB_ExecuteActionResponse resp = new EMCP_WB_ExecuteActionResponse();
		resp.menuPath = req.menuPath;

		if (req.menuPath == "")
		{
			resp.status = "error";
			resp.message = "menuPath parameter required (comma-separated, e.g. 'Edit,Select All')";
			return resp;
		}

		WorldEditor worldEditor = Workbench.GetModule(WorldEditor);
		if (!worldEditor)
		{
			resp.status = "error";
			resp.message = "WorldEditor module not available";
			return resp;
		}

		// Split menuPath on commas
		array<string> parts = {};
		string remaining = req.menuPath;
		int commaIdx = remaining.IndexOf(",");
		while (commaIdx >= 0)
		{
			string part = remaining.Substring(0, commaIdx);
			part.Trim();
			parts.Insert(part);
			remaining = remaining.Substring(commaIdx + 1, remaining.Length() - commaIdx - 1);
			commaIdx = remaining.IndexOf(",");
		}
		remaining.Trim();
		if (remaining.Length() > 0)
			parts.Insert(remaining);

		if (parts.Count() == 0)
		{
			resp.status = "error";
			resp.message = "menuPath resolved to empty array";
			return resp;
		}

		bool result = worldEditor.ExecuteAction(parts);
		resp.status = "ok";
		if (result)
			resp.message = "Action executed successfully";
		else
			resp.message = "ExecuteAction returned false (action may not exist or is unavailable)";

		return resp;
	}
}
