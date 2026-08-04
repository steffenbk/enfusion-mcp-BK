import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerApiSearch } from "./tools/api-search.js";
import { registerComponentSearch } from "./tools/component-search.js";
import { registerWikiSearch } from "./tools/wiki-search.js";
import { registerWikiRead } from "./tools/wiki-read.js";
import { registerProject } from "./tools/project.js";
import { registerScriptCreate } from "./tools/script-create.js";
import { registerPrefab } from "./tools/prefab.js";
import { registerMod } from "./tools/mod.js";
import { registerConfigCreate } from "./tools/config-create.js";
import { registerServerConfig } from "./tools/server-config.js";
import { registerLayoutCreate } from "./tools/layout-create.js";
import { registerLayoutRecipe } from "./tools/layout-recipe.js";
import { registerMenuCreate } from "./tools/menu-create.js";
import { registerGamemodeScaffold } from "./tools/gamemode-scaffold.js";
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
import { registerWbDiagnose } from "./tools/wb-diagnose.js";
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
import { registerGameBrowse } from "./tools/game-browse.js";
import { registerGameRead } from "./tools/game-read.js";
import { registerAssetSearch } from "./tools/asset-search.js";
import { registerGameDuplicate } from "./tools/game-duplicate.js";
import { registerWbEntityDuplicate } from "./tools/wb-entity-duplicate.js";
import { registerWorkshopInfo } from "./tools/workshop-info.js";
import { registerScenarioTools } from "./tools/wb-scenario.js";
import { registerScenarioCreate } from "./tools/scenario-create.js";
import { registerAnimationGraph } from "./tools/animation-graph.js";
import { registerWbKnowledge } from "./tools/wb-knowledge.js";
import { registerBuildingSetup } from "./tools/building-setup.js";
import type { Config } from "./config.js";

export function registerTools(server: McpServer, config: Config): void {
  const searchEngine = new SearchEngine(config.dataDir);
  const patterns = new PatternLibrary(config.patternsDir);

  // Phase 0 tools
  registerApiSearch(server, searchEngine);
  registerComponentSearch(server, searchEngine);
  registerWikiSearch(server, searchEngine);
  registerWikiRead(server, searchEngine);
  registerProject(server, config);

  // Phase 1 tools
  registerMod(server, config, searchEngine, patterns);
  registerScriptCreate(server, config, searchEngine);
  registerPrefab(server, config);

  // Phase 3 tools
  registerConfigCreate(server, config);
  registerServerConfig(server, config);
  registerLayoutCreate(server, config);
  registerLayoutRecipe(server, config);
  registerMenuCreate(server, config);
  registerGamemodeScaffold(server, config);

  // Workbench Live Control tools (Phase 4)
  const wbClient = new WorkbenchClient(
    config.workbenchHost,
    config.workbenchPort,
    config
  );
  registerWbLaunch(server, config, wbClient);
  registerWbConnect(server, wbClient);
  registerWbDiagnose(server, wbClient);
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
  registerScenarioTools(server, wbClient);
  registerScenarioCreate(server, config);

  // Base game access tools
  registerGameBrowse(server, config);
  registerGameRead(server, config);
  registerAssetSearch(server, config);
  registerGameDuplicate(server, config, wbClient);
  registerWbEntityDuplicate(server, config, wbClient);
  registerWorkshopInfo(server, config);
  registerAnimationGraph(server, config);
  registerWbKnowledge(server);
  registerBuildingSetup(server, config);

  // MCP Prompts
  registerCreateModPrompt(server, patterns);
  registerModifyModPrompt(server);

  // MCP Resources
  registerClassResource(server, searchEngine);
  registerPatternResource(server, patterns);
  registerGroupResource(server, searchEngine);
}
