import type { WidgetNode } from "./layout.js";

/**
 * Custom menu scaffolding.
 *
 * A working custom menu needs three artefacts that must agree on one name, and the
 * failure mode when they don't is silence — the menu simply never opens. On top of
 * that the input layer has several traps that all present as "my keybinds don't work
 * but the mouse does". This module emits all three artefacts pre-wired.
 *
 * Every non-obvious line in the generated script is commented with WHY, because the
 * generated file is the only place a user will see that reasoning.
 *
 * Sourced from the StrongPoint mod; see the arma-knowledge pattern file
 * patterns/UI_And_Interface/custom-menus-and-menu-modding.md.
 */

/** WidgetLibrary nav button every footer hint derives from. */
const WLIB_NAV_BUTTON =
  "{08CF3B69CB1ACBC4}UI/layouts/WidgetLibrary/Buttons/WLib_NavigationButton.layout";

const FONT_BOLD = "{EABA4FE9D014CCEF}UI/Fonts/RobotoCondensed/RobotoCondensed_Bold.fnt";

/**
 * Base classes a menu may inherit.
 *
 * `SCR_SuperMenuBase` is deliberately NOT offered: its only job is to find an
 * SCR_SuperMenuComponent in the layout root and forward the menu lifecycle to it, and
 * without that component it prints an error on every open while doing nothing. A menu
 * that draws itself wants MenuRootBase, which is that class's own parent.
 */
export type MenuBaseClass = "ChimeraMenuBase" | "MenuRootBase";

export const MENU_BASE_CLASSES: readonly MenuBaseClass[] = ["ChimeraMenuBase", "MenuRootBase"];

/** A footer hint button: a nav button carrying an SCR_InputButtonComponent. */
export interface MenuHint {
  /** Widget name, used by both the layout and the script lookup, e.g. "HintBack". */
  widget: string;
  /** Visible label, e.g. "Back". */
  label: string;
  /**
   * Input action bound to the hint, e.g. "MenuBack" / "MenuSelect" / "MenuRefresh".
   * MUST be a tap action — a hold action crashes the hint's hold animation.
   */
  action: string;
  /** Generated handler method name, e.g. "OnBack". */
  handler: string;
}

export interface MenuScaffoldOptions {
  /** Enforce class name, e.g. "TAG_ShopMenu". */
  className: string;
  /** MenuPreset name — must match the ChimeraMenuPreset enum constant exactly. */
  presetName: string;
  /** Layout file name without extension, e.g. "TAG_ShopMenu". */
  layoutName: string;
  /** Base class to inherit. */
  baseClass: MenuBaseClass;
  /** ActionContext declared on the MenuPreset. */
  actionContext: string;
  /** Footer hint buttons. */
  hints: MenuHint[];
  /** Optional description for the file header. */
  description?: string;
}

