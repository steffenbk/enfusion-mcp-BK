import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";
import type { PrefabRecipe, RecipeVariant, RecipeOverrideComponent } from "./recipe.js";
import { loadConfig } from "../config.js";

/**
 * RecipeLoader - Loads, validates, caches, and merges prefab recipes.
 *
 * Recipes are loaded from JSON files in the data/recipes/ directory.
 * The loader lazily reads and caches them, validates against schema,
 * and merges variant overrides on demand.
 */
export class RecipeLoader {
  private cache: Map<string, PrefabRecipe> = new Map();
  private loaded = false;

  /**
   * Get a recipe by ID, optionally applying a variant override.
   * Throws if recipe or variant does not exist.
   */
  getRecipe(id: string, variant?: string): PrefabRecipe {
    this.ensureLoaded();

    const recipe = this.cache.get(id);
    if (!recipe) {
      throw new Error(
        `Recipe not found: ${id}. Use listRecipes() to see available recipes.`
      );
    }

    if (!variant) {
      return structuredClone(recipe);
    }

    // Find the variant and merge its overrides
    const variantDef = recipe.variants?.find((v) => v.name === variant);
    if (!variantDef) {
      throw new Error(
        `Variant not found: ${variant} in recipe ${id}. Available: ${recipe.variants?.map((v) => v.name).join(", ") || "none"}`
      );
    }

    return this.mergeVariant(recipe, variantDef);
  }

  /**
   * List all available recipe IDs and their variants for discovery/help.
   */
  listRecipes(): { id: string; name: string; variants: string[] }[] {
    this.ensureLoaded();
    return Array.from(this.cache.values()).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      variants: recipe.variants?.map((v) => v.name) || [],
    }));
  }

  /**
   * Ensure recipes are loaded and cached.
   */
  private ensureLoaded(): void {
    if (this.loaded) return;

    // Expected recipe file names
    const recipeIds = [
      "firearm",
      "attachment",
      "ground_vehicle",
      "air_vehicle",
      "character",
      "prop",
      "building",
      "item",
      "group",
      "spawnpoint",
      "gamemode",
      "generic",
    ];

    const config = loadConfig();
    const recipesDir = join(config.dataDir, "recipes");

    if (!existsSync(recipesDir)) {
      logger.warn(
        `Recipes directory not found: ${recipesDir}. ` +
          `Check that dataDir is set correctly (currently "${config.dataDir}").`
      );
      this.loaded = true;
      return;
    }

    for (const id of recipeIds) {
      const path = join(recipesDir, `${id}.json`);
      try {
        if (!existsSync(path)) {
          logger.debug(`Recipe file not found: ${path}`);
          continue;
        }

        const raw = readFileSync(path, "utf-8");
        const recipe = JSON.parse(raw) as PrefabRecipe;

        // Validate schema at runtime
        this.validateRecipe(recipe);
        this.cache.set(id, recipe);
        logger.debug(`Loaded recipe: ${id}`);
      } catch (e) {
        const detail =
          e instanceof SyntaxError
            ? `invalid JSON: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        logger.warn(`Failed to load recipe ${id}: ${detail}`);
      }
    }

    this.loaded = true;
  }

  /**
   * Validate that a recipe matches the expected schema.
   */
  private validateRecipe(recipe: PrefabRecipe): void {
    if (!recipe.id || typeof recipe.id !== "string")
      throw new Error("Recipe missing or invalid id");
    if (!recipe.name || typeof recipe.name !== "string")
      throw new Error("Recipe missing or invalid name");
    if (!recipe.description || typeof recipe.description !== "string")
      throw new Error("Recipe missing or invalid description");
    if (!recipe.entityType || typeof recipe.entityType !== "string")
      throw new Error("Recipe missing or invalid entityType");
    if (!recipe.subdirectory || typeof recipe.subdirectory !== "string")
      throw new Error("Recipe missing or invalid subdirectory");
    if (typeof recipe.defaultParent !== "string")
      throw new Error("Recipe missing or invalid defaultParent");
    if (!Array.isArray(recipe.overrideComponents))
      throw new Error("Recipe missing or invalid overrideComponents");
    if (!Array.isArray(recipe.postCreateNotes))
      throw new Error("Recipe missing or invalid postCreateNotes");

    // Validate override components
    for (const comp of recipe.overrideComponents) {
      if (!comp.type || typeof comp.type !== "string")
        throw new Error("Override component missing or invalid type");
      if (comp.properties && typeof comp.properties !== "object")
        throw new Error("Override component properties must be an object");
    }

    // Validate variants if present
    if (recipe.variants) {
      if (!Array.isArray(recipe.variants))
        throw new Error("Variants must be an array");
      for (const variant of recipe.variants) {
        if (!variant.name || typeof variant.name !== "string")
          throw new Error("Variant missing or invalid name");
        if (!variant.description || typeof variant.description !== "string")
          throw new Error("Variant missing or invalid description");
      }
    }
  }

  /**
   * Merge a variant's overrides into the base recipe.
   */
  private mergeVariant(base: PrefabRecipe, variant: RecipeVariant): PrefabRecipe {
    const merged = structuredClone(base);

    if (variant.defaultParent) {
      merged.defaultParent = variant.defaultParent;
    }

    if (variant.subdirectory) {
      merged.subdirectory = variant.subdirectory;
    }

    if (variant.overrideComponents && variant.overrideComponents.length > 0) {
      merged.overrideComponents = variant.overrideComponents;
    }

    if (variant.postCreateNotes && variant.postCreateNotes.length > 0) {
      merged.postCreateNotes = variant.postCreateNotes;
    }

    return merged;
  }
}

// Singleton instance
export const recipeLoader = new RecipeLoader();
