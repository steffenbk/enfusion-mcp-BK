import { describe, it, expect } from "vitest";
import {
  generateLayout,
  generateLayoutTree,
  resolveWidgetClass,
  slotTypeForParent,
  type WidgetNode,
} from "../../src/templates/layout.js";
import { parse } from "../../src/formats/enfusion-text.js";

describe("resolveWidgetClass", () => {
  it("maps friendly aliases to *WidgetClass", () => {
    expect(resolveWidgetClass("Frame")).toBe("FrameWidgetClass");
    expect(resolveWidgetClass("VerticalLayout")).toBe("VerticalLayoutWidgetClass");
    expect(resolveWidgetClass("RichText")).toBe("RichTextWidgetClass");
    expect(resolveWidgetClass("ProgressBar")).toBe("ProgressBarWidgetClass");
  });

  it("passes raw class names through unchanged", () => {
    expect(resolveWidgetClass("ImageWidgetClass")).toBe("ImageWidgetClass");
    expect(resolveWidgetClass("SCR_CustomWidgetClass")).toBe("SCR_CustomWidgetClass");
  });
});

describe("slotTypeForParent", () => {
  it("infers slot type from the parent widget class", () => {
    expect(slotTypeForParent("FrameWidgetClass")).toBe("FrameWidgetSlot");
    expect(slotTypeForParent("VerticalLayoutWidgetClass")).toBe("LayoutSlot");
    expect(slotTypeForParent("HorizontalLayoutWidgetClass")).toBe("LayoutSlot");
    expect(slotTypeForParent("OverlayWidgetClass")).toBe("OverlayWidgetSlot");
    expect(slotTypeForParent("ScaleWidgetClass")).toBe("AlignableSlot");
  });

  it("defaults unknown parents to LayoutSlot", () => {
    expect(slotTypeForParent("SomethingWidgetClass")).toBe("LayoutSlot");
  });
});

