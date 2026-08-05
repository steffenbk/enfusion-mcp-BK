/**
 * EMCP_WB_Resources.c - Resource operations handler
 *
 * Actions: register, rebuild, open, browse
 * Uses the ResourceManager Workbench module.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Resources"
 */

class EMCP_WB_ResourcesRequest : JsonApiStruct
{
	string action;
	string path;
	bool buildRuntime;

	void EMCP_WB_ResourcesRequest()
	{
		RegV("action");
		RegV("path");
		RegV("buildRuntime");
	}
}

class EMCP_WB_ResourceEntry
{
	string m_sName;
	string m_sPath;
	string m_sType;
}

class EMCP_WB_ResourcesResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	string path;
	int entryCount;
	ref array<ref EMCP_WB_ResourceEntry> m_aEntries;

	void EMCP_WB_ResourcesResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("path");
		RegV("entryCount");
		m_aEntries = {};
	}

	override void OnPack()
	{
		if (m_aEntries.Count() > 0)
		{
			StartArray("entries");
			for (int i = 0; i < m_aEntries.Count(); i++)
			{
				EMCP_WB_ResourceEntry e = m_aEntries[i];
				StartObject("");
				StoreString("name", e.m_sName);
				StoreString("path", e.m_sPath);
				StoreString("type", e.m_sType);
				EndObject();
			}
			EndArray();
		}
	}
}

class EMCP_WB_Resources : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ResourcesRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ResourcesRequest req = EMCP_WB_ResourcesRequest.Cast(request);
		EMCP_WB_ResourcesResponse resp = new EMCP_WB_ResourcesResponse();
		resp.action = req.action;
		resp.path = req.path;

		if (req.path == "")
		{
			resp.status = "error";
			resp.message = "path parameter required";
			return resp;
		}

		ResourceManager resMgr = Workbench.GetModule(ResourceManager);
		if (!resMgr)
		{
			resp.status = "error";
			resp.message = "ResourceManager module not available";
			return resp;
		}

		if (req.action == "register")
		{
			bool result = resMgr.RegisterResourceFile(req.path, req.buildRuntime);
			resp.status = "ok";
			if (result)
				resp.message = "Resource registered: " + req.path;
			else
				resp.message = "RegisterResourceFile returned false for: " + req.path;
		}
		else if (req.action == "rebuild")
		{
			resMgr.RebuildResourceFile(req.path, "", false);
			resp.status = "ok";
			resp.message = "Rebuild initiated for: " + req.path;
		}
		else if (req.action == "open")
		{
			bool result = resMgr.SetOpenedResource(req.path);
			resp.status = "ok";
			if (result)
				resp.message = "Opened resource: " + req.path;
			else
				resp.message = "SetOpenedResource returned false for: " + req.path;
		}
		else if (req.action == "browse")
		{
			// Workbench.SearchResources requires a WorkbenchSearchResourcesCallback subclass
			// whose exact callback method signature is not publicly documented.
			// Until the callback pattern is confirmed at runtime, return a helpful error.
			resp.status = "error";
			resp.message = "browse action not yet implemented: Workbench.SearchResources requires a WorkbenchSearchResourcesCallback subclass. Use asset_search to find resources, or project (action='browse') to list files on disk.";
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: register, rebuild, open, browse";
		}

		return resp;
	}
}
