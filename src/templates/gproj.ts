import { createNode, serialize } from "../formats/enfusion-text.js";
import { generateGuid } from "../formats/guid.js";

export interface GprojOptions {
  /** Addon name (used as ID and project filename) */
  name: string;
  /** Human-readable title */
  title?: string;
  /** Pre-generated GUID, or auto-generate */
  guid?: string;
  /** Dependency GUIDs (base game is always included) */
  dependencies?: string[];
}

const BASE_GAME_GUID = "58D0FB3206B6F859";

/**
 * Generate a .gproj file for an Arma Reforger addon.
 */
export function generateGproj(opts: GprojOptions): string {
  const guid = opts.guid ?? generateGuid();
  const title = opts.title ?? opts.name;

  // Collect all dependency GUIDs (always include base game)
  const deps = new Set<string>([BASE_GAME_GUID]);
  if (opts.dependencies) {
    for (const d of opts.dependencies) deps.add(d);
  }

  const root = createNode("GameProject", {
    properties: [
      { key: "ID", value: opts.name },
      { key: "GUID", value: guid },
      { key: "TITLE", value: title },
    ],
    children: [
      createNode("Dependencies", {
        values: [...deps],
      }),
    ],
  });

  // Add platform configurations (Workbench handles script compilation automatically)
  const pcConfig = createNode("GameProjectConfig", { id: "PC" });
  const headlessConfig = createNode("GameProjectConfig", { id: "HEADLESS" });

  root.children.push(
    createNode("Configurations", {
      children: [pcConfig, headlessConfig],
    })
  );

  return serialize(root);
}