describe("generateLayoutTree", () => {
  const tree: WidgetNode = {
    type: "Frame",
    name: "rootFrame",
    children: [
      {
        type: "Overlay",
        name: "Overlay0",
        slot: { anchor: "1 0.5 1 0.5", offsetLeft: -60, offsetTop: 300 },
        children: [
          {
            type: "Image",
            name: "Icon",
            slot: { horizontalAlign: 3, verticalAlign: 3 },
            props: { Opacity: "0", Texture: "{ABC}Images/Icon.edds", "Blend Mode": "Additive" },
          },
        ],
      },
      {
        type: "VerticalLayout",
        name: "Stack",
        slot: { anchor: "0.5 0 0.5 0" },
        children: [
          {
            type: "RichText",
            name: "Timer",
            slot: { padding: "5 0 5 0" },
            props: { Text: "01:00", "Font Size": "36" },
            font: { font: "{EAB}UI/Fonts/RobotoCondensed/RobotoCondensed_Bold.fnt", shadowSize: 5 },
          },
        ],
      },
    ],
  };

  const out = generateLayoutTree(tree);

  it("never emits a Children keyword (uses anonymous blocks)", () => {
    expect(out).not.toMatch(/\bChildren\b/);
  });

  it("emits an anonymous child block", () => {
    // A brace block opened by whitespace only (no type name before it).
    expect(out).toMatch(/\n\s+\{/);
  });

  it("resolves aliases to widget classes", () => {
    expect(out).toContain("FrameWidgetClass {");
    expect(out).toContain("OverlayWidgetClass");
    expect(out).toContain("VerticalLayoutWidgetClass");
    expect(out).toContain("RichTextWidgetClass");
    expect(out).toContain("ImageWidgetClass");
  });

  it("gives each child the slot type inferred from its parent", () => {
    // Overlay + VerticalLayout are children of the root Frame -> FrameWidgetSlot
    expect(out).toContain("Slot FrameWidgetSlot");
    // Image is a child of Overlay -> OverlayWidgetSlot
    expect(out).toContain("Slot OverlayWidgetSlot");
    // Timer is a child of VerticalLayout -> LayoutSlot
    expect(out).toContain("Slot LayoutSlot");
  });

  it("does not emit a slot on the root widget", () => {
    const firstLines = out.split("\n").slice(0, 3).join("\n");
    expect(firstLines).toContain("FrameWidgetClass {");
    expect(firstLines).not.toContain("Slot");
  });

  it("expands font into a FontProperties sub-node", () => {
    expect(out).toContain('FontProperties FontProperties "{');
    expect(out).toContain("RobotoCondensed_Bold.fnt");
    expect(out).toContain("ShadowSize 5");
  });

  it("emits numeric tuple slot values unquoted", () => {
    expect(out).toContain("Anchor 1 0.5 1 0.5");
    expect(out).not.toContain('Anchor "1 0.5 1 0.5"');
  });

  it("quotes multi-word property keys", () => {
    expect(out).toContain('"Blend Mode" Additive');
    expect(out).not.toContain("\n     Blend Mode Additive");
  });

  it("parses back without throwing (valid Enfusion text)", () => {
    expect(() => parse(out)).not.toThrow();
  });
});

describe("generateLayout (flat back-compat API)", () => {
  for (const layoutType of ["hud", "menu", "dialog", "list", "custom"] as const) {
    it(`generates a ${layoutType} layout without the Children bug`, () => {
      const out = generateLayout({ name: "Test", layoutType });
      expect(out).toContain("FrameWidgetClass {");
      expect(out).not.toMatch(/\bChildren\b/);
      expect(() => parse(out)).not.toThrow();
    });
  }

  it("positions the panel with a FrameWidgetSlot and omits a root slot", () => {
    const out = generateLayout({ name: "Test", layoutType: "hud" });
    expect(out).toContain("Slot FrameWidgetSlot");
    // Root frame line has no slot immediately after it.
    expect(out.split("\n")[0]).toBe("FrameWidgetClass {");
  });

  it("carries user widgets and their properties through", () => {
    const out = generateLayout({
      name: "Test",
      layoutType: "custom",
      widgets: [
        { type: "TextWidgetClass", name: "Score", anchor: "0 0 1 0", properties: { Text: "0" } },
      ],
    });
    expect(out).toContain('Name "Score"');
    // Text is a string field, so it is quoted even for a bare-looking value.
    expect(out).toContain('Text "0"');
  });
});

// ---------------------------------------------------------------------------
// String vs enum property quoting.
//
// The rule is derived from the 1177 base-game .layout files: string fields are
// quoted 100% of the time (Text 1317/1317, Texture 1220/1220, Image 1130/1130),
// and the enum-valued props form a completely disjoint, always-bare set
// (SizeMode 1152, Clipping 786, "Horizontal Alignment" 334, "Blend Mode" 59).
// ---------------------------------------------------------------------------
describe("property quoting", () => {
  function emit(props: Record<string, string>, components?: WidgetNode["components"]): string {
    return generateLayoutTree({
      type: "Frame",
      name: "Root",
      children: [{ type: "Image", name: "W", slot: {}, props, components }],
    });
  }

  it("quotes string fields whose values look like bare identifiers", () => {
    const out = emit({ Text: "SHOP", Texture: "Focus", Image: "favourite" });
    expect(out).toContain('Text "SHOP"');
    expect(out).toContain('Texture "Focus"');
    expect(out).toContain('Image "favourite"');
  });

  it("leaves enum-valued properties bare", () => {
    const out = emit({
      "Blend Mode": "Additive",
      SizeMode: "Fill",
      Clipping: "Inherit",
      "Horizontal Alignment": "Center",
    });
    expect(out).toContain('"Blend Mode" Additive');
    expect(out).toContain("SizeMode Fill");
    expect(out).toContain("Clipping Inherit");
    expect(out).toContain('"Horizontal Alignment" Center');
  });

  it("leaves numeric scalars and tuples bare", () => {
    const out = emit({ Color: "1 0.72 0.24 1", Opacity: "0.5", "Exact Font Size": "34" });
    expect(out).toContain("Color 1 0.72 0.24 1");
    expect(out).toContain("Opacity 0.5");
    expect(out).toContain('"Exact Font Size" 34');
  });

  it("applies the same rule to component props: m_s* quoted, enums bare", () => {
    const out = emit({}, [
      { type: "SCR_InputButtonComponent", props: { m_sLabel: "Back", m_sActionName: "MenuBack" } },
      { type: "SCR_TooltipComponent", props: { m_Type: "FOCUS", m_eEvents: "EVENT_CLICKED" } },
    ]);
    expect(out).toContain('m_sLabel "Back"');
    expect(out).toContain('m_sActionName "MenuBack"');
    expect(out).toContain("m_Type FOCUS");
    expect(out).toContain("m_eEvents EVENT_CLICKED");
  });

  it("quotedProps still forces quoting for a field outside the allowlist", () => {
    const out = generateLayoutTree({
      type: "Frame",
      name: "Root",
      children: [
        { type: "Image", name: "W", slot: {}, props: { TAG_Custom: "Value" }, quotedProps: ["TAG_Custom"] },
      ],
    });
    expect(out).toContain('TAG_Custom "Value"');
  });

  it("keeps the output parseable", () => {
    const out = emit({ Text: "SHOP", SizeMode: "Fill", Color: "1 1 1 1" });
    expect(() => parse(out)).not.toThrow();
  });
});