/** Default footer: a Back hint, which every menu needs to be escapable. */
export const DEFAULT_HINTS: MenuHint[] = [
  { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
];

// ---------------------------------------------------------------------------
// Enforce script
// ---------------------------------------------------------------------------

/**
 * Generate the menu class .c file.
 *
 * The Back hint is special-cased: its handler closes the menu, and the polled
 * MenuBack branch returns immediately so a later hint cannot also fire on the same
 * press. Every other hint gets an empty handler stub for the caller to fill in.
 */
export function generateMenuScript(opts: MenuScaffoldOptions): string {
  const { className, presetName, baseClass, actionContext, hints } = opts;

  const L: string[] = [];
  const header = opts.description ?? `${className} — custom menu.`;

  L.push(`//------------------------------------------------------------------------------------------------`);
  L.push(`//! ${header}`);
  L.push(`//!`);
  L.push(`//! Registered as the ${presetName} preset in Configs/System/chimeraMenus.conf. All three of the`);
  L.push(`//! enum constant below, that preset's name, and the Class it names must match exactly or the`);
  L.push(`//! menu silently never opens.`);
  L.push(`//!`);
  L.push(`//! Open with:  GetGame().GetMenuManager().OpenMenu(ChimeraMenuPreset.${presetName});`);
  L.push(`//------------------------------------------------------------------------------------------------`);
  L.push(`modded enum ChimeraMenuPreset`);
  L.push(`{`);
  L.push(`\t${presetName}`);
  L.push(`}`);
  L.push(``);
  L.push(`class ${className} : ${baseClass}`);
  L.push(`{`);

  // --- debounce state -----------------------------------------------------
  L.push(`\t//! Per-action press timestamps for the dual-route debounce in ActionReady().`);
  L.push(`\tprotected ref map<string, float> m_mActionStampMs;`);
  L.push(``);
  L.push(`\t//! Two routes report the SAME physical press: a hint button's m_OnActivated invoker`);
  L.push(`\t//! (mouse) and the per-frame poll in OnMenuUpdate (keyboard / gamepad). Both are needed —`);
  L.push(`\t//! drop the poll and Enter/pad-A stop working, drop the buttons and clicks stop.`);
  L.push(`\t//! 150 ms is comfortably longer than one frame at any playable rate.`);
  L.push(`\tprotected static const float ACTION_DEBOUNCE_MS = 150;`);
  L.push(``);

  // --- OnMenuOpen ---------------------------------------------------------
  L.push(`\t//------------------------------------------------------------------------------------------------`);
  L.push(`\toverride void OnMenuOpen()`);
  L.push(`\t{`);
  L.push(`\t\tsuper.OnMenuOpen();`);
  L.push(``);
  L.push(`\t\tWidget root = GetRootWidget();`);
  L.push(`\t\tif (!root)`);
  L.push(`\t\t\treturn;`);

  if (hints.length > 0) {
    L.push(``);
    L.push(`\t\t// Footer hints. SCR_InputButtonComponent draws whatever glyph the ACTIVE device uses and`);
    L.push(`\t\t// swaps live when a pad is picked up, so the screen never tells a controller player to`);
    L.push(`\t\t// press Enter. Each lookup is null-guarded: a missing widget must not break the menu.`);
    for (const h of hints) {
      const varName = lowerFirst(h.widget);
      L.push(`\t\tSCR_InputButtonComponent ${varName} = SCR_InputButtonComponent.GetInputButtonComponent("${h.widget}", root);`);
      L.push(`\t\tif (${varName})`);
      L.push(`\t\t\t${varName}.m_OnActivated.Insert(${h.handler});`);
    }
  }

  L.push(`\t}`);
  L.push(``);

  // --- OnMenuUpdate -------------------------------------------------------
  L.push(`\t//------------------------------------------------------------------------------------------------`);
  L.push(`\t//! Input contexts must be re-activated EVERY FRAME. Without this only raw mouse clicks work —`);
  L.push(`\t//! Enter, ESC, tab keys and the whole gamepad appear dead, which reads as a keybinding problem`);
  L.push(`\t//! and is not one.`);
  L.push(`\toverride void OnMenuUpdate(float tDelta)`);
  L.push(`\t{`);
  L.push(`\t\tsuper.OnMenuUpdate(tDelta);`);
  L.push(``);
  L.push(`\t\tInputManager input = GetGame().GetInputManager();`);
  L.push(`\t\tif (!input)`);
  L.push(`\t\t\treturn;`);
  L.push(``);
  L.push(`\t\tinput.ActivateContext("${actionContext}");`);
  L.push(``);
  L.push(`\t\t// MenuUp / MenuDown are NOT in MenuContext — they live in MenuWithEditorContext and`);
  L.push(`\t\t// friends, so polling them under MenuContext alone can never fire. This context is a pure`);
  L.push(`\t\t// menu-action superset, so co-activating it is safe. Remove only if this menu polls no`);
  L.push(`\t\t// directional actions at all.`);
  L.push(`\t\tinput.ActivateContext("MenuWithEditorContext");`);
  L.push(``);
  L.push(`\t\t// TODO: per-frame menu work goes here. Keep it cheap — this runs every frame. Text and`);
  L.push(`\t\t// number fills belong on a slower accumulator pass (~0.25 s) rather than here.`);
  L.push(`\t\t// Deliberately BEFORE the hint polling below, which returns early on a handled press —`);
  L.push(`\t\t// work placed after it would silently not run on those frames.`);

  if (hints.length > 0) {
    L.push(``);
    L.push(`\t\t// Action LISTENERS do not fire reliably in this menu family, so actions are POLLED`);
    L.push(`\t\t// here instead. The debounce lives inside each handler, not in these conditions — see`);
    L.push(`\t\t// the note on ActionReady().`);

    for (const h of hints) {
      L.push(`\t\tif (input.GetActionTriggered("${h.action}"))`);
      L.push(`\t\t{`);
      L.push(`\t\t\t${h.handler}();`);
      L.push(`\t\t\treturn;`);
      L.push(`\t\t}`);
    }
  }

  L.push(`\t}`);
  L.push(``);

  // --- ActionReady --------------------------------------------------------
  L.push(`\t//------------------------------------------------------------------------------------------------`);
  L.push(`\t//! Call this at the TOP OF EVERY HANDLER, never in the poll condition.`);
  L.push(`\t//!`);
  L.push(`\t//! Both routes to a handler must pass through the debounce. Guarding only the poll leaves`);
  L.push(`\t//! the hint button's m_OnActivated invoker free to fire the handler directly, so a mouse`);
  L.push(`\t//! click runs it undebounced and the poll then runs it again in the same frame.`);
  L.push(`\t//!`);
  L.push(`\t//! Time-based, NOT a per-frame flag: the invoker and the poll dispatch at different points`);
  L.push(`\t//! in the frame, so a flag cleared between them lets the double-fire back in. Symptom when`);
  L.push(`\t//! this is missing or flag-based: one press advances two steps, or Close() runs twice and`);
  L.push(`\t//! takes the menu underneath with it.`);
  L.push(`\tprotected bool ActionReady(string key)`);
  L.push(`\t{`);
  L.push(`\t\tif (!m_mActionStampMs)`);
  L.push(`\t\t\tm_mActionStampMs = new map<string, float>();`);
  L.push(``);
  L.push(`\t\t// A menu opened outside a mission (e.g. from the main menu) has no world. Failing open`);
  L.push(`\t\t// is correct here: a missing debounce is a double-press, a null deref is a crash.`);
  L.push(`\t\tChimeraWorld world = GetGame().GetWorld();`);
  L.push(`\t\tif (!world)`);
  L.push(`\t\t\treturn true;`);
  L.push(``);
  L.push(`\t\tfloat nowMs = world.GetWorldTime();`);
  L.push(``);
  L.push(`\t\tfloat lastMs;`);
  L.push(`\t\tif (m_mActionStampMs.Find(key, lastMs) && nowMs - lastMs < ACTION_DEBOUNCE_MS)`);
  L.push(`\t\t\treturn false;`);
  L.push(``);
  L.push(`\t\tm_mActionStampMs.Set(key, nowMs);`);
  L.push(`\t\treturn true;`);
  L.push(`\t}`);

  // --- handlers -----------------------------------------------------------
  // The debounce guard goes at the top of the handler so BOTH the invoker route and the
  // polled route are covered (see C1 in the scaffold's review history).
  for (const h of hints) {
    L.push(``);
    L.push(`\t//------------------------------------------------------------------------------------------------`);
    L.push(`\tprotected void ${h.handler}()`);
    L.push(`\t{`);
    L.push(`\t\tif (!ActionReady("${h.action}"))`);
    L.push(`\t\t\treturn;`);
    L.push(``);
    if (h.action === "MenuBack") {
      L.push(`\t\tClose();`);
    } else {
      L.push(`\t\t// TODO: implement ${commentSafe(h.label)}.`);
    }
    L.push(`\t}`);
  }

  L.push(`}`);
  L.push(``);

  return L.join("\n");
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0].toLowerCase() + s.slice(1);
}

