export interface ServerConfigOptions {
  /** Server display name */
  name: string;
  /** Addon ID from .gproj */
  modName?: string;
  /** Addon GUID from .gproj */
  modId?: string;
  /** Scenario resource path e.g. "{GUID}Missions/MissionHeader.conf" */
  scenarioId?: string;
  /** Maximum players (default 32) */
  maxPlayers?: number;
  /** Game host port (default 2001) */
  port?: number;
  /** A2S query port (default 17777) */
  a2sPort?: number;
  /** Whether server appears in browser (default false for local testing) */
  visible?: boolean;
  /** Server password (empty = no password) */
  password?: string;
}

/**
 * Generate a JSON server config for Arma Reforger dedicated server.
 */
export function generateServerConfig(opts: ServerConfigOptions): string {
  const port = opts.port ?? 2001;
  const a2sPort = opts.a2sPort ?? 17777;

  const config = {
    dedicatedServerId: "",
    region: "US",
    gameHostBindAddress: "",
    gameHostBindPort: port,
    gameHostRegisterBindAddress: "",
    gameHostRegisterPort: port,
    a2s: {
      address: "",
      port: a2sPort,
    },
    game: {
      name: opts.name,
      password: opts.password ?? "",
      scenarioId: opts.scenarioId ?? "",
      maxPlayers: opts.maxPlayers ?? 32,
      visible: opts.visible ?? false,
      gameProperties: {
        serverMaxViewDistance: 1600,
        serverMinGrassDistance: 50,
        fastValidation: true,
        battlEye: false,
      },
      mods: buildModList(opts),
    },
  };

  return JSON.stringify(config, null, 2);
}

function buildModList(
  opts: ServerConfigOptions
): Array<{ modId: string; name: string; version: string }> {
  if (!opts.modName && !opts.modId) return [];
  return [
    {
      modId: opts.modId ?? "",
      name: opts.modName ?? "",
      version: "",
    },
  ];
}
