# Visual Vehicle Tuning Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user drag sliders in a browser page and see an Arma Reforger vehicle's engine
power/torque/RPM curve reshape live, then write the tuned values straight into the vehicle's real
`Engine_*.conf` file on disk with one click — no hand-editing fields blind, no LLM round trip per
tweak.

**Architecture:** A small standalone local HTTP server (`src/tuning-server/`) inside the
`enfusion-mcp` repo, run as its own process. It reads/writes `Engine_*.conf` files directly via
plain Node file I/O (no Workbench NET API involved — see the spec's architecture correction). A
static browser page (adapted from the existing `arma_reforger_vehicle_tuner.html` Engine tab)
talks to this server directly over `fetch()`.

**Tech Stack:** TypeScript (Node `http`, no new framework dependency), Vitest for tests, plain
HTML/CSS/JS for the static tuner page (canvas-based graph, no build step).

## Global Constraints

- v1 scope is the Engine tab only — no Pacejka tire, no TerrainDrag mud levers, no gearbox/
  suspension. (Spec §Scope)
- The 9 engine fields, exact names, matching `Engine_M151.conf`: `Inertia`, `MaxPower`,
  `MaxTorque`, `RpmMaxPower`, `RpmMaxTorque`, `Steepness`, `Friction`, `RpmIdle`, `RpmMax`.
  (Spec §Architecture)
- This tuning-server only ever edits `.conf` files that already exist under the target addon's
  `Prefabs/Vehicles/Core/Configs/Engines/` directory. It never edits the base-game extracted
  mirror at `E:\Arma reforger data\extracted_files\` — that copy is a read-only reference and
  editing it has zero effect in-game. If the target addon has no override of a given engine file
  yet, the tool must say so clearly rather than silently doing nothing useful (this is new,
  discovered during planning — not yet in the spec, but follows directly from "must actually
  affect the mod").
- After every successful Apply, the UI must show the Workbench-reload reminder: editing a prefab's
  file on disk while Workbench has it open gets silently reverted on next save unless reloaded.
  (Spec §Components, backed by `physics-transforms.md`'s documented editor-vs-disk race)
- No live-instance push — file writes only, edit-mode workflow. (Spec §Data flow)
- This is a local developer tool, not part of the published `enfusion-mcp` npm package `bin` — no
  need to wire it into the `dist`/`files` build output. Run via `tsx` directly, same as the
  existing `npm run dev` script does for the main server.

---

## File Structure

```
src/tuning-server/
  engine-conf.ts       # parse/serialize Engine_*.conf text <-> typed fields
  discover.ts           # list/locate Engine_*.conf files under an addon directory
  server.ts              # createTuningServer(addonPath) -> http.Server (pure, testable)
  index.ts                # CLI entry: reads config/env, calls createTuningServer(...).listen()
  public/tuner.html    # static browser page served at GET /
tests/tuning-server/
  engine-conf.test.ts
  discover.test.ts
  server.test.ts
```

---

### Task 1: Engine `.conf` parse/serialize module

**Files:**
- Create: `src/tuning-server/engine-conf.ts`
- Test: `tests/tuning-server/engine-conf.test.ts`

**Interfaces:**
- Produces: `interface EngineFields { Inertia: number; MaxPower: number; MaxTorque: number;
  RpmMaxPower: number; RpmMaxTorque: number; Steepness: number; Friction: number; RpmIdle: number;
  RpmMax: number; }`
- Produces: `const ENGINE_FIELD_KEYS: (keyof EngineFields)[]`
- Produces: `function parseEngineConf(text: string): EngineFields` — throws `Error` listing any
  missing field names if not all 9 are found.
- Produces: `function serializeEngineConf(original: string, values: EngineFields): string` —
  returns `original` with only the 9 known keys' numeric values replaced; every other line
  (braces, unknown keys, whitespace) is left byte-for-byte identical.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tuning-server/engine-conf.test.ts
import { describe, it, expect } from "vitest";
import { parseEngineConf, serializeEngineConf, ENGINE_FIELD_KEYS } from "../../src/tuning-server/engine-conf.js";

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

describe("parseEngineConf", () => {
  it("extracts all 9 known fields from a real Engine_M151.conf", () => {
    const fields = parseEngineConf(M151_CONF);
    expect(fields).toEqual({
      Inertia: 0.3,
      MaxPower: 53,
      MaxTorque: 176,
      RpmMaxPower: 4000,
      RpmMaxTorque: 1800,
      Steepness: 15,
      Friction: 53,
      RpmIdle: 840,
      RpmMax: 6000,
    });
  });

  it("throws listing missing fields when the file is incomplete", () => {
    const incomplete = "Engine {\n MaxPower 53\n}\n";
    expect(() => parseEngineConf(incomplete)).toThrow(/MaxTorque/);
    expect(() => parseEngineConf(incomplete)).toThrow(/RpmMax\b/);
  });
});

describe("serializeEngineConf", () => {
  it("round-trips: parse -> serialize -> parse yields the same values", () => {
    const fields = parseEngineConf(M151_CONF);
    const rewritten = serializeEngineConf(M151_CONF, fields);
    expect(parseEngineConf(rewritten)).toEqual(fields);
  });

  it("changes only the targeted values, leaving unknown keys and formatting untouched", () => {
    const fields = parseEngineConf(M151_CONF);
    const changed = { ...fields, MaxPower: 99, Steepness: 20 };
    const rewritten = serializeEngineConf(M151_CONF, changed);
    expect(rewritten).toContain("RpmRedline 4200"); // unknown key survives untouched
    expect(rewritten).toContain("MaxPower 99");
    expect(rewritten).toContain("Steepness 20");
    expect(rewritten).toContain("MaxTorque 176"); // untouched field survives
    expect(rewritten.split(/\r?\n/).length).toBe(M151_CONF.split(/\r?\n/).length); // no lines added/removed
  });

  it("ENGINE_FIELD_KEYS has exactly the 9 confirmed field names", () => {
    expect(ENGINE_FIELD_KEYS.sort()).toEqual(
      ["Inertia", "MaxPower", "MaxTorque", "RpmMaxPower", "RpmMaxTorque", "Steepness", "Friction", "RpmIdle", "RpmMax"].sort()
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/engine-conf.test.ts`
Expected: FAIL — `Cannot find module '../../src/tuning-server/engine-conf.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/tuning-server/engine-conf.ts

export interface EngineFields {
  Inertia: number;
  MaxPower: number;
  MaxTorque: number;
  RpmMaxPower: number;
  RpmMaxTorque: number;
  Steepness: number;
  Friction: number;
  RpmIdle: number;
  RpmMax: number;
}

export const ENGINE_FIELD_KEYS: (keyof EngineFields)[] = [
  "Inertia",
  "MaxPower",
  "MaxTorque",
  "RpmMaxPower",
  "RpmMaxTorque",
  "Steepness",
  "Friction",
  "RpmIdle",
  "RpmMax",
];

// Matches a single "Key Value" line inside an Engine { ... } block, e.g. " MaxPower 53".
const ENGINE_LINE_RE = /^(\s*)([A-Za-z][A-Za-z0-9_]*)\s+(-?\d+(?:\.\d+)?)\s*$/;

export function parseEngineConf(text: string): EngineFields {
  const found: Partial<Record<keyof EngineFields, number>> = {};

  for (const line of text.split(/\r?\n/)) {
    const m = ENGINE_LINE_RE.exec(line);
    if (!m) continue;
    const key = m[2];
    if ((ENGINE_FIELD_KEYS as string[]).includes(key)) {
      found[key as keyof EngineFields] = parseFloat(m[3]);
    }
  }

  const missing = ENGINE_FIELD_KEYS.filter((k) => found[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`Engine .conf missing required field(s): ${missing.join(", ")}`);
  }

  return found as EngineFields;
}

export function serializeEngineConf(original: string, values: EngineFields): string {
  const usesCrlf = original.includes("\r\n");
  const lines = original.split(/\r?\n/);

  const out = lines.map((line) => {
    const m = ENGINE_LINE_RE.exec(line);
    if (!m) return line;
    const key = m[2];
    if (!(ENGINE_FIELD_KEYS as string[]).includes(key)) return line;
    const indent = m[1];
    return `${indent}${key} ${values[key as keyof EngineFields]}`;
  });

  return out.join(usesCrlf ? "\r\n" : "\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/engine-conf.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/engine-conf.ts tests/tuning-server/engine-conf.test.ts
git commit -m "feat(tuning-server): add Engine .conf parse/serialize module"
```

---

### Task 2: Discover engine `.conf` files under an addon directory

**Files:**
- Create: `src/tuning-server/discover.ts`
- Test: `tests/tuning-server/discover.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `function listEngineConfFiles(addonPath: string): string[]` — returns bare filenames
  (e.g. `"Engine_M151.conf"`), sorted alphabetically, empty array if the directory doesn't exist.
- Produces: `function engineConfPath(addonPath: string, file: string): string` — joins
  `addonPath` + the fixed subpath + `file`.
- Produces: `const ENGINE_CONF_SUBPATH = "Prefabs/Vehicles/Core/Configs/Engines"` (exported, so
  Task 3's tests and the manual verification step can reference the same constant).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tuning-server/discover.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listEngineConfFiles, engineConfPath, ENGINE_CONF_SUBPATH } from "../../src/tuning-server/discover.js";

describe("listEngineConfFiles / engineConfPath", () => {
  let addonDir: string;

  beforeEach(() => {
    addonDir = mkdtempSync(join(tmpdir(), "tuning-server-test-"));
  });

  afterEach(() => {
    rmSync(addonDir, { recursive: true, force: true });
  });

  it("returns an empty array when the Engines directory doesn't exist", () => {
    expect(listEngineConfFiles(addonDir)).toEqual([]);
  });

  it("lists .conf files sorted alphabetically, ignoring non-.conf files", () => {
    const enginesDir = join(addonDir, ENGINE_CONF_SUBPATH);
    mkdirSync(enginesDir, { recursive: true });
    writeFileSync(join(enginesDir, "Engine_UAZ469.conf"), "Engine {}\n");
    writeFileSync(join(enginesDir, "Engine_M151.conf"), "Engine {}\n");
    writeFileSync(join(enginesDir, "readme.txt"), "not a conf\n");

    expect(listEngineConfFiles(addonDir)).toEqual(["Engine_M151.conf", "Engine_UAZ469.conf"]);
  });

  it("engineConfPath joins addonPath, the fixed subpath, and the filename", () => {
    const p = engineConfPath(addonDir, "Engine_M151.conf");
    expect(p).toBe(join(addonDir, ENGINE_CONF_SUBPATH, "Engine_M151.conf"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/discover.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/tuning-server/discover.ts
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ENGINE_CONF_SUBPATH = "Prefabs/Vehicles/Core/Configs/Engines";

export function listEngineConfFiles(addonPath: string): string[] {
  const dir = join(addonPath, ...ENGINE_CONF_SUBPATH.split("/"));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".conf"))
    .sort();
}

export function engineConfPath(addonPath: string, file: string): string {
  return join(addonPath, ...ENGINE_CONF_SUBPATH.split("/"), file);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/discover.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/discover.ts tests/tuning-server/discover.test.ts
git commit -m "feat(tuning-server): add engine .conf file discovery under an addon path"
```

---

### Task 3: HTTP server — list, read, write engine `.conf` files

**Files:**
- Create: `src/tuning-server/server.ts`
- Test: `tests/tuning-server/server.test.ts`

**Interfaces:**
- Consumes: `EngineFields`, `ENGINE_FIELD_KEYS`, `parseEngineConf`, `serializeEngineConf` from
  Task 1 (`./engine-conf.js`); `listEngineConfFiles`, `engineConfPath` from Task 2
  (`./discover.js`).
- Produces: `function createTuningServer(addonPath: string): http.Server` — a plain Node HTTP
  server, not yet listening (caller calls `.listen(port)`). Pure function of `addonPath` so it's
  testable without touching real config or the filesystem outside a temp dir.
- Routes (all responses are `application/json`, shape `{status: "ok"|"error", ...}`):
  - `GET /api/engines` → `{status: "ok", files: string[]}`
  - `GET /api/engines/:file` → `{status: "ok", file, fields: EngineFields}` or 404
    `{status: "error", message}`
  - `POST /api/engines/:file` with JSON body `{fields: EngineFields}` → `{status: "ok", file,
    message}` (message includes the Workbench-reload reminder) or 400/404/500
    `{status: "error", message}`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tuning-server/server.test.ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tuning-server/server.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/tuning-server/server.ts
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  parseEngineConf,
  serializeEngineConf,
  ENGINE_FIELD_KEYS,
  type EngineFields,
} from "./engine-conf.js";
import { listEngineConfFiles, engineConfPath } from "./discover.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isValidEngineFields(value: unknown): value is EngineFields {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ENGINE_FIELD_KEYS.every((key) => typeof v[key] === "number" && Number.isFinite(v[key]));
}

