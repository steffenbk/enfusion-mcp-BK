import { describe, it, expect } from "vitest";
import {
  generateMenuScript,
  generateMenuPresetBlock,
  buildMenuLayoutTree,
  DEFAULT_HINTS,
  type MenuHint,
} from "../../src/templates/menu.js";
import { generateLayoutTree } from "../../src/templates/layout.js";

/**
 * Count braces in CODE only. Comments legitimately contain braces (a user-supplied
 * label is rendered into one), so counting them raw would flag safe output.
 */
function codeBraces(src: string): { open: number; close: number } {
  const code = src
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return {
    open: (code.match(/\{/g) ?? []).length,
    close: (code.match(/\}/g) ?? []).length,
  };
}

const BASE_OPTS = {
  className: "TAG_ShopMenu",
  presetName: "TAG_ShopMenu",
  layoutName: "TAG_ShopMenu",
  baseClass: "ChimeraMenuBase" as const,
  actionContext: "MenuContext",
  hints: DEFAULT_HINTS,
};

describe("generateMenuScript", () => {
  it("declares the modded enum constant matching the preset name", () => {
    const c = generateMenuScript({ ...BASE_OPTS, presetName: "TAG_Custom" });
    expect(c).toContain("modded enum ChimeraMenuPreset");
    expect(c).toMatch(/modded enum ChimeraMenuPreset\s*\{\s*TAG_Custom\s*\}/);
  });

  it("inherits the requested base class", () => {
    expect(generateMenuScript(BASE_OPTS)).toContain("class TAG_ShopMenu : ChimeraMenuBase");
    expect(generateMenuScript({ ...BASE_OPTS, baseClass: "MenuRootBase" })).toContain(
      "class TAG_ShopMenu : MenuRootBase"
    );
  });

  it("re-activates the input context every frame inside OnMenuUpdate", () => {
    const c = generateMenuScript(BASE_OPTS);
    const update = c.slice(c.indexOf("override void OnMenuUpdate"));
    expect(update).toContain('input.ActivateContext("MenuContext");');
  });

  it("also activates MenuWithEditorContext so directional actions can fire", () => {
    expect(generateMenuScript(BASE_OPTS)).toContain('input.ActivateContext("MenuWithEditorContext");');
  });

  it("honours a custom action context", () => {
    const c = generateMenuScript({ ...BASE_OPTS, actionContext: "TAG_ShopContext" });
    expect(c).toContain('input.ActivateContext("TAG_ShopContext");');
  });

  it("emits a time-based debounce keyed per action, not a per-frame flag", () => {
    const c = generateMenuScript(BASE_OPTS);
    expect(c).toContain("protected bool ActionReady(string key)");
    expect(c).toContain("float nowMs = world.GetWorldTime();");
    expect(c).toContain("ACTION_DEBOUNCE_MS");
    expect(c).toContain("m_mActionStampMs.Set(key, nowMs);");
  });

  it("wires each hint through both routes: the button invoker and the polled action", () => {
    const c = generateMenuScript(BASE_OPTS);
    expect(c).toContain('SCR_InputButtonComponent.GetInputButtonComponent("HintBack", root)');
    expect(c).toContain("m_OnActivated.Insert(OnBack);");
    expect(c).toContain('if (input.GetActionTriggered("MenuBack"))');
  });

  // Regression: guarding only the poll leaves the invoker route undebounced, so a mouse
  // click runs the handler and the poll runs it again in the same frame.
  it("debounces inside the handler, not in the poll condition, so BOTH routes are covered", () => {
    const c = generateMenuScript(BASE_OPTS);
    expect(c).toMatch(/protected void OnBack\(\)\s*\{\s*if \(!ActionReady\("MenuBack"\)\)\s*return;/);
    expect(c).not.toContain("&& ActionReady(");
  });

  it("fails open rather than dereferencing a null world", () => {
    const c = generateMenuScript(BASE_OPTS);
    expect(c).toContain("ChimeraWorld world = GetGame().GetWorld();");
    expect(c).toMatch(/if \(!world\)\s*return true;/);
    expect(c).not.toContain("GetGame().GetWorld().GetWorldTime()");
  });

  it("puts per-frame work before the early-returning hint polls", () => {
    const c = generateMenuScript(BASE_OPTS);
    const update = c.slice(c.indexOf("override void OnMenuUpdate"));
    expect(update.indexOf("per-frame menu work")).toBeLessThan(update.indexOf("GetActionTriggered"));
  });

  it("keeps a multi-line label from escaping its generated comment", () => {
    const c = generateMenuScript({
      ...BASE_OPTS,
      hints: [{ widget: "HintBuy", label: "Buy\n\t}\n\tvoid Pwned()", action: "MenuSelect", handler: "OnBuy" }],
    });
    const { open, close } = codeBraces(c);
    expect(open).toBe(close);
    expect(c).not.toMatch(/void Pwned\(\)\s*$/m);
  });

  it("null-guards every hint lookup so a missing widget cannot break the menu", () => {
    const hints: MenuHint[] = [
      { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
      { widget: "HintBuy", label: "Buy", action: "MenuSelect", handler: "OnBuy" },
    ];
    const c = generateMenuScript({ ...BASE_OPTS, hints });
    expect(c).toContain("if (hintBack)");
    expect(c).toContain("if (hintBuy)");
  });

  it("gives a MenuBack hint a Close() body and other hints a stub", () => {
    const hints: MenuHint[] = [
      { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
      { widget: "HintBuy", label: "Buy", action: "MenuSelect", handler: "OnBuy" },
    ];
    const c = generateMenuScript({ ...BASE_OPTS, hints });
    expect(c).toContain("Close();");
    expect(c).toMatch(/protected void OnBuy\(\)[\s\S]*?\/\/ TODO: implement "Buy"/);
  });

  it("declares a handler for every hint it references", () => {
    const hints: MenuHint[] = [
      { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
      { widget: "HintBuy", label: "Buy", action: "MenuSelect", handler: "OnBuy" },
      { widget: "HintLast", label: "Re-buy", action: "MenuFavourite", handler: "OnBuyLast" },
    ];
    const c = generateMenuScript({ ...BASE_OPTS, hints });
    for (const h of hints) {
      expect(c).toContain(`protected void ${h.handler}()`);
    }
  });

  it("produces balanced braces", () => {
    const c = generateMenuScript({
      ...BASE_OPTS,
      hints: [
        { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
        { widget: "HintBuy", label: "Buy", action: "MenuSelect", handler: "OnBuy" },
      ],
    });
    const { open, close } = codeBraces(c);
    expect(open).toBe(close);
  });

  it("works with no hints at all", () => {
    const c = generateMenuScript({ ...BASE_OPTS, hints: [] });
    expect(c).toContain("class TAG_ShopMenu : ChimeraMenuBase");
    expect(c).not.toContain("SCR_InputButtonComponent");
    const { open, close } = codeBraces(c);
    expect(open).toBe(close);
  });
});

describe("generateMenuPresetBlock", () => {
  it("emits Layout, ActionContext and Class keyed on the preset name", () => {
    const b = generateMenuPresetBlock({
      presetName: "TAG_ShopMenu",
      layoutRef: "{ABC}UI/layouts/Menus/TAG_ShopMenu.layout",
      className: "TAG_ShopMenu",
      actionContext: "MenuContext",
    });
    expect(b).toContain("MenuPreset TAG_ShopMenu {");
    expect(b).toContain('Layout "{ABC}UI/layouts/Menus/TAG_ShopMenu.layout"');
    expect(b).toContain('ActionContext "MenuContext"');
    expect(b).toContain('Class "TAG_ShopMenu"');
  });
});

describe("buildMenuLayoutTree -> generateLayoutTree", () => {
  const tree = buildMenuLayoutTree({
    layoutName: "TAG_ShopMenu",
    title: "SHOP",
    hints: [
      { widget: "HintBack", label: "Back", action: "MenuBack", handler: "OnBack" },
      { widget: "HintBuy", label: "Buy", action: "MenuSelect", handler: "OnBuy" },
    ],
  });
  const out = generateLayoutTree(tree);

  it("roots at a Frame with no GUID and no Slot", () => {
    expect(out.startsWith("FrameWidgetClass {")).toBe(true);
    const firstLines = out.split("\n").slice(0, 3).join("\n");
    expect(firstLines).not.toContain("Slot ");
  });

  it("gives each hint button a components block carrying SCR_InputButtonComponent", () => {
    expect(out).toContain("components {");
    expect(out).toContain("SCR_InputButtonComponent");
    expect(out).toContain('m_sActionName "MenuBack"');
    expect(out).toContain('m_sActionName "MenuSelect"');
    expect(out).toContain('m_sLabel "Back"');
  });

  it("derives hint buttons from the WidgetLibrary nav button", () => {
    expect(out).toContain("UI/layouts/WidgetLibrary/Buttons/WLib_NavigationButton.layout");
    expect(out).toMatch(/ButtonWidgetClass "\{[0-9A-Fa-f]+\}" : "\{[0-9A-Fa-f]+\}UI\/layouts\/WidgetLibrary/);
  });

  it("quotes the title even when it is a single bare word", () => {
    expect(out).toContain('Text "SHOP"');
  });

  it("names the widgets the generated script looks up", () => {
    expect(out).toContain('Name "HintBack"');
    expect(out).toContain('Name "HintBuy"');
    expect(out).toContain('Name "Content"');
  });

  it("produces balanced braces", () => {
    const open = (out.match(/\{/g) ?? []).length;
    const close = (out.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });
});
