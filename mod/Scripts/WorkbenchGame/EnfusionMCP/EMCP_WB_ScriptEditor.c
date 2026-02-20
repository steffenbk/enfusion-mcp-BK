/**
 * EMCP_WB_ScriptEditor.c - Script editor operations handler
 *
 * Actions: getCurrentFile, getLine, setLine, insertLine, removeLine, getLinesCount, openFile
 * Uses the ScriptEditor Workbench module.
 * Called via NET API TCP protocol: APIFunc = "EMCP_WB_ScriptEditor"
 */

class EMCP_WB_ScriptEditorRequest : JsonApiStruct
{
	string action;
	int line;
	string text;
	string path;

	void EMCP_WB_ScriptEditorRequest()
	{
		RegV("action");
		RegV("line");
		RegV("text");
		RegV("path");
		line = -1;
	}
}

class EMCP_WB_ScriptEditorResponse : JsonApiStruct
{
	string status;
	string message;
	string action;
	string currentFile;
	int currentLine;
	int linesCount;
	string lineText;

	void EMCP_WB_ScriptEditorResponse()
	{
		RegV("status");
		RegV("message");
		RegV("action");
		RegV("currentFile");
		RegV("currentLine");
		RegV("linesCount");
		RegV("lineText");
	}
}

class EMCP_WB_ScriptEditor : NetApiHandler
{
	override JsonApiStruct GetRequest()
	{
		return new EMCP_WB_ScriptEditorRequest();
	}

	override JsonApiStruct GetResponse(JsonApiStruct request)
	{
		EMCP_WB_ScriptEditorRequest req = EMCP_WB_ScriptEditorRequest.Cast(request);
		EMCP_WB_ScriptEditorResponse resp = new EMCP_WB_ScriptEditorResponse();
		resp.action = req.action;

		ScriptEditor scriptEditor = Workbench.GetModule(ScriptEditor);
		if (!scriptEditor)
		{
			resp.status = "error";
			resp.message = "ScriptEditor module not available";
			return resp;
		}

		if (req.action == "getCurrentFile")
		{
			string filename;
			bool result = scriptEditor.GetCurrentFile(filename);
			if (result)
			{
				resp.currentFile = filename;
				resp.currentLine = scriptEditor.GetCurrentLine();
				resp.linesCount = scriptEditor.GetLinesCount();
				resp.status = "ok";
				resp.message = "Current file: " + filename;
			}
			else
			{
				resp.status = "ok";
				resp.message = "No file currently open in script editor";
			}
		}
		else if (req.action == "getLine")
		{
			string lineText;
			bool result = scriptEditor.GetLineText(lineText, req.line);
			if (result)
			{
				resp.lineText = lineText;
				resp.status = "ok";
				resp.message = "Line " + req.line.ToString() + " retrieved";
			}
			else
			{
				resp.status = "error";
				resp.message = "GetLineText returned false for line " + req.line.ToString();
			}
		}
		else if (req.action == "setLine")
		{
			scriptEditor.SetLineText(req.text, req.line);
			resp.status = "ok";
			resp.message = "Line " + req.line.ToString() + " set";
		}
		else if (req.action == "insertLine")
		{
			scriptEditor.InsertLine(req.text, req.line);
			resp.status = "ok";
			resp.message = "Line inserted at " + req.line.ToString();
		}
		else if (req.action == "removeLine")
		{
			scriptEditor.RemoveLine(req.line);
			resp.status = "ok";
			resp.message = "Line " + req.line.ToString() + " removed";
		}
		else if (req.action == "getLinesCount")
		{
			resp.linesCount = scriptEditor.GetLinesCount();
			resp.status = "ok";
			resp.message = "Lines count: " + resp.linesCount.ToString();
		}
		else if (req.action == "openFile")
		{
			if (req.path == "")
			{
				resp.status = "error";
				resp.message = "path parameter required for openFile action";
				return resp;
			}

			bool result = scriptEditor.SetOpenedResource(req.path);
			resp.status = "ok";
			if (result)
				resp.message = "Opened file: " + req.path;
			else
				resp.message = "SetOpenedResource returned false for: " + req.path;
		}
		else
		{
			resp.status = "error";
			resp.message = "Unknown action: " + req.action + ". Valid: getCurrentFile, getLine, setLine, insertLine, removeLine, getLinesCount, openFile";
		}

		return resp;
	}
}
