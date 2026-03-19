/**
 * EMCP_WB_Localization.c - Localization editor handler
 *
 * Actions: insert, delete, modify, getTable
 * Uses the LocalizationEditor Workbench module.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Localization"
 */

class EMCP_WB_LocalizationRequest : JsonApiStruct
{
	string action;
	string itemId;
	string property;
	string value;

	void EMCP_WB_LocalizationRequest()
	{
		RegV("action");
		RegV("itemId");
		RegV("property");
		RegV("value");
	}
}

class EMCP_WB_LocalizationEntry
{
	string m_sId;
	string m_sEnUs;
	string m_sTarget;
	string m_sComment;
}

class EMCP_WB_LocalizationResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	string itemId;
	int tableItemCount;
	ref array<ref EMCP_WB_LocalizationEntry> m_aEntries;
	ref array<string> m_aLanguages;

	void EMCP_WB_LocalizationResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("itemId");
		RegV("tableItemCount");
		m_aEntries = {};
		m_aLanguages = {};
	}

	override void OnPack()
	{
		if (m_aEntries.Count() > 0)
		{
			StartArray("entries");
			for (int i = 0; i < m_aEntries.Count(); i++)
			{
				EMCP_WB_LocalizationEntry e = m_aEntries[i];
				StartObject("");
				StoreString("id", e.m_sId);
				StoreString("en_us", e.m_sEnUs);
				StoreString("target", e.m_sTarget);
				StoreString("comment", e.m_sComment);
				EndObject();
			}
			EndArray();
		}

		if (m_aLanguages.Count() > 0)
		{
			StartArray("languages");
			for (int i = 0; i < m_aLanguages.Count(); i++)
			{
				StoreString("", m_aLanguages[i]);
			}
			EndArray();
		}
	}
}

class EMCP_WB_Localization : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_LocalizationRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_LocalizationRequest req = EMCP_WB_LocalizationRequest.Cast(request);
		EMCP_WB_LocalizationResponse resp = new EMCP_WB_LocalizationResponse();
		resp.action = req.action;
		resp.itemId = req.itemId;

		LocalizationEditor locEditor = Workbench.GetModule(LocalizationEditor);
		if (!locEditor)
		{
			resp.status = "error";
			resp.message = "LocalizationEditor module not available";
			return resp;
		}

		if (req.action == "insert")
		{
			if (req.itemId == "")
			{
				resp.status = "error";
				resp.message = "itemId parameter required for insert action";
				return resp;
			}

			locEditor.BeginModify("Insert item via NetAPI");
			BaseContainer newItem = locEditor.InsertItem(req.itemId, true, true);
			locEditor.EndModify();

			if (newItem)
			{
				resp.status = "ok";
				resp.message = "Localization item inserted: " + req.itemId;
			}
			else
			{
				resp.status = "error";
				resp.message = "InsertItem returned null for: " + req.itemId;
			}
		}
		else if (req.action == "delete")
		{
			if (req.itemId == "")
			{
				resp.status = "error";
				resp.message = "itemId parameter required for delete action";
				return resp;
			}

			locEditor.BeginModify("Delete item via NetAPI");
			locEditor.DeleteItem(req.itemId);
			locEditor.EndModify();

			resp.status = "ok";
			resp.message = "Localization item deleted: " + req.itemId;
		}
		else if (req.action == "modify")
		{
			if (req.itemId == "" || req.property == "")
			{
				resp.status = "error";
				resp.message = "itemId and property parameters required for modify action";
				return resp;
			}

			// Get the string table to find the item container
			BaseContainer table = locEditor.GetTable();
			if (!table)
			{
				resp.status = "error";
				resp.message = "Could not get string table";
				return resp;
			}

			// Find the item in the table by iterating children
			int childCount = table.GetNumChildren();
			BaseContainer itemContainer = null;
			for (int i = 0; i < childCount; i++)
			{
				BaseContainer child = table.GetChild(i);
				if (!child)
					continue;

				string childId;
				if (child.Get("Id", childId) && childId == req.itemId)
				{
					itemContainer = child;
					break;
				}
			}

			if (!itemContainer)
			{
				resp.status = "error";
				resp.message = "Localization item not found: " + req.itemId;
				return resp;
			}

			// Find the variable index for the property
			int varIdx = itemContainer.GetVarIndex(req.property);
			if (varIdx < 0)
			{
				resp.status = "error";
				resp.message = "Property not found: " + req.property;
				return resp;
			}

			locEditor.BeginModify("Modify property via NetAPI");
			locEditor.ModifyProperty(itemContainer, varIdx, req.value);
			locEditor.EndModify();

			resp.status = "ok";
			resp.message = "Property '" + req.property + "' set to '" + req.value + "' on item: " + req.itemId;
		}
		else if (req.action == "getTable")
		{
			BaseContainer table = locEditor.GetTable();
			if (!table)
			{
				resp.status = "error";
				resp.message = "Could not get string table (no localization file loaded?)";
				return resp;
			}

			int childCount = table.GetNumChildren();
			resp.tableItemCount = childCount;
			int cap = childCount;
			if (cap > 500) cap = 500;

			for (int i = 0; i < cap; i++)
			{
				BaseContainer child = table.GetChild(i);
				if (!child)
					continue;

				EMCP_WB_LocalizationEntry entry = new EMCP_WB_LocalizationEntry();
				child.Get("Id", entry.m_sId);
				child.Get("en_us", entry.m_sEnUs);
				child.Get("target", entry.m_sTarget);
				child.Get("comment", entry.m_sComment);
				resp.m_aEntries.Insert(entry);
			}

			resp.status = "ok";
			resp.message = "String table has " + childCount.ToString() + " items" +
				(childCount > 500 ? " (capped at 500)" : "");
		}
		else if (req.action == "listLanguages")
		{
			BaseContainer table = locEditor.GetTable();
			if (!table || table.GetNumChildren() == 0)
			{
				resp.status = "ok";
				resp.message = "No entries in table — cannot detect languages";
				return resp;
			}

			BaseContainer firstEntry = table.GetChild(0);
			if (!firstEntry)
			{
				resp.status = "error";
				resp.message = "Could not read first entry";
				return resp;
			}

			// Language columns match pattern: 5 chars, index 2 is underscore (e.g. en_us, fr_fr)
			int varCount = firstEntry.GetNumVars();
			for (int v = 0; v < varCount; v++)
			{
				string varName = firstEntry.GetVarName(v);
				if (varName.Length() == 5 && varName.Substring(2, 1) == "_")
					resp.m_aLanguages.Insert(varName);
			}

			resp.status = "ok";
			resp.message = "Found " + resp.m_aLanguages.Count().ToString() + " language columns";
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: insert, delete, modify, getTable, listLanguages";
		}

		return resp;
	}
}
