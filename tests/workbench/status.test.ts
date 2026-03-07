import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { WorkbenchClient } from "../../src/workbench/client.js";
import { formatConnectionStatus, requireEditMode, requirePlayMode } from "../../src/workbench/status.js";
import { encodePascalString, decodePascalString, decodeInt32LE } from "../../src/workbench/protocol.js";

function createMockWorkbench(
  handler: (apiFunc: string, params: Record<string, unknown>) => unknown
): { server: Server; port: number; close: () => Promise<void> } {
  const server = createServer((socket: Socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
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
        const statusBuf = encodePascalString("Ok");
        const payloadBuf = encodePascalString(JSON.stringify(response));
        socket.end(Buffer.concat([statusBuf, payloadBuf]));
      } catch (e) {
        const errBuf = encodePascalString(`Error: ${String(e)}`);
        socket.end(errBuf);
      }
    });
  });

  let resolvedPort = 0;
  server.listen(0);
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

describe("formatConnectionStatus", () => {
  it("shows disconnected for fresh client", () => {
    const client = new WorkbenchClient("127.0.0.1", 1);
    const status = formatConnectionStatus(client);
    expect(status).toContain("disconnected");
  });

  it("shows edit mode after call with mode=edit", async () => {
    const mock = createMockWorkbench(() => ({ mode: "edit" }));
    const client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    const status = formatConnectionStatus(client);
    expect(status).toContain("edit mode");
    await mock.close();
  });

  it("shows play mode after call with mode=play", async () => {
    const mock = createMockWorkbench(() => ({ mode: "play" }));
    const client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    const status = formatConnectionStatus(client);
    expect(status).toContain("play mode");
    await mock.close();
  });

  it("shows connected (mode unknown) when no mode in response", async () => {
    const mock = createMockWorkbench(() => ({ status: "ok" }));
    const client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("ReloadScripts");
    const status = formatConnectionStatus(client);
    expect(status).toContain("mode unknown");
    await mock.close();
  });
});

describe("requireEditMode", () => {
  let mock: ReturnType<typeof createMockWorkbench>;
  let client: WorkbenchClient;

  afterEach(async () => {
    if (mock) await mock.close();
  });

  it("returns null when mode is unknown (allow through)", () => {
    client = new WorkbenchClient("127.0.0.1", 1);
    expect(requireEditMode(client, "create entity")).toBeNull();
  });

  it("returns null when mode is edit", async () => {
    mock = createMockWorkbench(() => ({ mode: "edit" }));
    client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    expect(requireEditMode(client, "create entity")).toBeNull();
  });

  it("returns warning when mode is play", async () => {
    mock = createMockWorkbench(() => ({ mode: "play" }));
    client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    const result = requireEditMode(client, "create entity");
    expect(result).not.toBeNull();
    expect(result).toContain("play mode");
    expect(result).toContain("wb_stop");
  });
});

describe("requirePlayMode", () => {
  let mock: ReturnType<typeof createMockWorkbench>;
  let client: WorkbenchClient;

  afterEach(async () => {
    if (mock) await mock.close();
  });

  it("returns null when mode is unknown", () => {
    client = new WorkbenchClient("127.0.0.1", 1);
    expect(requirePlayMode(client, "stop")).toBeNull();
  });

  it("returns null when mode is play", async () => {
    mock = createMockWorkbench(() => ({ mode: "play" }));
    client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    expect(requirePlayMode(client, "stop")).toBeNull();
  });

  it("returns warning when mode is edit", async () => {
    mock = createMockWorkbench(() => ({ mode: "edit" }));
    client = new WorkbenchClient("127.0.0.1", mock.port);
    await client.call("EMCP_WB_Ping");
    const result = requirePlayMode(client, "stop play mode");
    expect(result).not.toBeNull();
    expect(result).toContain("edit mode");
    expect(result).toContain("wb_play");
  });
});
