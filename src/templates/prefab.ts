import { createNode, serialize, type EnfusionNode } from "../formats/enfusion-text.js";
import { generateGuid } from "../formats/guid.js";

export type PrefabType =
  | "character"
  | "vehicle"
  | "weapon"
  | "spawnpoint"
  | "gamemode"
  | "interactive"
  | "generic";

export interface ComponentDef {
  type: string;
  properties?: Record<string, string>;
}

export interface PrefabOptions {
  /** Prefab name (used for filename and ID) */
  name: string;
  /** Prefab template type */
  prefabType: PrefabType;
  /** Parent prefab path to inherit from (uses default per type if omitted) */
  parentPrefab?: string;
  /** Additional components to add */
  components?: ComponentDef[];
  /** Description (used for m_sDisplayName if applicable) */
  description?: string;
}

interface PrefabTypeConfig {
  /** Root entity type */
  entityType: string;
  /** Default parent prefab reference (empty = no inheritance) */
  defaultParent: string;
  /** Subdirectory under Prefabs/ */
  subdirectory: string;
  /** Default components */
  defaultComponents: ComponentDef[];
}

const PREFAB_CONFIGS: Record<PrefabType, PrefabTypeConfig> = {
  character: {
    entityType: "SCR_ChimeraCharacter",
    defaultParent: "",
    subdirectory: "Prefabs/Characters",
    defaultComponents: [
      { type: "InventoryStorageManagerComponent", properties: {} },
      { type: "SCR_CharacterControllerComponent", properties: {} },
    ],
  },
  vehicle: {
    entityType: "Vehicle",
    defaultParent: "",
    subdirectory: "Prefabs/Vehicles",
    defaultComponents: [
      { type: "VehicleControllerComponent", properties: {} },
      { type: "MeshObject", properties: {} },
    ],
  },
  weapon: {
    entityType: "Weapon_Base",
    defaultParent: "",
    subdirectory: "Prefabs/Weapons",
    defaultComponents: [
      { type: "WeaponComponent", properties: {} },
      { type: "MeshObject", properties: {} },
    ],
  },
  spawnpoint: {
    entityType: "GenericEntity",
    defaultParent: "",
    subdirectory: "Prefabs/Systems",
    defaultComponents: [
      { type: "SCR_SpawnPoint", properties: {} },
    ],
  },
  gamemode: {
    entityType: "GenericEntity",
    defaultParent: "",
    subdirectory: "Prefabs/Systems",
    defaultComponents: [
      { type: "SCR_BaseGameMode", properties: {} },
      { type: "SCR_RespawnSystemComponent", properties: {} },
    ],
  },
  interactive: {
    entityType: "GenericEntity",
    defaultParent: "",
    subdirectory: "Prefabs/Props",
    defaultComponents: [
      { type: "MeshObject", properties: { Object: "" } },
      { type: "RigidBody", properties: { ModelGeometry: "1" } },
      { type: "ActionsManagerComponent", properties: {} },
    ],
  },
  generic: {
    entityType: "GenericEntity",
    defaultParent: "",
    subdirectory: "Prefabs",
    defaultComponents: [],
  },
};

/**
 * Generate an Enfusion .et prefab file.
 */
export function generatePrefab(opts: PrefabOptions): string {
  const config = PREFAB_CONFIGS[opts.prefabType];
  const parentPrefab = opts.parentPrefab || config.defaultParent;
  const entityGuid = generateGuid();

  const root = createNode(config.entityType, {
    inheritance: parentPrefab || undefined,
    properties: [{ key: "ID", value: entityGuid }],
  });

  // Build components block
  const allComponents: ComponentDef[] = [
    ...config.defaultComponents,
    ...(opts.components ?? []),
  ];

  if (allComponents.length > 0 || opts.description) {
    const componentNodes: EnfusionNode[] = [];

    for (const comp of allComponents) {
      const compGuid = generateGuid();
      const compNode = createNode(comp.type, {
        id: `{${compGuid}}`,
      });

      if (comp.properties) {
        for (const [key, value] of Object.entries(comp.properties)) {
          compNode.properties.push({ key, value });
        }
      }

      componentNodes.push(compNode);
    }

    // If there's a description and an editable component, set the display name
    if (opts.description) {
      const editableComp = componentNodes.find(
        (c) => c.type === "SCR_EditableEntityComponent"
      );
      if (editableComp) {
        editableComp.properties.push({
          key: "m_sDisplayName",
          value: opts.description,
        });
      } else {
        // Add an editable entity component with the display name
        const compGuid = generateGuid();
        componentNodes.push(
          createNode("SCR_EditableEntityComponent", {
            id: `{${compGuid}}`,
            properties: [{ key: "m_sDisplayName", value: opts.description }],
          })
        );
      }
    }

    root.children.push(createNode("components", { children: componentNodes }));
  }

  return serialize(root);
}

/**
 * Get the subdirectory for a prefab type.
 */
export function getPrefabSubdirectory(prefabType: PrefabType): string {
  return PREFAB_CONFIGS[prefabType].subdirectory;
}

/**
 * Derive a filename from the prefab name.
 */
export function getPrefabFilename(name: string): string {
  return `${name}.et`;
}
