/**
 * Component dependency validator.
 *
 * Encodes hard, engine-enforced dependency rules between prefab components —
 * confirmed against real base-game prefabs and BI documentation (see
 * arma-knowledge/patterns/Prefabs_And_Components/component-anatomy-and-dependencies.md).
 *
 * This intentionally does NOT attempt to validate implicit string/signal/collider/index
 * coupling (e.g. signal names, collider names, bone PivotIDs) — that requires cross-referencing
 * mesh/skeleton data outside the .et file and is out of scope for static analysis.
 */

export interface ComponentLike {
  typeName: string;
  rawBody?: string;
}

const DAMAGE_MANAGER_RE = /DamageManagerComponent$/;

function hasComponent(components: ComponentLike[], typeName: string): boolean {
  return components.some((c) => c.typeName === typeName);
}

function hasHitZone(components: ComponentLike[]): boolean {
  return components.some(
    (c) => /HitZone/.test(c.typeName) || (c.rawBody !== undefined && /HitZone/.test(c.rawBody))
  );
}

/**
 * Check a flattened set of components (as they would exist on a single entity after
 * ancestry merge) against known hard dependency rules. Returns human-readable warnings;
 * an empty array means no known rule was violated (not a guarantee of correctness).
 */
export function checkComponentDependencies(components: ComponentLike[]): string[] {
  const warnings: string[] = [];

  const damageManagers = components.filter((c) => DAMAGE_MANAGER_RE.test(c.typeName));
  for (const dm of damageManagers) {
    if (!hasComponent(components, "RplComponent")) {
      warnings.push(
        `${dm.typeName} requires RplComponent on the same entity — without it, the engine ` +
        `silently skips adding the DamageManager component at all (no error).`
      );
    }
  }
  if (damageManagers.length > 0 && !hasHitZone(components)) {
    warnings.push(
      `A DamageManager component is present but no HitZone was found — a DamageManager with ` +
      `zero HitZones marked "default" causes the entity to fail to spawn entirely.`
    );
  }

  if (
    hasComponent(components, "SCR_DestructionMultiPhaseComponent") &&
    !hasComponent(components, "RplComponent")
  ) {
    warnings.push(
      `SCR_DestructionMultiPhaseComponent requires RplComponent on the same entity — without ` +
      `it, the engine silently skips adding the destruction component at all (same rule as ` +
      `DamageManager components).`
    );
  }

  if (hasComponent(components, "WeaponComponent") && !hasComponent(components, "RigidBody")) {
    warnings.push(
      `WeaponComponent is present but no RigidBody was found — without one the weapon cannot ` +
      `be picked up in-game. (Not a concern if inheriting from Rifle_Base.et/Handgun_Base.et/etc. ` +
      `— check the ancestry chain, this only fires on the flattened component set.)`
    );
  }

  return warnings;
}
