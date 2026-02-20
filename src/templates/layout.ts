import { createNode, serialize, type EnfusionNode } from "../formats/enfusion-text.js";
import { generateGuid } from "../formats/guid.js";

export type LayoutType =
  | "hud"
  | "menu"
  | "dialog"
  | "list"
  | "custom";

export interface WidgetDef {
  /** Widget class (e.g., "TextWidgetClass", "ImageWidgetClass") */
  type: string;
  /** Widget name — used for FindAnyWidget() lookups in scripts */
  name: string;
  /** Anchor: "left top right bottom" as floats 0-1 (e.g., "0 0 1 0" = top-stretch) */
  anchor?: string;
  /** Offset: "left top right bottom" in pixels relative to anchor */
  offset?: string;
  /** Additional properties (e.g., Text, Color, Min, Max, Current) */
  properties?: Record<string, string>;
  /** Nested child widgets */
  children?: WidgetDef[];
}

export interface LayoutOptions {
  /** Layout name (used for filename) */
  name: string;
  /** Layout template type */
  layoutType: LayoutType;
  /** Root widget type override (default: FrameWidgetClass) */
  rootWidgetType?: string;
  /** Root widget anchor */
  anchor?: string;
  /** Root widget offset (pixel positioning) */
  offset?: string;
  /** Child widgets to add */
  widgets?: WidgetDef[];
  /** Description comment */
  description?: string;
}

interface LayoutTypeConfig {
  rootWidgetType: string;
  defaultAnchor: string;
  defaultOffset: string;
  defaultWidgets: WidgetDef[];
}

const LAYOUT_CONFIGS: Record<LayoutType, LayoutTypeConfig> = {
  hud: {
    rootWidgetType: "FrameWidgetClass",
    defaultAnchor: "0 1 0 1",
    defaultOffset: "20 -120 220 -20",
    defaultWidgets: [
      {
        type: "ImageWidgetClass",
        name: "Background",
        anchor: "0 0 1 1",
        offset: "0 0 0 0",
        properties: { Color: "0 0 0 150" },
      },
      {
        type: "TextWidgetClass",
        name: "TitleText",
        anchor: "0 0 1 0",
        offset: "8 5 -8 25",
        properties: { Text: "HUD Widget", ExactFontSize: "14" },
      },
    ],
  },
  menu: {
    rootWidgetType: "FrameWidgetClass",
    defaultAnchor: "0.5 0.5 0.5 0.5",
    defaultOffset: "-200 -150 200 150",
    defaultWidgets: [
      {
        type: "ImageWidgetClass",
        name: "Background",
        anchor: "0 0 1 1",
        offset: "0 0 0 0",
        properties: { Color: "20 20 20 220" },
      },
      {
        type: "TextWidgetClass",
        name: "TitleText",
        anchor: "0 0 1 0",
        offset: "16 10 -16 40",
        properties: { Text: "Menu Title", ExactFontSize: "24", Align: "1" },
      },
    ],
  },
  dialog: {
    rootWidgetType: "FrameWidgetClass",
    defaultAnchor: "0.5 0.5 0.5 0.5",
    defaultOffset: "-160 -100 160 100",
    defaultWidgets: [
      {
        type: "ImageWidgetClass",
        name: "Background",
        anchor: "0 0 1 1",
        offset: "0 0 0 0",
        properties: { Color: "30 30 30 230" },
      },
      {
        type: "TextWidgetClass",
        name: "MessageText",
        anchor: "0 0 1 0.7",
        offset: "16 16 -16 -16",
        properties: { Text: "Dialog message", ExactFontSize: "16" },
      },
      {
        type: "ButtonWidgetClass",
        name: "ConfirmButton",
        anchor: "0.5 0.7 0.5 0.7",
        offset: "-60 10 60 40",
        properties: { Text: "OK" },
      },
    ],
  },
  list: {
    rootWidgetType: "FrameWidgetClass",
    defaultAnchor: "0 0 0.3 1",
    defaultOffset: "10 10 -10 -10",
    defaultWidgets: [
      {
        type: "ImageWidgetClass",
        name: "Background",
        anchor: "0 0 1 1",
        offset: "0 0 0 0",
        properties: { Color: "10 10 10 200" },
      },
      {
        type: "TextWidgetClass",
        name: "ListTitle",
        anchor: "0 0 1 0",
        offset: "8 5 -8 25",
        properties: { Text: "List", ExactFontSize: "16" },
      },
    ],
  },
  custom: {
    rootWidgetType: "FrameWidgetClass",
    defaultAnchor: "0 0 1 1",
    defaultOffset: "0 0 0 0",
    defaultWidgets: [],
  },
};

function buildWidgetNode(widget: WidgetDef): EnfusionNode {
  const guid = generateGuid();
  const slotGuid = generateGuid();

  const node = createNode(widget.type, {
    id: `{${guid}}`,
  });

  // Name property
  node.properties.push({ key: "Name", value: widget.name });

  // Slot (anchor + offset)
  if (widget.anchor || widget.offset) {
    const slotNode = createNode("Slot", {
      id: `FrameWidgetSlot {${slotGuid}}`,
    });

    if (widget.anchor) {
      slotNode.properties.push({ key: "Anchor", value: widget.anchor });
    }
    if (widget.offset) {
      slotNode.properties.push({ key: "Offset", value: widget.offset });
    }

    node.children.push(slotNode);
  }

  // Additional properties
  if (widget.properties) {
    for (const [key, value] of Object.entries(widget.properties)) {
      node.properties.push({ key, value });
    }
  }

  // Nested children
  if (widget.children && widget.children.length > 0) {
    const childrenNode = createNode("Children");
    for (const child of widget.children) {
      childrenNode.children.push(buildWidgetNode(child));
    }
    node.children.push(childrenNode);
  }

  return node;
}

/**
 * Generate an Enfusion .layout file for UI widgets.
 */
export function generateLayout(opts: LayoutOptions): string {
  const config = LAYOUT_CONFIGS[opts.layoutType];
  const rootType = opts.rootWidgetType || config.rootWidgetType;
  const rootGuid = generateGuid();
  const slotGuid = generateGuid();

  const root = createNode(rootType, {
    id: `{${rootGuid}}`,
  });

  root.properties.push({ key: "Name", value: `${opts.name}Root` });

  // Root slot
  const rootSlot = createNode("Slot", {
    id: `FrameWidgetSlot {${slotGuid}}`,
  });
  rootSlot.properties.push({
    key: "Anchor",
    value: opts.anchor || config.defaultAnchor,
  });
  rootSlot.properties.push({
    key: "Offset",
    value: opts.offset || config.defaultOffset,
  });
  root.children.push(rootSlot);

  // Combine default widgets with user-specified widgets
  const allWidgets: WidgetDef[] = [
    ...config.defaultWidgets,
    ...(opts.widgets ?? []),
  ];

  if (allWidgets.length > 0) {
    const childrenNode = createNode("Children");
    for (const widget of allWidgets) {
      childrenNode.children.push(buildWidgetNode(widget));
    }
    root.children.push(childrenNode);
  }

  return serialize(root);
}

/**
 * Get the subdirectory for layout files.
 */
export function getLayoutSubdirectory(): string {
  return "UI/layouts";
}

/**
 * Derive a filename from the layout name.
 */
export function getLayoutFilename(name: string): string {
  return `${name}.layout`;
}