/**
 * Render free text safely inside a generated `//` comment.
 *
 * Labels are user-supplied free text and land in emitted source; a newline would end the
 * comment and let the rest of the label be parsed as code.
 */
function commentSafe(text: string): string {
  const flat = text.replace(/[\r\n]+/g, " ").trim();
  return JSON.stringify(flat);
}

/** Bare Enforce identifier — safe to embed in a generated string literal. */
export const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// ---------------------------------------------------------------------------
// chimeraMenus.conf preset block
// ---------------------------------------------------------------------------

/**
 * The MenuPreset block to paste into an overridden Configs/System/chimeraMenus.conf.
 *
 * Emitted as text rather than written directly: chimeraMenus.conf is a full override of
 * the vanilla file (hundreds of presets), and silently creating a stub containing only
 * this one entry would delete every vanilla menu in the game. The tool refuses to guess.
 */
export function generateMenuPresetBlock(opts: {
  presetName: string;
  layoutRef: string;
  className: string;
  actionContext: string;
}): string {
  return [
    `  MenuPreset ${opts.presetName} {`,
    `   Layout "${opts.layoutRef}"`,
    `   ActionContext "${opts.actionContext}"`,
    `   Class "${opts.className}"`,
    `  }`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Layout tree
// ---------------------------------------------------------------------------

/**
 * Root layout for the menu: a full-bleed background, a titled content area for the
 * caller to fill, and a footer hint bar whose buttons carry SCR_InputButtonComponent
 * so the generated script's lookups actually resolve.
 */
export function buildMenuLayoutTree(opts: {
  layoutName: string;
  title: string;
  hints: MenuHint[];
}): WidgetNode {
  const hintButtons: WidgetNode[] = opts.hints.map((h) => ({
    type: "Button",
    name: h.widget,
    // Derive from the WidgetLibrary nav button so the glyph, sizing and focus visuals
    // match every other footer in the game.
    inherits: WLIB_NAV_BUTTON,
    slot: { horizontalAlign: 2, verticalAlign: 1 },
    components: [
      {
        type: "SCR_InputButtonComponent",
        props: { m_sLabel: h.label, m_sActionName: h.action },
      },
    ],
  }));

  return {
    type: "Frame",
    name: opts.layoutName,
    children: [
      {
        type: "Image",
        name: "Background",
        slot: { anchor: "0 0 1 1" },
        // Dark translucent scrim rather than opaque: the blurred world showing through
        // is what makes foreground panels read as panels.
        props: { Color: "0.016 0.019 0.025 0.92" },
      },
      {
        type: "Text",
        name: "Title",
        slot: { anchor: "0 0 1 0", offsetLeft: 48, offsetTop: 36, offsetRight: -48, offsetBottom: 88 },
        props: { Text: opts.title, "Exact Font Size": "34" },
        font: { font: FONT_BOLD, shadowSize: 2 },
      },
      {
        type: "Frame",
        name: "Content",
        slot: { anchor: "0 0 1 1", offsetLeft: 48, offsetTop: 96, offsetRight: -48, offsetBottom: -96 },
      },
      {
        type: "HorizontalLayout",
        name: "FooterHints",
        slot: { anchor: "0 1 1 1", offsetLeft: 48, offsetTop: -72, offsetRight: -48, offsetBottom: -20 },
        children: hintButtons,
      },
    ],
  };
}
