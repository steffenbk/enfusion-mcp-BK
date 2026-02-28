/**
 * TCP client for the Workbench NET API.
 *
 * Each rawCall() opens a fresh TCP connection, sends one request, reads the
 * response, and closes the socket (protocol requirement).
 *
 * call() wraps rawCall() with auto-launch: if Workbench isn't running,
 * it installs handler scripts, launches the exe, waits for the NET API,
 * and retries the original call.
 */

import { Socket } from "node:net";
import { existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { encodeRequest, decodeResponse } from "./protocol.js";
import { logger } from "../utils/logger.js";
import type { Config } from "../config.js";

const DEFAULT_CLIENT_ID = "EnfusionMCP";
const DEFAULT_TIMEOUT_MS = 10_000;
const WORKBENCH_EXE = "ArmaReforgerWorkbenchSteamDiag.exe";
const WORKBENCH_SUBDIR = "Workbench";
const HANDLER_FOLDER = "EnfusionMCP";
const LAUNCH_POLL_INTERVAL_MS = 3_000;
const LAUNCH_TIMEOUT_MS = 90_000;

export interface WorkbenchCallOptions {
  /** Timeout in milliseconds (default 10 000). */
  timeout?: number;
  /** Skip auto-launch on connection failure (used internally by ping). */
  skipAutoLaunch?: boolean;
}

export class WorkbenchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CONNECTION_REFUSED"
      | "TIMEOUT"
      | "PROTOCOL_ERROR"
      | "API_ERROR"
      | "LAUNCH_FAILED" = "API_ERROR"
  ) {
    super(message);
    this.name = "WorkbenchError";
  }
}

