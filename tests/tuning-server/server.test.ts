import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createTuningServer } from "../../src/tuning-server/server.js";
import { ENGINE_CONF_SUBPATH } from "../../src/tuning-server/discover.js";

const M151_CONF = `Engine {
 Inertia 0.3
 MaxPower 53
 MaxTorque 176
 RpmMaxPower 4000
 RpmMaxTorque 1800
 Steepness 15
 Friction 53
 RpmIdle 840
 RpmRedline 4200
 RpmMax 6000
}
`;

describe("tuning server", () => {
  let addonDir: string;
  let enginesDir: string;
  let baseUrl: string;
  let server: ReturnType<typeof createTuningServer>;

  beforeEach(async () => {
    addonDir = mkdtempSync(join(tmpdir(), "tuning-server-test-"));
    enginesDir = join(addonDir, ...ENGINE_CONF_SUBPATH.split("/"));
    mkdirSync(enginesDir, { recursive: true });
    writeFileSync(join(enginesDir, "Engine_M151.conf"), M151_CONF);

    server = createTuningServer(addonDir);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("GET /api/engines lists discovered files", async () => {
    const res = await fetch(`${baseUrl}/api/engines`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok", files: ["Engine_M151.conf"] });
  });

  it("GET /api/engines/:file returns parsed fields", async () => {
    const res = await fetch(`${baseUrl}/api/engines/Engine_M151.conf`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.fields.MaxPower).toBe(53);
    expect(body.fields.Steepness).toBe(15);
  });

  it("GET /api/engines/:file 404s for a file that doesn't exist", async () => {
    const res = await fetch(`${baseUrl}/api/engines/Engine_Nope.conf`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  it("GET /api/engines/:file rejects a path-traversal filename with 400", async () => {
    const res = await fetch(`${baseUrl}/api/engines/${encodeURIComponent("../../../etc/passwd")}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ status: "error", message: "Invalid filename" });
  });

  it("POST /api/engines/:file writes the new values to disk and returns the reload reminder", async () => {
    const res = await fetch(`${baseUrl}/api/engines/Engine_M151.conf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          Inertia: 0.3, MaxPower: 99, MaxTorque: 176, RpmMaxPower: 4000,
          RpmMaxTorque: 1800, Steepness: 20, Friction: 53, RpmIdle: 840, RpmMax: 6000,
        },
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.message).toMatch(/reload/i);

    const onDisk = readFileSync(join(enginesDir, "Engine_M151.conf"), "utf-8");
    expect(onDisk).toContain("MaxPower 99");
    expect(onDisk).toContain("Steepness 20");
    expect(onDisk).toContain("RpmRedline 4200"); // untouched
  });

  it("POST /api/engines/:file rejects a body missing a required field", async () => {
    const res = await fetch(`${baseUrl}/api/engines/Engine_M151.conf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { MaxPower: 99 } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  it("POST /api/engines/:file rejects a path-traversal filename with 400", async () => {
    const res = await fetch(`${baseUrl}/api/engines/${encodeURIComponent("../../../etc/passwd")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {} }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ status: "error", message: "Invalid filename" });
  });
});
