import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseEngineConf,
  serializeEngineConf,
  ENGINE_FIELD_KEYS,
  type EngineFields,
} from "./engine-conf.js";
import { listEngineConfFiles, engineConfPath } from "./discover.js";

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

function isValidEngineFields(value: unknown): value is EngineFields {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ENGINE_FIELD_KEYS.every((key) => typeof v[key] === "number" && Number.isFinite(v[key]));
}

// Rejects filenames that could escape the Engines directory (path separators or ".." segments).
function isSafeFilename(file: string): boolean {
  return !file.includes("/") && !file.includes("\\") && !file.includes("..");
}

const RELOAD_REMINDER =
  "Written to disk. If this engine's vehicle prefab is open in Workbench, reload it — " +
  "Workbench silently reverts external file edits to a prefab it has open.";

export function createTuningServer(addonPath: string): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        const html = readFileSync(TUNER_HTML_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/engines") {
        sendJson(res, 200, { status: "ok", files: listEngineConfFiles(addonPath) });
        return;
      }

      const fileMatch = /^\/api\/engines\/([^/]+)$/.exec(url.pathname);

      if (fileMatch && req.method === "GET") {
        const file = decodeURIComponent(fileMatch[1]);
        if (!isSafeFilename(file)) {
          sendJson(res, 400, { status: "error", message: "Invalid filename" });
          return;
        }
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
        if (!isSafeFilename(file)) {
          sendJson(res, 400, { status: "error", message: "Invalid filename" });
          return;
        }
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