export class WorkbenchClient {
  private launching = false;
  private launchPromise: Promise<void> | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly config?: Config,
    private readonly clientId: string = DEFAULT_CLIENT_ID
  ) {}

  /**
   * Call a Workbench NET API function.
   * Auto-launches Workbench if not running.
   */
  async call<T = Record<string, unknown>>(
    apiFunc: string,
    params: Record<string, unknown> = {},
    options: WorkbenchCallOptions = {}
  ): Promise<T> {
    try {
      return await this.rawCall<T>(apiFunc, params, options);
    } catch (err) {
      if (
        err instanceof WorkbenchError &&
        err.code === "CONNECTION_REFUSED" &&
        !options.skipAutoLaunch &&
        this.config
      ) {
        logger.info(`Workbench not running, auto-launching...`);
        await this.ensureRunning();
        return await this.rawCall<T>(apiFunc, params, options);
      }
      throw err;
    }
  }

  /**
   * Ensure Workbench is running. Installs handler scripts, launches exe,
   * and waits for NET API. Safe to call concurrently — deduplicates launches.
   * @param gprojPath Optional .gproj file path to open directly (skips launcher).
   */
  async ensureRunning(gprojPath?: string): Promise<void> {
    if (!this.config) {
      throw new WorkbenchError("No config provided — cannot auto-launch Workbench.", "LAUNCH_FAILED");
    }

    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launching = true;
    this.launchPromise = this.launchWorkbench(gprojPath);

    try {
      await this.launchPromise;
    } finally {
      this.launching = false;
      this.launchPromise = null;
    }
  }

  /**
   * Quick health check. Returns true if Workbench responds, false otherwise.
   * Does NOT auto-launch.
   */
  async ping(): Promise<boolean> {
    try {
      await this.rawCall("GetLoadedProjects", {}, { timeout: 3000, skipAutoLaunch: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove injected handler scripts from a mod's directory.
   * Call this after Workbench work is done, before publishing the mod.
   * Deletes Scripts/WorkbenchGame/EnfusionMCP/ from the mod.
   * Safe to call even if scripts were never injected.
   */
  cleanupHandlerScripts(modDir: string): boolean {
    const handlerDir = resolve(modDir, "Scripts", "WorkbenchGame", HANDLER_FOLDER);
    logger.info(`Checking for handler scripts at: ${handlerDir}`);
    if (!existsSync(handlerDir)) {
      logger.info(`Handler scripts not found at ${handlerDir}`);
      return false;
    }
    try {
      rmSync(handlerDir, { recursive: true, force: true });
      logger.info(`Removed handler scripts from ${handlerDir}`);
      // Clean up empty parent dirs
      const wbGameDir = join(modDir, "Scripts", "WorkbenchGame");
      if (existsSync(wbGameDir) && readdirSync(wbGameDir).length === 0) {
        rmSync(wbGameDir);
      }
      return true;
    } catch (e) {
      logger.warn(`Failed to clean up handler scripts: ${e}`);
      return false;
    }
  }

  toString(): string {
    return `WorkbenchClient(${this.host}:${this.port})`;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async launchWorkbench(gprojPath?: string): Promise<void> {
    // 1. Check if already running (maybe it came up between the failed call and now)
    if (await this.ping()) {
      logger.info("Workbench is already running.");
      return;
    }

    // 2. Resolve the target .gproj and inject handler scripts into that mod
    const resolvedGproj = gprojPath || this.findFallbackGproj();
    if (resolvedGproj) {
      // Copy handler scripts directly into the target mod so they compile
      // as part of the mod — no separate addon or dependency needed.
      const modDir = dirname(resolvedGproj);
      this.installHandlerScripts(modDir);
    } else {
      // Fallback: install to default project path as a standalone addon
      this.installHandlerScripts();
    }

    // 3. Find executable
    const exePath = this.findWorkbenchExe();
    if (!exePath) {
      throw new WorkbenchError(
        `Cannot find ${WORKBENCH_EXE}. Install Arma Reforger Tools from Steam, ` +
          `or set ENFUSION_WORKBENCH_PATH. Searched:\n` +
          `  - ${join(this.config!.workbenchPath, WORKBENCH_SUBDIR, WORKBENCH_EXE)}\n` +
          `  - ${join(this.config!.workbenchPath, WORKBENCH_EXE)}`,
        "LAUNCH_FAILED"
      );
    }

    // 4. Spawn with -gproj to skip the launcher
    const args: string[] = [];
    if (resolvedGproj) {
      args.push("-gproj", resolvedGproj);
    }

    // Use the game install directory as CWD so Workbench finds base game addons
    // (data/ArmaReforger.gproj with GUID 58D0FB3206B6F859) via ./addons resolution.
    const cwd = this.findGameDir() || dirname(exePath);

    logger.info(`Launching Workbench: ${exePath}${args.length ? ` ${args.join(" ")}` : ""} (cwd: ${cwd})`);
    const proc = spawn(exePath, args, {
      detached: true,
      stdio: "ignore",
      cwd,
    });
    proc.unref();

    // 5. Wait for NET API
    const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await this.ping()) {
        logger.info("Workbench NET API is responding.");
        return;
      }
      await new Promise((r) => setTimeout(r, LAUNCH_POLL_INTERVAL_MS));
    }

    throw new WorkbenchError(
      `Workbench launched but NET API did not respond within ${LAUNCH_TIMEOUT_MS / 1000}s. ` +
        `Ensure NET API is enabled: File > Options > General > Net API.`,
      "LAUNCH_FAILED"
    );
  }

  private findWorkbenchExe(): string | null {
    const subPath = join(this.config!.workbenchPath, WORKBENCH_SUBDIR, WORKBENCH_EXE);
    if (existsSync(subPath)) return subPath;

    const rootPath = join(this.config!.workbenchPath, WORKBENCH_EXE);
    if (existsSync(rootPath)) return rootPath;

    return null;
  }

  /**
   * Find a .gproj to pass via -gproj so Workbench skips the launcher.
   * Looks for any .gproj in the default project path.
   */
  private findFallbackGproj(): string | null {
    try {
      const addonsDir = this.config!.projectPath;
      if (!existsSync(addonsDir)) return null;
      for (const entry of readdirSync(addonsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const gprojPath = join(addonsDir, entry.name, `${entry.name}.gproj`);
        if (existsSync(gprojPath)) {
          logger.info(`Using fallback gproj to skip launcher: ${gprojPath}`);
          return gprojPath;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Derive the Arma Reforger game install directory.
   * Checks ENFUSION_GAME_PATH env var first, then walks up from workbenchPath.
   * workbenchPath may point to the Tools root OR the Workbench subdirectory,
   * so we try both one and two levels up.
   */
  private findGameDir(): string | null {
    // Explicit env var takes priority
    const envGamePath = process.env.ENFUSION_GAME_PATH;
    if (envGamePath && existsSync(join(envGamePath, "addons"))) {
      logger.info(`Using game directory from ENFUSION_GAME_PATH: ${envGamePath}`);
      return envGamePath;
    }

    const toolsDir = this.config!.workbenchPath;
    // workbenchPath may be "Arma Reforger Tools" or "Arma Reforger Tools\Workbench"
    const candidates = [
      resolve(toolsDir, "..", "Arma Reforger"),
      resolve(toolsDir, "..", "ArmaReforger"),
      resolve(toolsDir, "..", "..", "Arma Reforger"),
      resolve(toolsDir, "..", "..", "ArmaReforger"),
    ];
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "addons"))) {
        logger.info(`Using game directory as CWD: ${candidate}`);
        return candidate;
      }
    }
    logger.warn("Could not find Arma Reforger game directory. Workbench may fail to resolve base game addon.");
    return null;
  }

  /**
   * Copy handler scripts into a mod directory so they compile as part of that mod.
   * If no modDir given, installs to default project path (standalone, less useful).
   */
  private installHandlerScripts(modDir?: string): void {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const bundledDir = join(packageRoot, "mod", "Scripts", "WorkbenchGame", HANDLER_FOLDER);
    if (!existsSync(bundledDir)) {
      logger.warn("Bundled handler scripts not found in package.");
      return;
    }

    const targetBase = modDir || join(this.config!.projectPath, HANDLER_FOLDER);
    const targetScriptsDir = join(targetBase, "Scripts", "WorkbenchGame", HANDLER_FOLDER);

    // Already installed?
    if (existsSync(join(targetScriptsDir, "EMCP_WB_Ping.c"))) {
      return;
    }

    logger.info(`Installing handler scripts to ${targetScriptsDir}`);
    mkdirSync(targetScriptsDir, { recursive: true });

    const files = readdirSync(bundledDir).filter((f) => f.endsWith(".c"));
    for (const file of files) {
      copyFileSync(join(bundledDir, file), join(targetScriptsDir, file));
    }

    logger.info(`Installed ${files.length} handler scripts.`);
  }

  /**
   * Raw TCP call — no auto-launch, no retry.
   */
  private rawCall<T = Record<string, unknown>>(
    apiFunc: string,
    params: Record<string, unknown> = {},
    options: WorkbenchCallOptions = {}
  ): Promise<T> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const requestBuf = encodeRequest(this.clientId, apiFunc, params);

    return new Promise<T>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let settled = false;

      const socket = new Socket();

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(
            new WorkbenchError(
              `Workbench call "${apiFunc}" timed out after ${timeout}ms`,
              "TIMEOUT"
            )
          );
        }
      }, timeout);

      const cleanup = () => {
        clearTimeout(timer);
        socket.removeAllListeners();
      };

      socket.on("error", (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ECONNREFUSED") {
          reject(
            new WorkbenchError(
              `Cannot connect to Workbench at ${this.host}:${this.port}.`,
              "CONNECTION_REFUSED"
            )
          );
        } else {
          reject(
            new WorkbenchError(
              `Connection error: ${err.message}`,
              "PROTOCOL_ERROR"
            )
          );
        }
      });

      socket.on("data", (chunk) => {
        chunks.push(chunk);
      });

      socket.on("end", () => {
        if (settled) return;
        settled = true;
        cleanup();

        const responseBuf = Buffer.concat(chunks);
        if (responseBuf.length === 0) {
          resolve({} as T);
          return;
        }

        try {
          const result = decodeResponse<T>(responseBuf);
          logger.debug(`Workbench response for "${apiFunc}":`, result);
          resolve(result);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isApiError = errMsg.startsWith("Workbench error:");
          reject(
            new WorkbenchError(
              isApiError ? errMsg : `Failed to decode response for "${apiFunc}": ${errMsg}`,
              isApiError ? "API_ERROR" : "PROTOCOL_ERROR"
            )
          );
        }
      });

      socket.on("close", (hadError) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (hadError) return;

        const responseBuf = Buffer.concat(chunks);
        if (responseBuf.length === 0) {
          resolve({} as T);
          return;
        }

        try {
          const result = decodeResponse<T>(responseBuf);
          resolve(result);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isApiError = errMsg.startsWith("Workbench error:");
          reject(
            new WorkbenchError(
              isApiError ? errMsg : `Failed to decode response for "${apiFunc}": ${errMsg}`,
              isApiError ? "API_ERROR" : "PROTOCOL_ERROR"
            )
          );
        }
      });

      socket.connect(this.port, this.host, () => {
        logger.debug(
          `Connected to Workbench at ${this.host}:${this.port}, calling "${apiFunc}"`
        );
        socket.write(requestBuf);
        socket.end();
      });
    });
  }
}

