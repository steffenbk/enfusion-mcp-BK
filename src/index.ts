#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { registerTools } from "./server.js";
import { loadConfig } from "./config.js";
import { logger } from "./utils/logger.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const config = loadConfig();

const server = new McpServer({
  name: "enfusion-mcp",
  version,
});

registerTools(server, config);

const transport = new StdioServerTransport();
await server.connect(transport);
logger.info("enfusion-mcp server started");
