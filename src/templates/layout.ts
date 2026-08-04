import { createNode, serialize, type EnfusionNode } from "../formats/enfusion-text.js";
import { generateGuid } from "../formats/guid.js";

// ---------------------------------------------------------------------------
// Parent-aware widget tree model
//
// Enfusion .layout files nest child widgets inside an anonymous `{ }` block
// (there is NO `Children` keyword) and each child carries a `Slot` whose TYPE
// is determined by its PARENT widget class. This engine walks a WidgetNode
// tree, infers the correct slot type per parent, and emits valid layout text.
// ---------------------------------------------------------------------------

/** Slot properties. Only provided keys are emitted. Keys are shared across slot
 * types; which are meaningful depends on the parent (FrameWidgetSlot uses
 * anchor/position/size/offset, LayoutSlot uses padding/sizeMode/fillWeight,
 * OverlayWidgetSlot/AlignableSlot use alignment + padding). */
export interface LayoutSlotDef {
  /** "left top right bottom" floats 0-1 (FrameWidgetSlot) */
  anchor?: string;
  positionX?: number;
  positionY?: number;
  sizeX?: number;
  sizeY?: number;
  offsetLeft?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  /** "left top right bottom" pixels */
  padding?: string;
  horizontalAlign?: string | number;
  verticalAlign?: string | number;
  sizeMode?: string;
  fillWeight?: number;
  sizeToContent?: boolean | string;
}

/** Expands to a `FontProperties FontProperties "{guid}" { ... }` sub-node. */
export interface FontDef {
  /** Font resource ref, e.g. "{GUID}UI/Fonts/RobotoCondensed/RobotoCondensed_Bold.fnt" */
  font: string;
  shadowSize?: number;
  shadowColor?: string;
}

/**
 * A script component attached to a widget, emitted as a `components { }` block.
 *
 * This is how a widget gets behaviour that script looks up by name — e.g. a footer
 * hint button only answers `SCR_InputButtonComponent.GetInputButtonComponent(name, root)`
 * if it actually carries the component here.
 */
export interface WidgetComponentDef {
  /** Component class, e.g. "SCR_InputButtonComponent". */
  type: string;
  /** Component properties, e.g. { m_sLabel: "Back", m_sActionName: "MenuBack" }. */
  props?: Record<string, string>;
}

/** A widget in the layout tree. */
export interface WidgetNode {
  /** Friendly alias (Frame, VerticalLayout, RichText, Image, ...) or raw *WidgetClass. */
  type: string;
  /** Widget Name — used for FindAnyWidget() lookups in scripts. */
  name: string;
  /**
   * Base layout this widget inherits from, e.g.
   * "{08CF3B69CB1ACBC4}UI/layouts/WidgetLibrary/Buttons/WLib_NavigationButton.layout".
   * Emitted as `ButtonWidgetClass "{guid}" : "{ref}" { ... }` — the pattern every
   * WidgetLibrary-derived button (nav buttons, hint buttons) uses.
   */
  inherits?: string;
  /** Slot properties. Ignored for the root widget (root carries no slot). */
  slot?: LayoutSlotDef;
  /** Raw widget properties (Text, Opacity, Color, Texture, "Blend Mode", Current, Maximum, ...). */
  props?: Record<string, string>;
  /**
   * Escape hatch: extra property keys to emit QUOTED, for string fields the
   * `isStringValuedProp` allowlist doesn't cover. Known string fields (Text, Texture,
   * Image, m_s*, ...) are already quoted automatically, so this is only needed for a
   * rarely-used or mod-defined string property.
   */
  quotedProps?: string[];
  /** Optional font — expands to a FontProperties sub-node. */
  font?: FontDef;
  /** Script components attached to this widget (emitted in a `components { }` block). */
  components?: WidgetComponentDef[];
  /** Nested child widgets (emitted inside an anonymous { } block). */
  children?: WidgetNode[];
}

// ---------------------------------------------------------------------------
// Friendly alias -> widget class name
// ---------------------------------------------------------------------------

const WIDGET_ALIASES: Record<string, string> = {
  Frame: "FrameWidgetClass",
  VerticalLayout: "VerticalLayoutWidgetClass",
  HorizontalLayout: "HorizontalLayoutWidgetClass",
  SizeLayout: "SizeLayoutWidgetClass",
  ScrollLayout: "ScrollLayoutWidgetClass",
  Overlay: "OverlayWidgetClass",
  Scale: "ScaleWidgetClass",
  Text: "TextWidgetClass",
  RichText: "RichTextWidgetClass",
  Image: "ImageWidgetClass",
  ProgressBar: "ProgressBarWidgetClass",
  Button: "ButtonWidgetClass",
};

/** Resolve a friendly alias to its *WidgetClass name; raw class names pass through. */
export function resolveWidgetClass(type: string): string {
  if (WIDGET_ALIASES[type]) return WIDGET_ALIASES[type];
  return type;
}

// ---------------------------------------------------------------------------
// Slot type inference (parent widget class -> child slot type)
// ---------------------------------------------------------------------------

