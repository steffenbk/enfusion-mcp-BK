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
	//! Which module owns the menu. Empty = WorldEditor, preserving old behaviour.
	//! Script compilation lives in the ScriptEditor menus and is unreachable otherwise.
	string module;

	void EMCP_WB_ExecuteActionRequest()
	{
		RegV("menuPath");
		RegV("module");
	}
}

class EMCP_WB_ExecuteActionResponse : JsonApiStruct
{
	string status;
	string menuPath;
	string module;
	//! ExecuteAction's own return, surfaced separately from status so a probe can
	//! tell "this menu path exists" from "the request was well formed".
	int executed;
	string message;

	void EMCP_WB_ExecuteActionResponse()
	{
		RegV("status");
		RegV("menuPath");
		RegV("module");
		RegV("executed");
		RegV("message");
	}
}

class EMCP_WB_ExecuteAction : NetApiHandler
{
	//------------------------------------------------------------------------------------------------
	//! GetModule takes a TypeName, so a name-to-module mapping has to be spelled out.
	static WBModuleDef ResolveModule(string name)
	{
		if (name == "" || name == "WorldEditor")
			return Workbench.GetModule(WorldEditor);
		if (name == "ScriptEditor")
			return Workbench.GetModule(ScriptEditor);
		if (name == "ResourceManager")
			return Workbench.GetModule(ResourceManager);
		if (name == "AnimEditor")
			return Workbench.GetModule(AnimEditor);
		if (name == "ParticleEditor")
			return Workbench.GetModule(ParticleEditor);
		if (name == "BehaviorEditor")
			return Workbench.GetModule(BehaviorEditor);
		if (name == "AudioEditor")
			return Workbench.GetModule(AudioEditor);
		if (name == "LocalizationEditor")
			return Workbench.GetModule(LocalizationEditor);
		return null;
	}

	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ExecuteActionRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ExecuteActionRequest req = EMCP_WB_ExecuteActionRequest.Cast(request);
		EMCP_WB_ExecuteActionResponse resp = new EMCP_WB_ExecuteActionResponse();
		resp.menuPath = req.menuPath;
		resp.module = req.module;
		if (resp.module == "")
			resp.module = "WorldEditor";

		if (req.menuPath == "")
		{
			resp.status = "error";
			resp.message = "menuPath parameter required (comma-separated, e.g. 'Edit,Select All')";
			return resp;
		}

		WBModuleDef module = ResolveModule(req.module);
		if (!module)
		{
			resp.status = "error";
			resp.message = "Module not available: " + resp.module;
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

		bool result = module.ExecuteAction(parts);
		resp.status = "ok";
		if (result)
		{
			resp.executed = 1;
			resp.message = "Action executed successfully";
		}
		else
		{
			resp.executed = 0;
			resp.message = "ExecuteAction returned false (action may not exist or is unavailable)";
		}

		return resp;
	}
}
