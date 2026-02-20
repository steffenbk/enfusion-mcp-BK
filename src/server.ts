import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerApiSearch } from "./tools/api-search.js";
import { registerWikiSearch } from "./tools/wiki-search.js";
import { registerProjectBrowse } from "./tools/project-browse.js";
import { registerProjectRead } from "./tools/project-read.js";
import { registerProjectWrite } from "./tools/project-write.js";
import { registerModCreate } from "./tools/mod-create.js";
import { registerScriptCreate } from "./tools/script-create.js";
import { registerPrefabCreate } from "./tools/prefab-create.js";
import { registerModValidate } from "./tools/mod-validate.js";
import { registerModBuild } from "./tools/mod-build.js";
import { registerConfigCreate } from "./tools/config-create.js";
import { registerServerConfig } from "./tools/server-config.js";
import { registerLayoutCreate } from "./tools/layout-create.js";
import { registerCreateModPrompt } from "./prompts/create-mod.js";
import { registerModifyModPrompt } from "./prompts/modify-mod.js";
import { registerClassResource } from "./resources/class-resource.js";
import { registerPatternResource } from "./resources/pattern-resource.js";
import { registerGroupResource } from "./resources/group-resource.js";
import { SearchEngine } from "./index/search-engine.js";
import { PatternLibrary } from "./patterns/loader.js";
import { WorkbenchClient } from "./workbench/client.js";
import { registerWbLaunch } from "./tools/wb-launch.js";
import { registerWbConnect } from "./tools/wb-connect.js";
import { registerWbReload } from "./tools/wb-reload.js";
import { registerWbEditorTools } from "./tools/wb-editor.js";
import { registerWbExecuteAction } from "./tools/wb-execute-action.js";
import { registerWbEntityTools } from "./tools/wb-entities.js";
import { registerWbComponent } from "./tools/wb-components.js";
import { registerWbTerrain } from "./tools/wb-terrain.js";
import { registerWbLayers } from "./tools/wb-layers.js";
import { registerWbResources } from "./tools/wb-resources.js";
import { registerWbPrefabs } from "./tools/wb-prefabs.js";
import { registerWbClipboard } from "./tools/wb-clipboard.js";
import { registerWbScriptEditor } from "./tools/wb-script-editor.js";
import { registerWbLocalization } from "./tools/wb-localization.js";
import { registerWbProjects } from "./tools/wb-projects.js";
import { registerWbValidate } from "./tools/wb-validate.js";
import { registerWbState } from "./tools/wb-state.js";
import type { Config } from "./config.js";

export function registerTools(server: McpServer, config: Config): void {
  const searchEngine = new SearchEngine(config.dataDir);
  const patterns = new PatternLibrary(config.patternsDir);

  // Phase 0 tools
  registerApiSearch(server, searchEngine);
  registerWikiSearch(server, searchEngine);
  registerProjectBrowse(server, config);

  // Phase 1 tools
  registerProjectRead(server, config);
  registerModCreate(server, config, patterns);
  registerScriptCreate(server, config);
  registerPrefabCreate(server, config);

  // Phase 2 tools
  registerProjectWrite(server, config);
  registerModValidate(server, config, searchEngine);
  registerModBuild(server, config);

  // Phase 3 tools
  registerConfigCreate(server, config);
  registerServerConfig(server, config);
  registerLayoutCreate(server, config);

  // Workbench Live Control tools (Phase 4)
  const wbClient = new WorkbenchClient(
    config.workbenchHost,
    config.workbenchPort,
    config
  );
  registerWbLaunch(server, wbClient);
  registerWbConnect(server, wbClient);
  registerWbReload(server, wbClient);
  registerWbEditorTools(server, wbClient);
  registerWbExecuteAction(server, wbClient);
  registerWbEntityTools(server, wbClient);
  registerWbComponent(server, wbClient);
  registerWbTerrain(server, wbClient);
  registerWbLayers(server, wbClient);
  registerWbResources(server, wbClient);
  registerWbPrefabs(server, wbClient);
  registerWbClipboard(server, wbClient);
  registerWbScriptEditor(server, wbClient);
  registerWbLocalization(server, wbClient);
  registerWbProjects(server, wbClient);
  registerWbValidate(server, wbClient);
  registerWbState(server, wbClient);

  // MCP Prompts
  registerCreateModPrompt(server, patterns);
  registerModifyModPrompt(server);

  // MCP Resources
  registerClassResource(server, searchEngine);
  registerPatternResource(server, patterns);
  registerGroupResource(server, searchEngine);
}
