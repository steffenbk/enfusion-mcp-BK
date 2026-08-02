import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENGINE_FIELD_KEYS, type EngineFields } from "./engine-conf.js";
import { listTunableVehicles, vehicleEtPath, isSafeVehicleRelPath } from "./discover.js";
import { resolveEngineFields } from "./resolve-engine.js";
import { findEngineBlock, writeEngineFields } from "./et-engine-block.js";

const TUNER_HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), "public", "tuner.html");

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

/** A partial set of engine changes: at least one known key, all finite numbers. */
function isValidEngineChanges(value: unknown): value is Partial<EngineFields> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;
  if (!keys.every((k) => (ENGINE_FIELD_KEYS as string[]).includes(k))) return false;
  return keys.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
}

const RELOAD_REMINDER =
  "Written to disk. If this vehicle prefab is open in Workbench, reload it — " +
  "Workbench silently reverts external file edits to a prefab it has open.";

export function createTuningServer(addonPath: string, extractedPath?: string): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        const html = readFileSync(TUNER_HTML_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/vehicles") {
        sendJson(res, 200, { status: "ok", vehicles: listTunableVehicles(addonPath) });
        return;
      }

      const match = /^\/api\/vehicles\/(.+)$/.exec(url.pathname);
      if (match && (req.method === "GET" || req.method === "POST")) {
        const rel = decodeURIComponent(match[1]);
        if (!isSafeVehicleRelPath(rel)) {
          sendJson(res, 400, { status: "error", message: "Invalid vehicle path" });
          return;
        }
        const filePath = vehicleEtPath(addonPath, rel);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { status: "error", message: `Not found: ${rel}` });
          return;
        }

        if (req.method === "GET") {
          const modText = readFileSync(filePath, "utf-8");
          const fields = resolveEngineFields({ modText, relPath: rel, extractedPath });
          sendJson(res, 200, { status: "ok", vehicle: rel, fields });
          return;
        }

        const contentType = req.headers["content-type"];
        if (typeof contentType !== "string" || !contentType.toLowerCase().includes("application/json")) {
          sendJson(res, 400, { status: "error", message: "Content-Type must be application/json" });
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

        const changes = (parsedBody as { changes?: unknown }).changes;
        if (!isValidEngineChanges(changes)) {
          sendJson(res, 400, {
            status: "error",
            message: `Body must include a "changes" object with at least one numeric field from: ${ENGINE_FIELD_KEYS.join(", ")}`,
          });
          return;
        }

        const original = readFileSync(filePath, "utf-8");
        const loc = findEngineBlock(original);
        if (!loc) {
          sendJson(res, 409, {
            status: "error",
            message:
              `${rel} has no Engine block. Add the engine override in Workbench first — ` +
              `this tool never creates the block structure.`,
          });
          return;
        }

        writeFileSync(filePath, writeEngineFields(original, loc, changes), "utf-8");
        sendJson(res, 200, {
          status: "ok",
          vehicle: rel,
          written: Object.keys(changes),
          message: RELOAD_REMINDER,
        });
        return;
      }

      sendJson(res, 404, { status: "error", message: "Not found" });
    } catch (e) {
      sendJson(res, 500, { status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  });
}
