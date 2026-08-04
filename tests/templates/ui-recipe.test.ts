import { describe, it, expect } from "vitest";
import { renderRecipe, type UILayoutRecipe } from "../../src/templates/ui-recipe.js";
import { uiRecipeLoader } from "../../src/templates/ui-recipe-loader.js";
import { generateLayoutTree } from "../../src/templates/layout.js";
import { parse } from "../../src/formats/enfusion-text.js";

const sample: UILayoutRecipe = {
  id: "sample",
  name: "Sample",
  description: "test",
  category: "hud",
  subdirectory: "UI/layouts/HUD",
  params: [
    { name: "text", description: "t", default: "Default" },
    { name: "size", description: "s", default: "20" },
  ],
  tree: {
    type: "Frame",
    name: "rootFrame",
    children: [
      {
        type: "RichText",
        name: "{{unnamed}}Label",
        slot: { anchor: "0.5 0 0.5 0" },
        props: { Text: "{{text}}", "Font Size": "{{size}}" },
        font: { font: "{{fontRef}}" },
      },
    ],
  },
  postCreateNotes: ["do X"],
};

describe("renderRecipe", () => {
  it("substitutes provided params over defaults", () => {
    const r = renderRecipe(sample, { text: "Hello", fontRef: "{ABC}x.fnt" });
    const child = r.tree.children![0];
    expect(child.props!.Text).toBe("Hello");
    expect(child.props!["Font Size"]).toBe("20"); // default
    expect(child.font!.font).toBe("{ABC}x.fnt");
  });

  it("reports unresolved tokens and leaves them literal", () => {
    const r = renderRecipe(sample, { text: "Hi" });
    expect(r.unresolved).toContain("unnamed");
    expect(r.unresolved).toContain("fontRef");
    expect(r.tree.children![0].name).toBe("{{unnamed}}Label");
  });

  it("does not mutate the source recipe", () => {
    const before = JSON.stringify(sample);
    renderRecipe(sample, { text: "X", unnamed: "Y", fontRef: "Z" });
    expect(JSON.stringify(sample)).toBe(before);
  });

  it("carries subdirectory and postCreateNotes through", () => {
    const r = renderRecipe(sample, {});
    expect(r.subdirectory).toBe("UI/layouts/HUD");
    expect(r.postCreateNotes).toEqual(["do X"]);
  });

  it("renders into a parseable layout", () => {
    const r = renderRecipe(sample, { text: "Hi", unnamed: "My", fontRef: "{ABC}x.fnt" });
    const out = generateLayoutTree(r.tree);
    expect(out).toContain('Name "MyLabel"');
    // Text is a string field, so it is quoted even for a bare-looking value.
    expect(out).toContain('Text "Hi"');
    expect(() => parse(out)).not.toThrow();
  });
});

describe("uiRecipeLoader (shipped recipes)", () => {
  const EXPECTED = ["status_hud", "timer_hud", "icon_overlay", "progress_hud", "info_panel"];

  it("loads every shipped recipe", () => {
    const ids = uiRecipeLoader.listRecipes().map((r) => r.id);
    for (const id of EXPECTED) {
      expect(ids).toContain(id);
    }
  });

  it("each shipped recipe renders (with defaults) into a parseable layout", () => {
    for (const id of EXPECTED) {
      const recipe = uiRecipeLoader.getRecipe(id);
      const rendered = renderRecipe(recipe, {});
      const out = generateLayoutTree(rendered.tree);
      expect(out, `${id} should start with a root frame`).toContain("FrameWidgetClass {");
      expect(() => parse(out), `${id} should parse`).not.toThrow();
      // Defaults resolve all declared params -> no unresolved tokens.
      expect(rendered.unresolved, `${id} has unresolved tokens`).toEqual([]);
    }
  });

  it("throws a helpful error for an unknown recipe", () => {
    expect(() => uiRecipeLoader.getRecipe("nope")).toThrow(/not found/);
  });
});