const RELOAD_REMINDER =
  "Written to disk. If this engine's vehicle prefab is open in Workbench, reload it — " +
  "Workbench silently reverts external file edits to a prefab it has open.";

export function createTuningServer(addonPath: string): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/api/engines") {
        sendJson(res, 200, { status: "ok", files: listEngineConfFiles(addonPath) });
        return;
      }

      const fileMatch = /^\/api\/engines\/([^/]+)$/.exec(url.pathname);

      if (fileMatch && req.method === "GET") {
        const file = decodeURIComponent(fileMatch[1]);
        const filePath = engineConfPath(addonPath, file);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { status: "error", message: `Not found: ${file}` });
          return;
        }
        const text = readFileSync(filePath, "utf-8");
        const fields = parseEngineConf(text);
        sendJson(res, 200, { status: "ok", file, fields });
        return;
      }

      if (fileMatch && req.method === "POST") {
        const file = decodeURIComponent(fileMatch[1]);
        const filePath = engineConfPath(addonPath, file);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { status: "error", message: `Not found: ${file}` });
          return;
        }

        const rawBody = await readBody(req);
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          sendJson(res, 400, { status: "error", message: "Invalid JSON body" });
          return;
        }

        const fields = (parsedBody as { fields?: unknown }).fields;
        if (!isValidEngineFields(fields)) {
          sendJson(res, 400, {
            status: "error",
            message: `Body must include a "fields" object with all of: ${ENGINE_FIELD_KEYS.join(", ")}`,
          });
          return;
        }

        const original = readFileSync(filePath, "utf-8");
        const updated = serializeEngineConf(original, fields);
        writeFileSync(filePath, updated, "utf-8");
        sendJson(res, 200, { status: "ok", file, message: RELOAD_REMINDER });
        return;
      }

      sendJson(res, 404, { status: "error", message: "Not found" });
    } catch (e) {
      sendJson(res, 500, { status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/server.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tuning-server/server.ts tests/tuning-server/server.test.ts
git commit -m "feat(tuning-server): add HTTP server for reading/writing engine .conf files"
```

---

### Task 4: CLI entry point

**Files:**
- Create: `src/tuning-server/index.ts`
- Modify: `package.json` (add `"tuning-server"` script)

**Interfaces:**
- Consumes: `createTuningServer` from Task 3 (`./server.js`); `loadConfig` from
  `../config.js` (existing).
- Produces: nothing consumed by later tasks — this is the process entry point.

- [ ] **Step 1: Write the implementation**

No test for this file — it's a thin CLI wrapper (env/config wiring + `console.log` + `.listen()`),
which is exactly the kind of glue code excluded from unit testing by convention; Task 3's tests
already cover the actual server logic through the real HTTP layer.

```typescript
// src/tuning-server/index.ts
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { createTuningServer } from "./server.js";

const config = loadConfig();
const addonName = process.env.ENFUSION_TUNING_ADDON || "RoadForger";
const addonPath = join(config.projectPath, addonName);
const port = process.env.ENFUSION_TUNING_PORT ? parseInt(process.env.ENFUSION_TUNING_PORT, 10) : 5790;

const server = createTuningServer(addonPath);
server.listen(port, () => {
  console.log(`Vehicle tuning server: http://127.0.0.1:${port}`);
  console.log(`  addon:  ${addonName}`);
  console.log(`  path:   ${addonPath}`);
  console.log(`  Set ENFUSION_TUNING_ADDON to point at a different addon, ENFUSION_TUNING_PORT to change the port.`);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (alongside the existing `"dev"` entry):

```json
"tuning-server": "tsx src/tuning-server/index.ts",
```

- [ ] **Step 3: Verify it starts**

Run: `npm run tuning-server`
Expected: Console prints the three lines above (addon path will be
`<Documents>/My Games/ArmaReforgerWorkbench/addons/RoadForger` by default) and the process keeps
running without throwing. Stop it with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/tuning-server/index.ts package.json
git commit -m "feat(tuning-server): add CLI entry point and npm script"
```

---

### Task 5: Static tuner page — Engine tab only, wired to the API

**Files:**
- Create: `src/tuning-server/public/tuner.html`
- Modify: `src/tuning-server/server.ts` (serve it at `GET /`)
- Test: extend `tests/tuning-server/server.test.ts`

**Interfaces:**
- Consumes: the three routes from Task 3 (`GET /api/engines`, `GET /api/engines/:file`,
  `POST /api/engines/:file`).
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Write the failing test for the static route**

Add to `tests/tuning-server/server.test.ts` (inside the existing `describe("tuning server", ...)`
block, using the same `beforeEach`/`afterEach` setup already in the file):

```typescript
  it("GET / serves the tuner HTML page", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<title>");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/tuning-server/server.test.ts`
Expected: FAIL — `GET /` currently falls through to the generic 404 JSON handler, so
`content-type` is `application/json`, not `text/html`.

- [ ] **Step 3: Write the tuner page**

```html
<!-- src/tuning-server/public/tuner.html -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RoadForger — Engine Tuner</title>
</head>
<body>
<style>
body{background:#1a1918;margin:0;padding:16px 20px}
*{box-sizing:border-box;margin:0;padding:0}
.root{padding:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8e6e3;font-size:13px}
.lay{display:grid;grid-template-columns:minmax(0,256px) minmax(0,1fr);gap:1.5rem;align-items:start}
.sec{font-size:10px;font-weight:500;color:#6b6762;letter-spacing:.09em;text-transform:uppercase;margin:12px 0 5px;padding-bottom:4px;border-bottom:.5px solid rgba(255,255,255,0.08)}
.sec:first-child{margin-top:0}
.sr{display:flex;align-items:center;gap:7px;margin-bottom:1px}
.lbl{font-size:12px;color:#a8a49e;width:152px;flex-shrink:0}
.sr input[type=range]{flex:1;min-width:0}
.vl{font-size:12px;font-weight:500;min-width:44px;text-align:right;flex-shrink:0;color:#e8e6e3}
.tip2{font-size:11px;color:#6b6762;margin:2px 0 7px 159px;line-height:1.5}
.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:10px}
.stat{background:#2a2927;border-radius:8px;padding:7px 9px}
.sl{font-size:10px;color:#6b6762;margin-bottom:2px}
.sv{font-size:15px;font-weight:500}
.rc{display:flex;flex-direction:column;gap:10px}
.cc{background:#2a2927;border-radius:12px;padding:.85rem 1rem;overflow:hidden}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#a8a49e;margin-bottom:8px}
.leg span{display:inline-flex;align-items:center;gap:5px}
.sw{width:20px;height:2px;border-radius:1px;display:inline-block;flex-shrink:0}
.ax{font-size:11px;color:#6b6762;text-align:center;margin-top:6px}
select,.applybtn{font-size:13px;padding:6px 14px;border:.5px solid rgba(255,255,255,0.14);border-radius:8px;background:#2a2927;color:#e8e6e3;font-family:inherit;cursor:pointer}
.applybtn{background:#378ADD;border-color:#378ADD;font-weight:500}
.applybtn:disabled{opacity:.5;cursor:default}
.toprow{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.banner{font-size:12px;padding:9px 12px;border-radius:8px;margin-bottom:12px;line-height:1.5;display:none}
.banner.ok{display:block;background:rgba(59,109,17,0.18);color:#9fd97a;border:.5px solid rgba(59,109,17,0.4)}
.banner.err{display:block;background:rgba(226,75,74,0.15);color:#f0a3a2;border:.5px solid rgba(226,75,74,0.4)}
</style>

<div class="root">
  <div class="toprow">
    <select id="engineSelect"><option value="">Loading engines...</option></select>
    <button class="applybtn" id="applyBtn" disabled onclick="applyValues()">Apply to disk</button>
  </div>
  <div id="banner" class="banner"></div>

  <div class="lay">
    <div>
      <div class="sec">Power &amp; torque</div>
      <div class="sr"><span class="lbl">Max Power (kW)</span><input type="range" id="ePw" min="30" max="600" step="1" value="246" oninput="sE();dE()"><span class="vl" id="ePwV">246</span></div>
      <div class="sr"><span class="lbl">Max Torque (Nm)</span><input type="range" id="eTq" min="50" max="1500" step="5" value="583" oninput="sE();dE()"><span class="vl" id="eTqV">583</span></div>
      <div class="sr"><span class="lbl">Rpm Max Power</span><input type="range" id="eRpp" min="1500" max="8500" step="50" value="4100" oninput="sE();dE()"><span class="vl" id="eRppV">4100</span></div>
      <div class="sr"><span class="lbl">Rpm Max Torque</span><input type="range" id="eRpt" min="500" max="6000" step="50" value="3000" oninput="sE();dE()"><span class="vl" id="eRptV">3000</span></div>
      <div class="tip2">Must be &le; Rpm Max Power</div>
      <div class="sec">RPM range</div>
      <div class="sr"><span class="lbl">Rpm Idle</span><input type="range" id="eIdle" min="400" max="1500" step="25" value="850" oninput="sE();dE()"><span class="vl" id="eIdleV">850</span></div>
      <div class="sr"><span class="lbl">Rpm Max</span><input type="range" id="eRmax" min="2500" max="10000" step="100" value="7500" oninput="sE();dE()"><span class="vl" id="eRmaxV">7500</span></div>
      <div class="sec">Character</div>
      <div class="sr"><span class="lbl">Steepness</span><input type="range" id="eSteep" min="1" max="40" step="0.5" value="15" oninput="sE();dE()"><span class="vl" id="eSteepV">15.0</span></div>
      <div class="tip2">Low = gradual diesel swell · High = peaky, hits hard at once</div>
      <div class="sr"><span class="lbl">Friction (Nm)</span><input type="range" id="eFric" min="1" max="120" step="1" value="35" oninput="sE();dE()"><span class="vl" id="eFricV">35</span></div>
      <div class="tip2">Engine braking — drag when you lift off</div>
      <div class="sr"><span class="lbl">Inertia (kg·m²)</span><input type="range" id="eIner" min="0.02" max="0.8" step="0.01" value="0.16" oninput="sE()"><span class="vl" id="eInerV">0.160</span></div>
      <div class="tip2">Heavy flywheel — high = slow to rev, less RPM drop on shifts</div>
      <div class="stats">
        <div class="stat"><div class="sl">Horsepower</div><div class="sv" id="eHp">330 hp</div></div>
        <div class="stat"><div class="sl">Max clutch Nm</div><div class="sv" id="eCl">933</div></div>
        <div class="stat"><div class="sl">lb-ft torque</div><div class="sv" id="eLb">430</div></div>
      </div>
    </div>
    <div class="rc">
      <div class="cc">
        <div class="leg"><span><span class="sw" style="background:#378ADD"></span>Power (kW)</span><span><span class="sw" style="background:#E24B4A"></span>Torque (Nm)</span></div>
        <div style="position:relative;width:100%;height:220px"><canvas id="cE" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
        <div class="ax">RPM — Power &amp; Torque</div>
      </div>
      <div class="cc">
        <div class="leg"><span><span class="sw" style="background:#E24B4A"></span>Steep 5 (diesel)</span><span><span class="sw" style="background:#378ADD"></span>Current</span><span><span class="sw" style="background:#3B6D11"></span>Steep 30 (sport)</span></div>
        <div style="position:relative;width:100%;height:140px"><canvas id="cSt" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
        <div class="ax">Steepness — how quickly torque builds to its peak</div>
      </div>
    </div>
  </div>
</div>

<script>
var EL=document;
function g(id){return parseFloat(EL.getElementById(id).value);}
function sv(id,t){EL.getElementById(id).textContent=t;}
function el(id){return EL.getElementById(id);}

var GC='rgba(255,255,255,0.07)';
var AC='rgba(255,255,255,0.2)';
var TC2='rgba(255,255,255,0.32)';

var currentFile = null;

// -- slider readouts --
function sE(){
  sv('ePwV',g('ePw').toFixed(0));sv('eTqV',g('eTq').toFixed(0));
  sv('eRppV',g('eRpp').toFixed(0));sv('eRptV',g('eRpt').toFixed(0));
  sv('eIdleV',g('eIdle').toFixed(0));sv('eRmaxV',g('eRmax').toFixed(0));
  sv('eSteepV',g('eSteep').toFixed(1));sv('eFricV',g('eFric').toFixed(0));sv('eInerV',g('eIner').toFixed(3));
  sv('eHp',Math.round(g('ePw')*1.341)+' hp');sv('eCl',Math.round(g('eTq')*1.6));sv('eLb',Math.round(g('eTq')*0.7376));
}

function setup(id){
  var cv=el(id),par=cv.parentElement,dpr=window.devicePixelRatio||1;
  var W=par.offsetWidth||500,H=par.offsetHeight||260;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  var ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
  return{ctx:ctx,W:W,H:H};
}

function engT(rpm,pw,tq,rpp,rpt,idle,rmax,steep,fric){
  if(rpm<=idle)return 0;
  var t,tA=pw*9549/rpp;
  if(rpm<=rpt){var r=1/(1+Math.exp(-steep*(rpm-rpt)/rmax)),r0=1/(1+Math.exp(-steep*(idle-rpt)/rmax));t=tq*(r-r0)/(1-r0+1e-9);}
  else if(rpm<=rpp){t=tq+(tA-tq)*(rpm-rpt)/(rpp-rpt+1);}
  else{t=pw*9549/rpm;}
  return rpm>=rmax?0:Math.max(0,t-fric);
}

function dE(){
  var pw=g('ePw'),tq=g('eTq'),rpp=g('eRpp'),rpt=g('eRpt'),idle=g('eIdle'),rmax=g('eRmax'),steep=g('eSteep'),fric=g('eFric');
  var s=setup('cE'),ctx=s.ctx,W=s.W,H=s.H;
  var L=46,R=46,T=12,Bo=22,pw2=W-L-R,ph=H-T-Bo;
  ctx.clearRect(0,0,W,H);
  var Ts=[],Ps=[],Rs=[];
  for(var i=0;i<=150;i++){var rpm=idle+(rmax-idle)*(i/150),t=engT(rpm,pw,tq,rpp,rpt,idle,rmax,steep,fric);Rs.push(rpm);Ts.push(t);Ps.push(Math.min(t*rpm/9549,pw));}
  var maxT=Math.max.apply(null,Ts)||1,maxP=Math.max.apply(null,Ps)||1;
  function tx(r){return L+(r-idle)/(rmax-idle)*pw2;}
  function tyT(t){return T+ph*(1-t/maxT);}
  function tyP(p){return T+ph*(1-p/maxP);}
  for(var i=0;i<=5;i++){ctx.strokeStyle=GC;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(L,T+ph*i/5);ctx.lineTo(L+pw2,T+ph*i/5);ctx.stroke();ctx.fillStyle=TC2;ctx.font='11px system-ui,-apple-system,"Segoe UI",sans-serif';ctx.textAlign='right';ctx.fillText(Math.round(maxT*(1-i/5)),L-3,T+ph*i/5+4);}
  for(var i=0;i<=6;i++){ctx.strokeStyle=GC;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(L+pw2*i/6,T);ctx.lineTo(L+pw2*i/6,T+ph);ctx.stroke();ctx.fillStyle=TC2;ctx.font='11px system-ui,-apple-system,"Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText(Math.round(idle+(rmax-idle)*(i/6)),L+pw2*i/6,T+ph+14);}
  ctx.fillStyle='#378ADD';ctx.font='11px system-ui,-apple-system,"Segoe UI",sans-serif';ctx.textAlign='left';
  for(var i=0;i<=5;i++)ctx.fillText(Math.round(maxP*(1-i/5)),L+pw2+4,T+ph*i/5+4);
  ctx.strokeStyle='#E24B4A';ctx.lineWidth=1.5;ctx.globalAlpha=.1;
  ctx.beginPath();Rs.forEach(function(r,i){i===0?ctx.moveTo(tx(r),tyT(Ts[i])):ctx.lineTo(tx(r),tyT(Ts[i]));});
  ctx.lineTo(tx(Rs[Rs.length-1]),T+ph);ctx.lineTo(tx(idle),T+ph);ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle='#E24B4A';ctx.lineWidth=2;ctx.beginPath();
  Rs.forEach(function(r,i){i===0?ctx.moveTo(tx(r),tyT(Ts[i])):ctx.lineTo(tx(r),tyT(Ts[i]));});ctx.stroke();
  ctx.strokeStyle='#378ADD';ctx.lineWidth=1.5;ctx.globalAlpha=.09;
  ctx.beginPath();Rs.forEach(function(r,i){i===0?ctx.moveTo(tx(r),tyP(Ps[i])):ctx.lineTo(tx(r),tyP(Ps[i]));});
  ctx.lineTo(tx(Rs[Rs.length-1]),T+ph);ctx.lineTo(tx(idle),T+ph);ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle='#378ADD';ctx.lineWidth=2;ctx.beginPath();
  Rs.forEach(function(r,i){i===0?ctx.moveTo(tx(r),tyP(Ps[i])):ctx.lineTo(tx(r),tyP(Ps[i]));});ctx.stroke();
  ctx.fillStyle='#E24B4A';ctx.font='500 11px system-ui,-apple-system,"Segoe UI",sans-serif';ctx.textAlign='left';ctx.fillText('Nm',L+5,T+14);
  ctx.fillStyle='#378ADD';ctx.fillText('kW',L+5,T+26);
  var rx=tx(rmax*.87);
  ctx.strokeStyle='rgba(220,60,60,0.22)';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(rx,T);ctx.lineTo(rx,T+ph);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(210,60,60,0.5)';ctx.font='11px system-ui,-apple-system,"Segoe UI",sans-serif';ctx.textAlign='right';ctx.fillText('redline',rx-3,T+11);

  var s2=setup('cSt'),c2=s2.ctx,W2=s2.W,H2=s2.H,L2=28,T2=8,Bo2=16,pw3=W2-L2-10,ph2=H2-T2-Bo2;
  c2.clearRect(0,0,W2,H2);
  for(var i=0;i<=4;i++){c2.strokeStyle=GC;c2.lineWidth=.5;c2.beginPath();c2.moveTo(L2,T2+ph2*i/4);c2.lineTo(L2+pw3,T2+ph2*i/4);c2.stroke();c2.fillStyle=TC2;c2.font='11px system-ui,-apple-system,"Segoe UI",sans-serif';c2.textAlign='right';c2.fillText((1-i/4).toFixed(1),L2-3,T2+ph2*i/4+4);}
  [[5,'#E24B4A',[4,3]],[steep,'#378ADD',[]],[30,'#3B6D11',[4,3]]].forEach(function(cfg){
    c2.strokeStyle=cfg[1];c2.lineWidth=cfg[2].length?1.5:2.5;
    if(cfg[2].length)c2.setLineDash(cfg[2]);else c2.setLineDash([]);
    c2.beginPath();
    for(var i=0;i<=100;i++){var rpm=(i/100)*rmax,r=1/(1+Math.exp(-cfg[0]*(rpm-rpt)/rmax)),r0=1/(1+Math.exp(-cfg[0]*(0-rpt)/rmax));var v=Math.max(0,Math.min(1,(r-r0)/(1-r0+1e-9)));i===0?c2.moveTo(L2+pw3*(i/100),T2+ph2*(1-v)):c2.lineTo(L2+pw3*(i/100),T2+ph2*(1-v));}
    c2.stroke();c2.setLineDash([]);
  });
}

// -- API wiring --
var FIELD_MAP = { ePw:'MaxPower', eTq:'MaxTorque', eRpp:'RpmMaxPower', eRpt:'RpmMaxTorque', eIdle:'RpmIdle', eRmax:'RpmMax', eSteep:'Steepness', eFric:'Friction', eIner:'Inertia' };

function showBanner(kind, text){
  var b = el('banner');
  b.className = 'banner ' + kind;
  b.textContent = text;
}

function setSlidersFromFields(fields){
  Object.keys(FIELD_MAP).forEach(function(sliderId){
    el(sliderId).value = fields[FIELD_MAP[sliderId]];
  });
  sE(); dE();
}

function currentFieldsFromSliders(){
  var fields = {};
  Object.keys(FIELD_MAP).forEach(function(sliderId){
    fields[FIELD_MAP[sliderId]] = g(sliderId);
  });
  return fields;
}

async function loadEngineList(){
  var res = await fetch('/api/engines');
  var body = await res.json();
  var select = el('engineSelect');
  select.innerHTML = '';
  if (!body.files || body.files.length === 0) {
    select.innerHTML = '<option value="">No engine .conf overrides found</option>';
    showBanner('err', 'No engine .conf files found under this addon. In Workbench, right-click the vehicle\\'s Engine_*.conf resource and choose Override/Duplicate into this addon before tuning it here.');
    return;
  }
  body.files.forEach(function(f){
    var opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    select.appendChild(opt);
  });
  select.onchange = function(){ loadEngine(select.value); };
  loadEngine(select.value);
}

async function loadEngine(file){
  if (!file) return;
  currentFile = file;
  el('applyBtn').disabled = true;
  var res = await fetch('/api/engines/' + encodeURIComponent(file));
  var body = await res.json();
  if (body.status !== 'ok') {
    showBanner('err', body.message || 'Failed to load ' + file);
    return;
  }
  setSlidersFromFields(body.fields);
  el('applyBtn').disabled = false;
  showBanner('ok', 'Loaded live values from ' + file + '.');
}

async function applyValues(){
  if (!currentFile) return;
  el('applyBtn').disabled = true;
  var res = await fetch('/api/engines/' + encodeURIComponent(currentFile), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: currentFieldsFromSliders() }),
  });
  var body = await res.json();
  el('applyBtn').disabled = false;
  if (body.status !== 'ok') {
    showBanner('err', body.message || 'Failed to apply changes');
    return;
  }
  showBanner('ok', body.message);
}

sE(); dE();
loadEngineList();
</script>
</body>
</html>
```

- [ ] **Step 4: Wire the static route into the server**

Modify `src/tuning-server/server.ts`. Replace the existing `node:http` and `node:fs` import lines
at the top of the file with these (adds `node:url` and `node:path`, and adds `dirname`/`join`):

```typescript
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
```

Add this constant right after the imports, before `sendJson`:

```typescript
const TUNER_HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), "public", "tuner.html");
```

Then, inside the request handler in `createTuningServer`, add this branch as the **first** check
(before the `GET /api/engines` branch):

```typescript
      if (req.method === "GET" && url.pathname === "/") {
        const html = readFileSync(TUNER_HTML_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tuning-server/server.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Manual end-to-end verification**

1. Copy a real engine conf into a throwaway override so there's something to tune:
   ```
   mkdir -p "<RoadForger addon path>/Prefabs/Vehicles/Core/Configs/Engines"
   copy "E:\Arma reforger data\extracted_files\Prefabs\Vehicles\Core\Configs\Engines\Engine_M151.conf" "<RoadForger addon path>\Prefabs\Vehicles\Core\Configs\Engines\Engine_M151.conf"
   ```
   (This is a throwaway local file for verification — do not commit it as part of this plan
   unless you separately decide RoadForger should ship an M151 engine override.)
2. Run: `npm run tuning-server`
3. Open `http://127.0.0.1:5790/` in a browser.
4. Confirm `Engine_M151.conf` appears in the dropdown and the sliders/graph populate with the
   real values (MaxPower 53, Steepness 15, etc. — matches the file read in Task 1's fixture).
5. Drag the Max Power slider and confirm the graph reshapes live with no network activity (check
   browser devtools Network tab — no requests during dragging).
6. Click "Apply to disk", confirm the success banner includes the Workbench-reload reminder, and
   open the `.conf` file on disk to confirm the new value was written and everything else
   (`RpmRedline`, braces, formatting) is untouched.

- [ ] **Step 7: Commit**

```bash
git add src/tuning-server/public/tuner.html src/tuning-server/server.ts tests/tuning-server/server.test.ts
git commit -m "feat(tuning-server): serve the engine tuner page and wire it to the API"
```
