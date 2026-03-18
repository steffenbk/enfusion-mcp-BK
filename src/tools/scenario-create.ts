import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generateConflictScenario,
  KNOWN_WORLDS,
  type ConflictBaseSpec,
} from "../templates/scenario.js";
import { validateFilename } from "../utils/safe-path.js";

const BASE_SPEC_SCHEMA = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      "Base name / callsign, e.g. 'BaseAlpha'. Used as the entity name and in the mission header base whitelist. " +
      "No spaces — use underscores or CamelCase."
    ),
  position: z
    .string()
    .describe(
      "World position as 'x y z', e.g. '1200 0 3400'. Y=0 is fine — Workbench snaps to terrain when opened."
    ),
  faction: z
    .string()
    .describe("Starting faction key: 'US', 'USSR', 'FIA', or a custom key."),
  type: z
    .enum(["base", "major", "MOB", "controlPoint", "sourceBase", "harbor"])
    .optional()
    .describe(
      "Base type. 'base' (default) = standard contested base. 'major' = large base with CAH areas (harbour, port, airfield). " +
      "'MOB' = main operating base / HQ (no seizing, 3000 supplies, radio source). " +
      "'controlPoint' = lightweight capture point. 'sourceBase' = supply source only, not capturable. " +
      "'harbor' = supply-income harbor (skipped in Bases.layer, uses own prefab family)."
    ),
  radioRange: z
    .number()
    .optional()
    .describe("Radio antenna service range in meters (default 1470). Increase for MOBs on islands."),
  patrolCount: z
    .number()
    .min(0)
    .max(6)
    .optional()
    .describe("Number of ambient patrol spawnpoints around this base (0-6, default 2)."),
});

