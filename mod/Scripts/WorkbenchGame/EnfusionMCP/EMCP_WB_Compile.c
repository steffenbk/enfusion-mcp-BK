/**
 * EMCP_WB_Compile.c - Script compilation trigger
 *
 * Triggers Workbench script compilation (equivalent to Ctrl+F7).
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_Compile"
 *
 * RUNTIME NOTE: CompileAll method name must be verified at Workbench compile time.
 * Candidates (in order of preference):
 *   1. scriptEditor.CompileAll()
 *   2. scriptEditor.Compile()
 *   3. Workbench.RunAction("Script.CompileAll")
 *   4. Workbench.RunAction("Compile")
 */

class EMCP_WB_CompileRequest : JsonApiStruct
{
	void EMCP_WB_CompileRequest()
	{
		// No parameters needed
	}
}

class EMCP_WB_CompileResponse : JsonApiStruct
{
	string status;
	string message;

	void EMCP_WB_CompileResponse()
	{
		RegV("status");
		RegV("message");
	}
}

class EMCP_WB_Compile : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_CompileRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_CompileResponse resp = new EMCP_WB_CompileResponse();

		ScriptEditor scriptEditor = Workbench.GetModule(ScriptEditor);
		if (!scriptEditor)
		{
			resp.status = "error";
			resp.message = "ScriptEditor module not available";
			return resp;
		}

		// RUNTIME_VERIFY: CompileAll may not exist — try candidates listed in file header.
		// If scriptEditor.CompileAll() fails to compile, try scriptEditor.Compile()
		// or Workbench.RunAction("Script.CompileAll").
		scriptEditor.CompileAll();

		resp.status = "ok";
		resp.message = "Script compilation triggered. Check Workbench Script Editor output for results.";
		return resp;
	}
}
