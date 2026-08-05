import { describe, it, expect } from "vitest";
import { checkComponentDependencies, type ComponentLike } from "../../src/utils/component-dependencies.js";

describe("checkComponentDependencies", () => {
  it("returns no warnings for an empty component list", () => {
    expect(checkComponentDependencies([])).toEqual([]);
  });

  it("returns no warnings when DamageManager has RplComponent and a HitZone", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_CharacterDamageManagerComponent", rawBody: "HitZones { HitZone_Default {} }" },
      { typeName: "RplComponent" },
    ];
    expect(checkComponentDependencies(components)).toEqual([]);
  });

  it("warns when a DamageManager component has no RplComponent", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_WheeledDamageManagerComponent", rawBody: "HitZones { HitZone_Default {} }" },
    ];
    const warnings = checkComponentDependencies(components);
    expect(warnings.some((w) => w.includes("RplComponent"))).toBe(true);
  });

  it("warns when a DamageManager component has no HitZone anywhere in the component set", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_HelicopterDamageManagerComponent" },
      { typeName: "RplComponent" },
    ];
    const warnings = checkComponentDependencies(components);
    expect(warnings.some((w) => w.includes("HitZone"))).toBe(true);
  });

  it("detects HitZone via typeName as well as rawBody", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_CharacterDamageManagerComponent" },
      { typeName: "RplComponent" },
      { typeName: "SCR_RotorHitZone" },
    ];
    expect(checkComponentDependencies(components)).toEqual([]);
  });

  it("does not flag components that merely end in similar names", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_NotADamageManagerThing" },
    ];
    expect(checkComponentDependencies(components)).toEqual([]);
  });

  it("warns when WeaponComponent has no RigidBody", () => {
    const components: ComponentLike[] = [{ typeName: "WeaponComponent" }];
    const warnings = checkComponentDependencies(components);
    expect(warnings.some((w) => w.includes("RigidBody"))).toBe(true);
  });

  it("does not warn about WeaponComponent when RigidBody is present", () => {
    const components: ComponentLike[] = [
      { typeName: "WeaponComponent" },
      { typeName: "RigidBody" },
    ];
    expect(checkComponentDependencies(components)).toEqual([]);
  });

  it("warns when SCR_DestructionMultiPhaseComponent has no RplComponent", () => {
    const components: ComponentLike[] = [{ typeName: "SCR_DestructionMultiPhaseComponent" }];
    const warnings = checkComponentDependencies(components);
    expect(warnings.some((w) => w.includes("SCR_DestructionMultiPhaseComponent") && w.includes("RplComponent"))).toBe(true);
  });

  it("does not warn about SCR_DestructionMultiPhaseComponent when RplComponent is present", () => {
    const components: ComponentLike[] = [
      { typeName: "SCR_DestructionMultiPhaseComponent" },
      { typeName: "RplComponent" },
    ];
    expect(checkComponentDependencies(components)).toEqual([]);
  });

  it("can report multiple independent warnings at once", () => {
    const components: ComponentLike[] = [
      { typeName: "WeaponComponent" },
      { typeName: "SCR_CharacterDamageManagerComponent" },
    ];
    const warnings = checkComponentDependencies(components);
    expect(warnings.length).toBe(3); // no RigidBody, no RplComponent, no HitZone
  });
});