export function registerScenarioCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "scenario_create_conflict",
    {
      description:
        "Generate a complete Conflict multiplayer scenario as up to 7 files: a mission header (.conf), a SubScene world stub (.ent), " +
        "and layer files (default.layer with game mode + managers, Bases.layer with all military bases, " +
        "CAH.layer with capture zones for major bases, Defenders.layer with patrol defenders, " +
        "AmbientVehicles.layer with civilian vehicle spawns when civVehicleCount > 0). " +
        "This matches the structure used by production Arma Reforger Workshop mods. " +
        "Generates: GameMode_Seize entity, CampaignFactionManager, military bases with SCR_CampaignSeizingComponent + radio + patrol spawnpoints. " +
        "Known worlds: " + KNOWN_WORLDS.join(", ") + ". " +
        "For custom maps pass the full resource ref as worldName, e.g. '{GUID}worlds/MyMap.ent'. " +
        "After generating, open the .ent file in Workbench to snap entities to terrain.",
      inputSchema: {
        scenarioName: z
          .string()
          .min(1)
          .describe(
            "Scenario identifier used as the filename (no spaces, e.g. 'MyConflict_Everon'). " +
            "Also used as the display name unless scenarioDisplayName is provided."
          ),
        scenarioDisplayName: z
          .string()
          .optional()
          .describe("Human-readable display name shown in the scenario browser (default: scenarioName)."),
        worldName: z
          .string()
          .describe(
            "Base world to inherit. Use 'Everon', 'Arland', or 'Western Everon' for vanilla maps, " +
            "or a full resource ref like '{GUID}worlds/MyMap.ent' for custom maps."
          ),
        bases: z
          .array(BASE_SPEC_SCHEMA)
          .min(1)
          .describe(
            "List of military bases to place. Include at least one MOB per faction and 2+ contested bases. " +
            "Positions are world-space coordinates — use the map to find sensible locations."
          ),
        playerCount: z
          .number()
          .min(1)
          .max(256)
          .optional()
          .describe("Max player count (default 40)."),
        xpMultiplier: z
          .number()
          .optional()
          .describe("XP multiplier. Use 0.5 for PvE, 1.0 for standard PvP (default 1.0, omitted if 1.0)."),
        savingEnabled: z
          .boolean()
          .optional()
          .describe("Enable Conflict persistence/saving (default true)."),
        gameModeLabel: z
          .string()
          .optional()
          .describe("Game mode display label shown in the server browser (default 'Conflict')."),
        description: z
          .string()
          .optional()
          .describe("Scenario description shown in the mission browser."),
        author: z
          .string()
          .optional()
          .describe("Author name shown in the mission browser."),
        civVehicleCount: z
          .number()
          .min(0)
          .max(50)
          .optional()
          .describe("Number of civilian ambient vehicle spawnpoints to place (default 0). Generates AmbientVehicles.layer when > 0."),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({
      scenarioName,
      scenarioDisplayName,
      worldName,
      bases,
      playerCount,
      xpMultiplier,
      savingEnabled,
      gameModeLabel,
      description,
      author,
      civVehicleCount,
      projectPath,
    }) => {
      try {
        validateFilename(scenarioName);

        const output = generateConflictScenario({
          scenarioName: scenarioDisplayName ?? scenarioName,
          worldName,
          bases: bases as ConflictBaseSpec[],
          playerCount,
          xpMultiplier,
          savingEnabled,
          gameModeLabel,
          description,
          author,
          civVehicleCount,
        });

        const basePath = projectPath || config.projectPath;

        if (basePath) {
          const missionsDir = resolve(basePath, "Missions");
          const worldsDir   = resolve(basePath, "Worlds");
          const layersDir   = resolve(basePath, "Worlds", `${scenarioName}_Layers`);
          const confPath          = join(missionsDir, `${scenarioName}.conf`);
          const entPath           = join(worldsDir,   `${scenarioName}.ent`);
          const defaultLayPath    = join(layersDir,   `default.layer`);
          const basesLayPath      = join(layersDir,   `Bases.layer`);
          const cahLayPath        = join(layersDir,   `CAH.layer`);
          const defendersLayPath  = join(layersDir,   `Defenders.layer`);
          const vehiclesLayPath   = join(layersDir,   `AmbientVehicles.layer`);

          mkdirSync(missionsDir, { recursive: true });
          mkdirSync(worldsDir,   { recursive: true });
          mkdirSync(layersDir,   { recursive: true });

          const existing: string[] = [];
          if (existsSync(confPath))         existing.push(`Missions/${scenarioName}.conf`);
          if (existsSync(entPath))          existing.push(`Worlds/${scenarioName}.ent`);
          if (existsSync(defaultLayPath))   existing.push(`Worlds/${scenarioName}_Layers/default.layer`);
          if (existsSync(basesLayPath))     existing.push(`Worlds/${scenarioName}_Layers/Bases.layer`);
          if (existsSync(defendersLayPath)) existing.push(`Worlds/${scenarioName}_Layers/Defenders.layer`);
          if (existsSync(cahLayPath))       existing.push(`Worlds/${scenarioName}_Layers/CAH.layer`);
          if (existsSync(vehiclesLayPath))  existing.push(`Worlds/${scenarioName}_Layers/AmbientVehicles.layer`);

          if (existing.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `Files already exist: ${existing.join(", ")}\n\n` +
                  `Generated content (not written):\n\n` +
                  `**Missions/${scenarioName}.conf**\n\`\`\`\n${output.missionConf}\n\`\`\`\n\n` +
                  `**Worlds/${scenarioName}.ent**\n\`\`\`\n${output.worldEnt}\n\`\`\`\n\n` +
                  `**Worlds/${scenarioName}_Layers/default.layer**\n\`\`\`\n${output.defaultLayer}\n\`\`\`\n\n` +
                  `**Worlds/${scenarioName}_Layers/Bases.layer**\n\`\`\`\n${output.basesLayer}\n\`\`\``,
              }],
            };
          }

          // Write all files with rollback on partial failure
          const writtenPaths: string[] = [];
          try {
            writeFileSync(confPath,        output.missionConf,  "utf-8"); writtenPaths.push(confPath);
            writeFileSync(entPath,         output.worldEnt,     "utf-8"); writtenPaths.push(entPath);
            writeFileSync(defaultLayPath,  output.defaultLayer, "utf-8"); writtenPaths.push(defaultLayPath);
            writeFileSync(basesLayPath,    output.basesLayer,   "utf-8"); writtenPaths.push(basesLayPath);
            writeFileSync(defendersLayPath, output.defendersLayer, "utf-8"); writtenPaths.push(defendersLayPath);
            if (output.cahLayer)             { writeFileSync(cahLayPath,      output.cahLayer,      "utf-8"); writtenPaths.push(cahLayPath); }
            if (output.ambientVehiclesLayer) { writeFileSync(vehiclesLayPath, output.ambientVehiclesLayer, "utf-8"); writtenPaths.push(vehiclesLayPath); }
          } catch (writeErr) {
            // Rollback: remove any files we already wrote to avoid partial scenarios
            for (const p of writtenPaths) {
              try { unlinkSync(p); } catch { /* best-effort cleanup */ }
            }
            throw writeErr;
          }

          const factions = [...new Set(bases.map(b => b.faction))];
          const writtenFiles = [
            `  Missions/${scenarioName}.conf`,
            `  Worlds/${scenarioName}.ent`,
            `  Worlds/${scenarioName}_Layers/default.layer`,
            `  Worlds/${scenarioName}_Layers/Bases.layer`,
            `  Worlds/${scenarioName}_Layers/Defenders.layer`,
            ...(output.cahLayer ? [`  Worlds/${scenarioName}_Layers/CAH.layer`] : []),
            ...(output.ambientVehiclesLayer ? [`  Worlds/${scenarioName}_Layers/AmbientVehicles.layer`] : []),
          ];

          return {
            content: [{
              type: "text" as const,
              text: [
                `**Conflict scenario created: ${scenarioName}**`,
                ``,
                `Files written:`,
                ...writtenFiles,
                ``,
                `Bases (${bases.length}): ${bases.map(b => `${b.name} [${b.type ?? "base"}, ${b.faction}]`).join(", ")}`,
                `Factions: ${factions.join(", ")}`,
                `Players: ${playerCount ?? 40}`,
                ``,
                `Next steps:`,
                `1. Open Worlds/${scenarioName}.ent in Workbench.`,
                `2. Select all base entities and use "Snap to Terrain" to fix Y positions.`,
                `3. Adjust patrol spawnpoint positions around each base (currently offset ±30m).`,
                `4. Add defender spawnpoints (SCR_DefenderSpawnerComponent) inside base buildings.`,
                `5. Add ConflictRelayRadio entities between distant bases to extend radio coverage.`,
                `6. Save and run a test with the scenario in the server browser.`,
              ].join("\n"),
            }],
          };
        }

        // No project path — return generated content only
        const parts: string[] = [
          `Generated conflict scenario (no project path configured — not written to disk):`,
          ``,
          `**Missions/${scenarioName}.conf**`,
          `\`\`\``,
          output.missionConf,
          `\`\`\``,
          ``,
          `**Worlds/${scenarioName}.ent**`,
          `\`\`\``,
          output.worldEnt,
          `\`\`\``,
          ``,
          `**Worlds/${scenarioName}_Layers/default.layer**`,
          `\`\`\``,
          output.defaultLayer,
          `\`\`\``,
          ``,
          `**Worlds/${scenarioName}_Layers/Bases.layer**`,
          `\`\`\``,
          output.basesLayer,
          `\`\`\``,
          ``,
          `**Worlds/${scenarioName}_Layers/Defenders.layer**`,
          `\`\`\``,
          output.defendersLayer,
          `\`\`\``,
        ];
        if (output.cahLayer) {
          parts.push(``, `**Worlds/${scenarioName}_Layers/CAH.layer**`, `\`\`\``, output.cahLayer, `\`\`\``);
        }
        if (output.ambientVehiclesLayer) {
          parts.push(``, `**Worlds/${scenarioName}_Layers/AmbientVehicles.layer**`, `\`\`\``, output.ambientVehiclesLayer, `\`\`\``);
        }
        parts.push(``, `Set ENFUSION_PROJECT_PATH to write files automatically.`);
        return {
          content: [{ type: "text" as const, text: parts.join("\n") }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: `Error creating scenario: ${msg}` }],
        isError: true,
        };
      }
    }
  );
}
