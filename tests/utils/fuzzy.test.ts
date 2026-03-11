import { describe, it, expect } from "vitest";
import { levenshtein, trigramSimilarity } from "../../src/utils/fuzzy.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("returns string length for empty comparison", () => {
    expect(levenshtein("hello", "")).toBe(5);
    expect(levenshtein("", "hello")).toBe(5);
  });

  it("returns 1 for single character substitution", () => {
    expect(levenshtein("cat", "car")).toBe(1);
  });

  it("returns 1 for single character insertion", () => {
    expect(levenshtein("cat", "cart")).toBe(1);
  });

  it("returns 1 for single character deletion", () => {
    expect(levenshtein("cart", "cat")).toBe(1);
  });

  it("handles common typos", () => {
    expect(levenshtein("scriptcompnent", "scriptcomponent")).toBe(1);
    expect(levenshtein("getpositon", "getposition")).toBe(1);
  });

  it("caps at MAX_DISTANCE for very different strings", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });
});

describe("trigramSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(trigramSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(trigramSimilarity("abc", "xyz")).toBe(0);
  });

  it("returns high similarity for similar strings", () => {
    const sim = trigramSimilarity("scriptcomponent", "scriptcompnent");
    expect(sim).toBeGreaterThan(0.7);
  });

  it("returns moderate similarity for related terms", () => {
    const sim = trigramSimilarity("damage", "damagemanager");
    expect(sim).toBeGreaterThan(0.3);
  });

  it("handles short strings", () => {
    expect(trigramSimilarity("ab", "ab")).toBe(1);
    expect(trigramSimilarity("a", "b")).toBe(0);
  });
});
