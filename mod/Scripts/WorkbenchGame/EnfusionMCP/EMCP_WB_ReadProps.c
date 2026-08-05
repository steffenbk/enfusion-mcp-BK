/**
 * EMCP_WB_ReadProps.c - Read resolved property values from a prefab or config
 *
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_ReadProps"
 *
 * Reads through the engine rather than by parsing .et/.conf text, so
 * inheritance is already resolved: a value the prefab does not set itself is
 * returned as its inherited value, with isDirect=0 to say where it came from.
 * That removes any need to walk parent prefabs, follow .conf references, or
 * extract vanilla data from .pak files.
 *
 * The `path` navigates from the container root:
 *   @ClassName   component with that class name (entity sources only)
 *   Name         nested object via GetObject
 *   Name[i]      i-th element of an object array via GetObjectArray
 *
 * e.g. "@VehicleWheeledSimulation/Simulation/Engine"
 *      "@VehicleWheeledSimulation/Simulation/Axles[0]/Suspension"
 *      "@VehicleWheeledSimulation/Simulation/Pacejka/Longitudinal"
 *      "@SCR_TerrainDragComponent_BK"          (whole component)
 */

class EMCP_WB_ReadPropsRequest : JsonApiStruct
{
	string resource;   // ResourceName of the .et/.conf, with or without {GUID}
	string path;       // navigation path, "" for the root container

	void EMCP_WB_ReadPropsRequest()
	{
		RegV("resource");
		RegV("path");
	}
}

class EMCP_WB_ReadPropsResponse : JsonApiStruct
{
	string status;
	string message;
	string resource;
	string path;
	string className;
	int varCount;
	ref array<string> m_aNames;
	ref array<string> m_aValues;
	// 1 = written in this file, 0 = inherited from an ancestor. Mirrors the
	// ovr / inh badge the tuner already shows.
	ref array<int> m_aDirect;

	void EMCP_WB_ReadPropsResponse()
	{
		m_aNames = {};
		m_aValues = {};
		m_aDirect = {};
		RegV("status");
		RegV("message");
		RegV("resource");
		RegV("path");
		RegV("className");
		RegV("varCount");
		RegV("m_aNames");
		RegV("m_aValues");
		RegV("m_aDirect");
	}
}

class EMCP_WB_ReadProps : NetApiHandler
{
	//------------------------------------------------------------------------------------------------
	//! Component of a given class name on an entity source, or null.
	static BaseContainer FindComponent(IEntitySource entSrc, string className)
	{
		int count = entSrc.GetComponentCount();
		for (int i = 0; i < count; i++)
		{
			IEntityComponentSource comp = entSrc.GetComponent(i);
			if (comp && comp.GetClassName() == className)
				return comp;
		}
		return null;
	}

	//------------------------------------------------------------------------------------------------
	//! Split "Axles[0]" into name "Axles" and index 0. Index is -1 when absent.
	static void ParseSegment(string segment, out string name, out int index)
	{
		index = -1;
		name = segment;

		int open = segment.IndexOf("[");
		if (open < 0)
			return;

		int close = segment.IndexOf("]");
		if (close <= open)
			return;

		name = segment.Substring(0, open);
		string num = segment.Substring(open + 1, close - open - 1);
		index = num.ToInt();
	}

	//------------------------------------------------------------------------------------------------
	//! Walk `path` down from `root`. Returns null if any step is missing.
	static BaseContainer Navigate(BaseContainer root, string path, out string failedAt)
	{
		failedAt = "";
		if (path == "")
			return root;

		array<string> segments = {};
		path.Split("/", segments, true);

		BaseContainer current = root;
		foreach (string segment : segments)
		{
			if (!current)
				return null;

			if (segment.StartsWith("@"))
			{
				IEntitySource entSrc = IEntitySource.Cast(current);
				if (!entSrc)
				{
					failedAt = segment + " (not an entity source)";
					return null;
				}
				current = FindComponent(entSrc, segment.Substring(1, segment.Length() - 1));
				if (!current)
				{
					failedAt = segment;
					return null;
				}
				continue;
			}

			string name;
			int index;
			ParseSegment(segment, name, index);

			if (index >= 0)
			{
				BaseContainerList list = current.GetObjectArray(name);
				if (!list || index >= list.Count())
				{
					failedAt = segment;
					return null;
				}
				current = list.Get(index);
			}
			else
			{
				current = current.GetObject(name);
			}

			if (!current)
			{
				failedAt = segment;
				return null;
			}
		}
		return current;
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ReadPropsRequest();
	}

	//------------------------------------------------------------------------------------------------
	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ReadPropsRequest req = EMCP_WB_ReadPropsRequest.Cast(request);
		EMCP_WB_ReadPropsResponse resp = new EMCP_WB_ReadPropsResponse();
		resp.resource = req.resource;
		resp.path = req.path;
		resp.varCount = 0;

		if (req.resource == "")
		{
			resp.status = "error";
			resp.message = "resource is required";
			return resp;
		}

		// The Resource must stay in scope for as long as the BaseContainer is
		// used: dropping it lets the engine dispose the container immediately.
		Resource res = BaseContainerTools.LoadContainer(req.resource);
		if (!res || !res.IsValid())
		{
			resp.status = "error";
			resp.message = "Could not load resource: " + req.resource;
			return resp;
		}

		BaseContainer root = res.GetResource().ToBaseContainer();
		if (!root)
		{
			resp.status = "error";
			resp.message = "Resource has no BaseContainer: " + req.resource;
			return resp;
		}

		string failedAt;
		BaseContainer target = Navigate(root, req.path, failedAt);
		if (!target)
		{
			resp.status = "error";
			resp.message = "Path not found at segment: " + failedAt;
			return resp;
		}

		resp.className = target.GetClassName();

		int numVars = target.GetNumVars();
		for (int v = 0; v < numVars; v++)
		{
			string varName = target.GetVarName(v);
			string val;
			// GetDefaultAsString returns the inherited value when this file does
			// not set the variable, which is exactly what makes the .pak
			// extraction unnecessary.
			if (!target.GetDefaultAsString(varName, val))
				continue;

			resp.m_aNames.Insert(varName);
			resp.m_aValues.Insert(val);
			if (target.IsVariableSetDirectly(varName))
				resp.m_aDirect.Insert(1);
			else
				resp.m_aDirect.Insert(0);
		}

		resp.varCount = resp.m_aNames.Count();
		resp.status = "ok";
		resp.message = "Read " + resp.varCount.ToString() + " properties from " + resp.className;
		return resp;
	}
}
