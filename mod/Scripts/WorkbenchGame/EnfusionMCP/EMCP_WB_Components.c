/**
 * EMCP_WB_Components.c - Component management handler
 *
 * Actions: add, remove, list
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Components"
 */

class EMCP_WB_ComponentsRequest : JsonApiStruct
{
	string entityName;
	string action;
	string componentClass;
	int componentIndex;

	void EMCP_WB_ComponentsRequest()
	{
		RegV("entityName");
		RegV("action");
		RegV("componentClass");
		RegV("componentIndex");
		componentIndex = -1;
	}
}

class EMCP_WB_ComponentsResponse : JsonApiStruct
{
	string status;
	string message;
	string entityName;
	string action;
	int componentCount;

	// Component data for list action
	ref array<string> m_aComponentClasses;
	ref array<int> m_aComponentIndices;

	void EMCP_WB_ComponentsResponse()
	{
		RegV("status");
		RegV("message");
		RegV("entityName");
		RegV("action");
		RegV("componentCount");

		m_aComponentClasses = {};
		m_aComponentIndices = {};
	}

	override void OnPack()
	{
		if (m_aComponentClasses.Count() > 0)
		{
			StartArray("components");
			for (int i = 0; i < m_aComponentClasses.Count(); i++)
			{
				StartObject("");
				StoreString("className", m_aComponentClasses[i]);
				StoreInteger("index", m_aComponentIndices[i]);
				EndObject();
			}
			EndArray();
		}
	}
}

class EMCP_WB_Components : NetApiHandler
{
	//------------------------------------------------------------------------------------------------
	static IEntitySource FindEntityByName(WorldEditorAPI api, string name)
	{
		int count = api.GetEditorEntityCount();
		for (int i = 0; i < count; i++)
		{
			IEntitySource candidate = api.GetEditorEntity(i);
			if (candidate && candidate.GetName() == name)
				return candidate;
		}
		return null;
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ComponentsRequest();
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ComponentsRequest req = EMCP_WB_ComponentsRequest.Cast(request);
		EMCP_WB_ComponentsResponse resp = new EMCP_WB_ComponentsResponse();
		resp.action = req.action;
		resp.entityName = req.entityName;

		if (req.entityName == "")
		{
			resp.status = "error";
			resp.message = "entityName parameter required";
			return resp;
		}

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

		IEntitySource entSrc = FindEntityByName(api, req.entityName);
		if (!entSrc)
		{
			resp.status = "error";
			resp.message = "Entity not found: " + req.entityName;
			return resp;
		}

		if (req.action == "add")
		{
			if (req.componentClass == "")
			{
				resp.status = "error";
				resp.message = "componentClass parameter required for add action";
				return resp;
			}

			api.BeginEntityAction("Add component via NetAPI");
			IEntityComponentSource newComp = api.CreateComponent(entSrc, req.componentClass);
			api.EndEntityAction();

			if (newComp)
			{
				resp.componentCount = entSrc.GetComponentCount();
				resp.status = "ok";
				resp.message = "Component added: " + req.componentClass;
			}
			else
			{
				resp.status = "error";
				resp.message = "CreateComponent returned null for class: " + req.componentClass;
			}
		}
		else if (req.action == "remove")
		{
			int compCount = entSrc.GetComponentCount();

			// Find component by class name or index
			IEntityComponentSource targetComp = null;

			if (req.componentIndex >= 0 && req.componentIndex < compCount)
			{
				targetComp = entSrc.GetComponent(req.componentIndex);
			}
			else if (req.componentClass != "")
			{
				for (int i = 0; i < compCount; i++)
				{
					IEntityComponentSource comp = entSrc.GetComponent(i);
					if (comp && comp.GetClassName() == req.componentClass)
					{
						targetComp = comp;
						break;
					}
				}
			}

			if (!targetComp)
			{
				resp.status = "error";
				resp.message = "Component not found. Specify componentClass or componentIndex.";
				return resp;
			}

			api.BeginEntityAction("Remove component via NetAPI");
			bool deleted = api.DeleteComponent(entSrc, targetComp);
			api.EndEntityAction();

			if (deleted)
			{
				resp.componentCount = entSrc.GetComponentCount();
				resp.status = "ok";
				resp.message = "Component removed";
			}
			else
			{
				resp.status = "error";
				resp.message = "DeleteComponent returned false";
			}
		}
		else if (req.action == "list")
		{
			int compCount = entSrc.GetComponentCount();
			resp.componentCount = compCount;

			for (int i = 0; i < compCount; i++)
			{
				IEntityComponentSource comp = entSrc.GetComponent(i);
				if (comp)
				{
					resp.m_aComponentClasses.Insert(comp.GetClassName());
					resp.m_aComponentIndices.Insert(i);
				}
				else
				{
					resp.m_aComponentClasses.Insert("null");
					resp.m_aComponentIndices.Insert(i);
				}
			}

			resp.status = "ok";
			resp.message = "Components listed: " + compCount.ToString();
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: add, remove, list";
		}

		return resp;
	}
}
