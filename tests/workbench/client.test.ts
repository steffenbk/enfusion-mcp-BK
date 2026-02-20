import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { WorkbenchClient, WorkbenchError } from "../../src/workbench/client.js";
import {
  decodePascalString,
  decodeInt32LE,
  encodePascalString,
} from "../../src/workbench/protocol.js";

/**
 * Create a mock Workbench NET API server that:
 * 1. Reads the full request
 * 2. Parses the APIFunc from the payload
 * 3. Calls the handler to produce a response
 * 4. Sends the response as a Pascal string and closes
 */
function createMockWorkbench(
  handler: (apiFunc: string, params: Record<string, unknown>) => unknown
): { server: Server; port: number; close: () => Promise<void> } {
  const server = createServer((socket: Socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);

        // Parse: int32 protocolVer + pascal clientId + pascal contentType + pascal payload
        let offset = 0;
        const { bytesRead: b0 } = decodeInt32LE(buf, offset);
        offset += b0;
        const { bytesRead: b1 } = decodePascalString(buf, offset);
        offset += b1;
        const { bytesRead: b2 } = decodePascalString(buf, offset);
        offset += b2;
        const { value: payload } = decodePascalString(buf, offset);

        const parsed = JSON.parse(payload);
        const { APIFunc, ...params } = parsed;
        const response = handler(APIFunc, params);
        // Match real Workbench format: pascal("Ok") + pascal(JSON)
        const statusBuf = encodePascalString("Ok");
        const payloadBuf = encodePascalString(JSON.stringify(response));
        socket.end(Buffer.concat([statusBuf, payloadBuf]));
      } catch (e) {
        // Error: just send error status string (no payload)
        const errBuf = encodePascalString(`Error: ${String(e)}`);
        socket.end(errBuf);
      }
    });
  });

  let resolvedPort = 0;
  server.listen(0); // OS-assigned port
  const addr = server.address();
  if (addr && typeof addr !== "string") {
    resolvedPort = addr.port;
  }

  return {
    server,
    port: resolvedPort,
    close: () => new Promise((res) => server.close(() => res())),
  };
}

describe("WorkbenchClient", () => {
  let mockServer: ReturnType<typeof createMockWorkbench>;
  let client: WorkbenchClient;

  beforeEach(() => {
    mockServer = createMockWorkbench((apiFunc, params) => {
      if (apiFunc === "GetLoadedProjects") {
        return { "Loaded Projects": ["ArmaReforger", "TestMod"] };
      }
      if (apiFunc === "ReloadScripts") {
        return { status: "ok" };
      }
      if (apiFunc === "EMCP_WB_ListEntities") {
        return {
          count: 2,
          entities: [
            { name: "Tree_01", className: "SCR_DestructibleEntity" },
            { name: "House_02", className: "BuildingEntity" },
          ],
        };
      }
      return { error: `Unknown function: ${apiFunc}` };
    });
    client = new WorkbenchClient("127.0.0.1", mockServer.port);
  });

  afterEach(async () => {
    await mockServer.close();
  });

  it("calls a built-in function", async () => {
    const result = await client.call<{ status: string }>("ReloadScripts");
    expect(result.status).toBe("ok");
  });

  it("calls a custom handler with params", async () => {
    const result = await client.call<{
      count: number;
      entities: Array<{ name: string; className: string }>;
    }>("EMCP_WB_ListEntities", { offset: 0, limit: 50 });
    expect(result.count).toBe(2);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].name).toBe("Tree_01");
  });

  it("ping returns true when server is running", async () => {
    const ok = await client.ping();
    expect(ok).toBe(true);
  });

  it("ping returns false when server is down", async () => {
    await mockServer.close();
    const deadClient = new WorkbenchClient("127.0.0.1", 1); // port 1 should refuse
    const ok = await deadClient.ping();
    expect(ok).toBe(false);
  });

  it("throws CONNECTION_REFUSED on bad port", async () => {
    const badClient = new WorkbenchClient("127.0.0.1", 1);
    await expect(
      badClient.call("ReloadScripts", {}, { skipAutoLaunch: true })
    ).rejects.toThrow(WorkbenchError);
    try {
      await badClient.call("ReloadScripts", {}, { skipAutoLaunch: true });
    } catch (e) {
      expect(e).toBeInstanceOf(WorkbenchError);
      expect((e as WorkbenchError).code).toBe("CONNECTION_REFUSED");
    }
  });

  it("throws TIMEOUT on slow response", async () => {
    // Create a server that never responds.
    // allowHalfOpen prevents Node auto-ending when client sends FIN.
    const openSockets: Socket[] = [];
    const slowServer = createServer({ allowHalfOpen: true }, (socket) => {
      openSockets.push(socket);
      socket.on("data", () => {});
    });
    slowServer.listen(0);
    const addr = slowServer.address();
    const port = addr && typeof addr !== "string" ? addr.port : 0;
    const slowClient = new WorkbenchClient("127.0.0.1", port);

    await expect(
      slowClient.call("ReloadScripts", {}, { timeout: 200, skipAutoLaunch: true })
    ).rejects.toThrow("timed out");

    // Destroy all held sockets so server.close() doesn't hang
    for (const s of openSockets) s.destroy();
    await new Promise<void>((res) => slowServer.close(() => res()));
  });

  it("toString shows host and port", () => {
    expect(client.toString()).toContain("127.0.0.1");
    expect(client.toString()).toContain(String(mockServer.port));
  });
});
