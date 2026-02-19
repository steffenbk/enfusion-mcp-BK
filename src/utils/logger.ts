/**
 * Logger that writes exclusively to stderr — safe for stdio MCP transport.
 * console.log is FORBIDDEN in stdio servers as it corrupts JSON-RPC messages.
 */
export const logger = {
  info: (msg: string, ...args: unknown[]) =>
    console.error(`[enfusion-mcp] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.error(`[enfusion-mcp] WARN: ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[enfusion-mcp] ERROR: ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.ENFUSION_MCP_DEBUG)
      console.error(`[enfusion-mcp] DEBUG: ${msg}`, ...args);
  },
};