const SLOT_TYPE_BY_PARENT: Record<string, string> = {
  FrameWidgetClass: "FrameWidgetSlot",
  VerticalLayoutWidgetClass: "LayoutSlot",
  HorizontalLayoutWidgetClass: "LayoutSlot",
  SizeLayoutWidgetClass: "LayoutSlot",
  ScrollLayoutWidgetClass: "LayoutSlot",
  OverlayWidgetClass: "OverlayWidgetSlot",
  ScaleWidgetClass: "AlignableSlot",
};

/** Slot type a child gets, given its parent's resolved widget class. */
export function slotTypeForParent(parentClass: string): string {
  return SLOT_TYPE_BY_PARENT[parentClass] ?? "LayoutSlot";
}

// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------

const SLOT_KEY_ORDER: [keyof LayoutSlotDef, string][] = [
  ["anchor", "Anchor"],
  ["positionX", "PositionX"],
  ["offsetLeft", "OffsetLeft"],
  ["positionY", "PositionY"],
  ["offsetTop", "OffsetTop"],
  ["sizeX", "SizeX"],
  ["offsetRight", "OffsetRight"],
  ["sizeY", "SizeY"],
  ["offsetBottom", "OffsetBottom"],
  ["padding", "Padding"],
  ["horizontalAlign", "HorizontalAlign"],
  ["verticalAlign", "VerticalAlign"],
  ["sizeMode", "SizeMode"],
  ["fillWeight", "FillWeight"],
  ["sizeToContent", "SizeToContent"],
];

function slotValueToString(value: unknown): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function buildSlotNode(slotType: string, slot: LayoutSlotDef): EnfusionNode {
  const node = createNode("Slot", {
    id: `{${generateGuid()}}`,
  });
  node.className = slotType;
  for (const [key, enfKey] of SLOT_KEY_ORDER) {
    const value = slot[key];
    if (value !== undefined) {
      node.properties.push({ key: enfKey, value: slotValueToString(value) });
    }
  }
  return node;
}

function buildFontNode(font: FontDef): EnfusionNode {
  const node = createNode("FontProperties", {
    id: `{${generateGuid()}}`,
  });
  node.className = "FontProperties";
  node.properties.push({ key: "Font", value: font.font });
  if (font.shadowSize !== undefined) {
    node.properties.push({ key: "ShadowSize", value: String(font.shadowSize) });
  }
  if (font.shadowColor !== undefined) {
    node.properties.push({ key: "ShadowColor", value: font.shadowColor });
  }
  return node;
}

/**
 * Build an EnfusionNode for a widget. `parentClass` is the resolved widget class
 * of the parent, or null for the root (root gets no id and no slot).
 */
/**
 * Properties whose values are STRING fields and must always be emitted quoted, even
 * when the value happens to look like a bare identifier.
 *
 * Derived empirically, not guessed: across the 1177 base-game `.layout` files these keys
 * are quoted 100% of the time with zero bare occurrences —
 *   Name 10434, Prefab 4039, Text 1317, Texture 1220, Image 1130, Font 577,
 *   Mask 169, DestinationPath 49, MaskImage 29.
 *
 * The complementary set (enum-valued props such as SizeMode, Clipping, "Blend Mode",
 * "Horizontal Alignment", m_Type, m_eEvents) is entirely disjoint from this one and is
 * always bare, which is what makes an allowlist safe here rather than a heuristic.
 *
 * The one genuinely ambiguous key in the whole corpus is `Format` (6 quoted / 5 bare),
 * so it is deliberately left out and defaults to bare.
 */
const ALWAYS_QUOTED_PROPS = new Set([
  "Name",
  "Text",
  "Texture",
  "Image",
  "Font",
  "Mask",
  "MaskImage",
  "Prefab",
  "DestinationPath",
]);

/**
 * True when a property key names a string field, so its value must be quoted.
 *
 * The `m_s` prefix is the engine's own naming convention for string members. Verified
 * against the same corpus: every `m_s*` property is quoted, and no enum-valued property
 * (`m_e*`, `m_i*`, `m_Type`, `m_Icons`, ...) uses that prefix — so the rule cannot
 * accidentally quote an enum.
 */
export function isStringValuedProp(key: string): boolean {
  return ALWAYS_QUOTED_PROPS.has(key) || /^m_s[A-Z]/.test(key);
}

function buildComponentsNode(components: WidgetComponentDef[]): EnfusionNode {
  const block = createNode("components");
  for (const comp of components) {
    const node = createNode(comp.type, { id: `{${generateGuid()}}` });
    for (const [key, value] of Object.entries(comp.props ?? {})) {
      // Same rule as widget props: quote string fields (m_sLabel, m_sActionName), leave
      // enum members (m_Type FOCUS, m_eEvents EVENT_CLICKED) bare.
      node.properties.push(
        isStringValuedProp(key) ? { key, value, quoted: true } : { key, value }
      );
    }
    block.children.push(node);
  }
  return block;
}

