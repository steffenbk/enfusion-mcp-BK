import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";

// ── Manifest schema ──────────────────────────────────────────────────────────

const PhaseSchema = z.object({
  index: z.number().int().min(1),
  fbx: z.string(),
});

const PartSchema = z.object({
  name: z.string(),
  type: z.string(),
  socket_prefix: z.string(),
  socket_name: z.string(),
  unique: z.boolean(),
  fbx: z.string(),
  phases: z.array(PhaseSchema),
});

export const ManifestSchema = z.object({
  building_name: z.string().min(1),
  export_root: z.string(),
  structure: z.object({
    fbx: z.string(),
    sockets: z.array(z.string()),
  }),
  parts: z.array(PartSchema),
});

export type BuildingManifest = z.infer<typeof ManifestSchema>;
export type BuildingPart = z.infer<typeof PartSchema>;

// ── Prefab generation helpers ────────────────────────────────────────────────

/** Generate a random Enfusion-style GUID (16 hex uppercase). */
export function generateGuid(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

/** Convert FBX relative path to .xob resource path with mod prefix. */
export function fbxToXob(fbxPath: string, modPrefix: string): string {
  const xob = fbxPath.replace(/\.fbx$/i, ".xob");
  return `${modPrefix}${xob}`;
}

/** Format a prefab resource path with a GUID prefix: {GUID}path */
export function guidPrefabPath(relativePath: string): string {
  return `{${generateGuid()}}${relativePath}`;
}

export function generateDestructionComponent(part: BuildingPart, modPrefix: string): string {
  if (part.phases.length === 0) return "";

  const phaseEntries = part.phases.map((phase) => {
    const health = 1 - phase.index / (part.phases.length + 1);
    const xob = fbxToXob(phase.fbx, modPrefix);
    const guid = generateGuid();
    return `  SCR_DamagePhaseData "{${guid}}" {
   PhaseModel "${xob}"
   Health ${health.toFixed(2)}
  }`;
  });

  return `SCR_DestructionMultiPhaseComponent {
 m_aDamagePhases {
${phaseEntries.join("\n")}
 }
}`;
}

export function generateSlotBoneMappingObject(part: BuildingPart, partPrefabPath: string): string {
  return `SlotBoneMappingObject {
 BonePrefix "${part.socket_prefix}"
 Template "${partPrefabPath}"
}`;
}

export function generateBaseSlotComponent(part: BuildingPart, partPrefabPath: string): string {
  return `BaseSlotComponent {
 Slot "${part.socket_name}"
 Prefab "${partPrefabPath}"
}`;
}

export function generatePartPrefab(
  part: BuildingPart,
  modPrefix: string
): string {
  const xob = fbxToXob(part.fbx, modPrefix);
  const destructionComp = generateDestructionComponent(part, modPrefix);

  let components = `MeshObject {
  Object "${xob}"
 }`;

  if (destructionComp) {
    components += `\n ${destructionComp}`;
  }

  return `GenericEntity {
 components {
  ${components}
 }
}`;
}

export function generateBuildingPrefab(
  manifest: BuildingManifest,
  parts: BuildingPart[],
  modPrefix: string,
  partPrefabPaths: Map<string, string>
): string {
  const slotComponents: string[] = [];

  for (const part of parts) {
    const prefabPath = partPrefabPaths.get(part.name) || "";
    if (part.unique) {
      slotComponents.push(` ${generateBaseSlotComponent(part, prefabPath)}`);
    } else {
      slotComponents.push(` ${generateSlotBoneMappingObject(part, prefabPath)}`);
    }
  }

  const xob = fbxToXob(manifest.structure.fbx, modPrefix);

  return `SCR_DestructibleBuildingEntity : "{B6D7B585448658F5}Prefabs/Structures/BuildingParts/Building_Base.et" {
 components {
  MeshObject {
   Object "${xob}"
  }
  SCR_DestructibleBuildingComponent {
  }
${slotComponents.join("\n")}
 }
}`;
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerBuildingSetup(server: McpServer, config: Config): void {
  server.registerTool(
    "building_setup",
    {
      description:
        "Set up an Arma Reforger destructible building from a Blender export manifest.\n\n" +
        "Reads a building_manifest.json (exported by bk_building_tools Blender plugin), " +
        "then creates the building structure prefab with slot wiring (SlotBoneMappingObject / BaseSlotComponent) " +
        "and individual part prefabs with SCR_DestructionMultiPhaseComponent for each destruction phase.\n\n" +
        "The manifest contains: building name, socket list, part definitions with FBX paths and destruction phases.",
      inputSchema: {
        manifestPath: z.string().describe(
          "Absolute path to the building_manifest.json file exported from Blender"
        ),
        modPrefix: z.string().default("").describe(
          "Mod resource prefix path (e.g., 'MyMod/Assets/Buildings/'). Prepended to FBX-derived .xob paths."
        ),
        outputDir: z.string().optional().describe(
          "Output directory for generated .et prefab files. Defaults to mod prefabs directory from config."
        ),
        dryRun: z.boolean().default(false).describe(
          "If true, return what would be created without writing files"
        ),
      },
    },
    async ({ manifestPath, modPrefix, outputDir, dryRun }) => {
      // Read and parse manifest
      let rawManifest: string;
      try {
        rawManifest = readFileSync(manifestPath, "utf-8");
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error reading manifest: ${err}` }] };
      }

      let manifest: BuildingManifest;
      try {
        manifest = ManifestSchema.parse(JSON.parse(rawManifest));
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Invalid manifest: ${err}` }] };
      }

      const outDir = outputDir
        ? resolve(outputDir)
        : resolve(config.projectPath, "Prefabs", "Structures", manifest.building_name);

      const lines: string[] = [];
      lines.push(`=== Building Setup: ${manifest.building_name} ===`);
      lines.push(`Parts: ${manifest.parts.length}`);
      lines.push(`Sockets: ${manifest.structure.sockets.length}`);
      lines.push(`Output: ${outDir}`);
      lines.push("");

      const partPrefabPaths = new Map<string, string>();
      const createdFiles: string[] = [];
      // Existing files are never overwritten; they are reported so the caller knows
      // the generated set is incomplete rather than assuming a clean write.
      const skipped: string[] = [];

      // Create part prefabs
      for (const part of manifest.parts) {
        const partDir = join(outDir, "Parts");
        const partFile = `${part.name}.et`;
        const partPath = join(partDir, partFile);
        const partContent = generatePartPrefab(part, modPrefix);

        // Store GUID-prefixed prefab path for slot wiring
        const relativePath = `Prefabs/Structures/${manifest.building_name}/Parts/${partFile}`;
        partPrefabPaths.set(part.name, guidPrefabPath(relativePath));

        const slotType = part.unique ? "BaseSlotComponent" : "SlotBoneMappingObject";
        const phaseInfo = part.phases.length > 0
          ? ` (${part.phases.length} destruction phases)`
          : "";

        lines.push(`[Part] ${part.name} -> ${slotType}${phaseInfo}`);

        if (!dryRun) {
          // Every other generator in this repo refuses rather than overwriting
          // (script_create, config_create, layout_create, menu_create, prefab, ...).
          // This one wrote N part prefabs plus the structure unconditionally, so a
          // re-run silently destroyed hand-edits made in Workbench since the export.
          if (existsSync(partPath)) {
            skipped.push(partPath);
          } else {
            mkdirSync(partDir, { recursive: true });
            writeFileSync(partPath, partContent, "utf-8");
            createdFiles.push(partPath);
          }
        }
      }

      // Create building structure prefab
      const buildingContent = generateBuildingPrefab(
        manifest,
        manifest.parts,
        modPrefix,
        partPrefabPaths
      );
      const buildingPath = join(outDir, `${manifest.building_name}.et`);

      lines.push("");
      lines.push(`[Building] ${manifest.building_name}.et`);

      if (!dryRun) {
        if (existsSync(buildingPath)) {
          skipped.push(buildingPath);
        } else {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(buildingPath, buildingContent, "utf-8");
          createdFiles.push(buildingPath);
        }
      }

      lines.push("");
      if (dryRun) {
        lines.push("(dry run -- no files written)");
      } else {
        lines.push(`Created ${createdFiles.length} prefab files.`);
        if (skipped.length > 0) {
          lines.push("");
          lines.push(`Skipped ${skipped.length} existing file(s) — NOT overwritten:`);
          for (const s of skipped) lines.push(`  ${s}`);
          lines.push("Delete them first, or set outputDir to a fresh folder, to regenerate.");
        }
      }

      lines.push("");
      lines.push("=== Post-Creation Checklist ===");
      lines.push("- [ ] Import FBX files into Workbench (Resource Browser)");
      lines.push("- [ ] Verify .xob paths in MeshObject components match imported assets");
      lines.push("- [ ] Check slot bone prefixes match socket names in the FBX skeleton");
      lines.push("- [ ] Test destruction phases in World Editor (damage entity to cycle phases)");
      lines.push("- [ ] Add FireGeo/collision components if not inherited from Building_Base");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
