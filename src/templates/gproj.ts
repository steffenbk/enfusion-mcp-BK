import { createNode, serialize, setProperty } from "../formats/enfusion-text.js";
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
  /** Include script project manager settings */
  includeScriptConfig?: boolean;
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

  // Add script configuration if requested
  if (opts.includeScriptConfig !== false) {
    const scriptGuid = generateGuid();

    const workbenchDefines = createNode("ScriptConfigurationClass", {
      id: "workbench",
      children: [
        createNode("Defines", {
          values: ["PLATFORM_WINDOWS", "ENF_WB", "WORKBENCH"],
        }),
      ],
    });

    const gameDefines = createNode("ScriptConfigurationClass", {
      id: "game",
      children: [
        createNode("Defines", {
          values: ["PLATFORM_WINDOWS"],
        }),
      ],
    });

    const scriptSettings = createNode("ScriptProjectManagerSettings", {
      id: `{${scriptGuid}}`,
      children: [
        createNode("Configurations", {
          children: [workbenchDefines, gameDefines],
        }),
      ],
    });
    // The outer wrapper uses repeated type name as key + type
    // In Enfusion: ScriptProjectManagerSettings ScriptProjectManagerSettings "{GUID}" { }
    // We model this as a child with type "ScriptProjectManagerSettings" and id being the GUID
    // But the key name also needs to be ScriptProjectManagerSettings
    // Since we parse `Key Type "GUID" { }` as a child whose type includes the key,
    // we'll just emit it with the correct structure.
    // Actually the Enfusion format has: PropertyName TypeName "GUID" { }
    // We handle this by making the type be "ScriptProjectManagerSettings" with an additional
    // wrapper. Let's keep it simple and set type to the combined form.

    const pcConfig = createNode("GameProjectConfig", {
      id: "PC",
      children: [scriptSettings],
    });

    const headlessConfig = createNode("GameProjectConfig", {
      id: "HEADLESS",
    });

    root.children.push(
      createNode("Configurations", {
        children: [pcConfig, headlessConfig],
      })
    );
  }

  return serialize(root);
}