function buildWidgetNode(widget: WidgetNode, parentClass: string | null): EnfusionNode {
  const cls = resolveWidgetClass(widget.type);
  const isRoot = parentClass === null;

  // A widget that inherits from a base layout still carries a GUID at the root of
  // THIS file when it is a child; the root widget itself never does.
  const node = createNode(cls, {
    id: isRoot ? undefined : `{${generateGuid()}}`,
    inheritance: widget.inherits,
  });

  // Name is always the first property (always quoted — it's a string field).
  node.properties.push({ key: "Name", value: widget.name, quoted: true });

  // Additional widget properties. String fields are quoted automatically; `quotedProps`
  // is the escape hatch for a string field the allowlist doesn't know about.
  if (widget.props) {
    const forceQuoted = new Set(widget.quotedProps ?? []);
    for (const [key, value] of Object.entries(widget.props)) {
      const quote = forceQuoted.has(key) || isStringValuedProp(key);
      node.properties.push(quote ? { key, value, quoted: true } : { key, value });
    }
  }

  // Slot (children only) — type inferred from the parent widget class.
  if (!isRoot && widget.slot) {
    node.children.push(buildSlotNode(slotTypeForParent(parentClass!), widget.slot));
  }

  // Font -> FontProperties sub-node.
  if (widget.font) {
    node.children.push(buildFontNode(widget.font));
  }

  // Script components -> `components { }` block, before the children block.
  if (widget.components && widget.components.length > 0) {
    node.children.push(buildComponentsNode(widget.components));
  }

  // Child widgets go inside an anonymous { } block (empty-type node).
  if (widget.children && widget.children.length > 0) {
    const block = createNode("");
    for (const child of widget.children) {
      block.children.push(buildWidgetNode(child, cls));
    }
    node.children.push(block);
  }

  return node;
}

/**
 * Generate an Enfusion .layout file from a parent-aware widget tree.
 * The root widget carries no slot; every descendant's slot type is inferred
 * from its parent widget class.
 */
export function generateLayoutTree(root: WidgetNode, _description?: string): string {
  const rootNode = buildWidgetNode(root, null);
  return serialize(rootNode);
}

// ---------------------------------------------------------------------------
// Backward-compatible flat API (layoutType templates + widgets[])
// ---------------------------------------------------------------------------

export type LayoutType = "hud" | "menu" | "dialog" | "list" | "custom";

/** Flat widget definition (legacy API). */
export interface WidgetDef {
  type: string;
  name: string;
  /** "left top right bottom" floats 0-1 */
  anchor?: string;
  /** "left top right bottom" pixels */
  offset?: string;
  properties?: Record<string, string>;
  children?: WidgetDef[];
}

export interface LayoutOptions {
  name: string;
  layoutType: LayoutType;
  rootWidgetType?: string;
  anchor?: string;
  offset?: string;
  widgets?: WidgetDef[];
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

/** Parse a "left top right bottom" pixel offset string into slot offset fields. */
function parseOffset(offset: string): Partial<LayoutSlotDef> {
  const parts = offset.trim().split(/\s+/).map(Number);
  const out: Partial<LayoutSlotDef> = {};
  if (parts.length > 0 && !Number.isNaN(parts[0])) out.offsetLeft = parts[0];
  if (parts.length > 1 && !Number.isNaN(parts[1])) out.offsetTop = parts[1];
  if (parts.length > 2 && !Number.isNaN(parts[2])) out.offsetRight = parts[2];
  if (parts.length > 3 && !Number.isNaN(parts[3])) out.offsetBottom = parts[3];
  return out;
}

/** Convert a legacy WidgetDef into a WidgetNode. */
function widgetDefToNode(def: WidgetDef): WidgetNode {
  let slot: LayoutSlotDef | undefined;
  if (def.anchor || def.offset) {
    slot = {};
    if (def.anchor) slot.anchor = def.anchor;
    if (def.offset) Object.assign(slot, parseOffset(def.offset));
  }
  return {
    type: def.type,
    name: def.name,
    slot,
    props: def.properties,
    children: def.children?.map(widgetDefToNode),
  };
}

/**
 * Generate an Enfusion .layout file (legacy flat API).
 * Builds a full-screen root frame containing a positioned panel with the
 * template's default widgets plus any user widgets, then delegates to
 * generateLayoutTree so the correct slot types / anonymous blocks are emitted.
 */
export function generateLayout(opts: LayoutOptions): string {
  const config = LAYOUT_CONFIGS[opts.layoutType];
  const rootType = opts.rootWidgetType || config.rootWidgetType;
  const panelAnchor = opts.anchor || config.defaultAnchor;
  const panelOffset = opts.offset || config.defaultOffset;

  const allWidgets: WidgetDef[] = [
    ...config.defaultWidgets,
    ...(opts.widgets ?? []),
  ];

  const panel: WidgetNode = {
    type: rootType,
    name: `${opts.name}Panel`,
    slot: { anchor: panelAnchor, ...parseOffset(panelOffset) },
    children: allWidgets.map(widgetDefToNode),
  };

  const root: WidgetNode = {
    type: "FrameWidgetClass",
    name: `${opts.name}Root`,
    children: [panel],
  };

  return generateLayoutTree(root, opts.description);
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
