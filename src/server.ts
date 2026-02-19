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
import { registerCreateModPrompt } from "./prompts/create-mod.js";
import { registerAddScriptPrompt } from "./prompts/add-script.js";
import { registerAddPrefabPrompt } from "./prompts/add-prefab.js";
import { registerClassResource } from "./resources/class-resource.js";
import { registerPatternResource } from "./resources/pattern-resource.js";
import { registerGroupResource } from "./resources/group-resource.js";
import { SearchEngine } from "./index/search-engine.js";
import { PatternLibrary } from "./patterns/loader.js";
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

  // MCP Prompts
  registerCreateModPrompt(server, patterns);
  registerAddScriptPrompt(server);
  registerAddPrefabPrompt(server);

  // MCP Resources
  registerClassResource(server, searchEngine);
  registerPatternResource(server, patterns);
  registerGroupResource(server, searchEngine);
}
