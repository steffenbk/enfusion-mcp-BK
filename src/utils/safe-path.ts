import { resolve, sep } from "node:path";

/**
 * Validate that a user-supplied name is safe for use as a filename.
 * Rejects path traversal, path separators, and OS-reserved characters.
 */
export function validateFilename(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error("Filename must not be empty");
  }

  if (name.includes("..")) {
    throw new Error("Filename must not contain '..'");
  }

  if (/[/\\]/.test(name)) {
    throw new Error("Filename must not contain path separators (/ or \\)");
  }

  // Windows reserved characters: < > : " | ? *
  if (/[<>:"|?*]/.test(name)) {
    throw new Error("Filename contains invalid characters");
  }

  if (RESERVED_DEVICE_NAME.test(name)) {
    throw new Error(`Filename uses reserved name: ${name}`);
  }

  // Windows silently strips trailing dots and spaces, so "foo.et." becomes "foo.et"
  // on disk. Left alone that defeats the existsSync overwrite guard every generator
  // relies on: passing "foo.et." reports no collision and then clobbers "foo.et".
  if (/[. ]$/.test(name)) {
    throw new Error(
      `Filename must not end with a dot or space: "${name}" — Windows silently strips these, which would overwrite a different file than the one named`
    );
  }
}

/** Windows reserved device names, which open a device rather than creating a file. */
const RESERVED_DEVICE_NAME = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i;

/**
 * Validate that a name is a valid Enforce Script identifier.
 * Must start with a letter or underscore, followed by letters, digits, or underscores.
 */
export function validateEnforceIdentifier(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      "Must be a valid Enforce identifier (letters, digits, underscores only, must start with a letter or underscore)"
    );
  }
}

/**
 * Check that resolved is equal to or contained within normalizedBase.
 * Uses trailing separator to prevent prefix collisions (e.g., C:\Proj vs C:\ProjEvil).
 */
function isContained(normalizedBase: string, resolved: string): boolean {
  return resolved === normalizedBase || resolved.startsWith(normalizedBase + sep);
}

/**
 * Validate that a resolved path stays within the base directory.
 * Combines validateFilename + traversal check.
 */
export function safePath(basePath: string, ...segments: string[]): string {
  for (const seg of segments) {
    validateFilename(seg);
  }

  const normalizedBase = resolve(basePath);
  const resolved = resolve(normalizedBase, ...segments);

  if (!isContained(normalizedBase, resolved)) {
    throw new Error("Path traversal not allowed: resolved path is outside project");
  }

  return resolved;
}

/**
 * Validate a relative sub-path (which may contain slashes) stays within the base directory.
 * Used by project_read / project_write / project_browse for user-supplied relative paths.
 */
export function validateProjectPath(basePath: string, subPath: string): string {
  if (subPath.includes("..")) {
    throw new Error("Path traversal not allowed: '..' segments are blocked");
  }

  // Containment alone is not enough: a path can stay inside the project and still
  // not address a file. On Windows "sub/NUL.txt" opens the null device — the write
  // reports success and the data is silently discarded — and a segment ending in a
  // dot or space is normalised to a different name than the caller asked for.
  for (const segment of subPath.split(/[/\\]+/)) {
    if (segment === "" || segment === ".") continue;
    if (RESERVED_DEVICE_NAME.test(segment)) {
      throw new Error(`Path segment uses a reserved device name: "${segment}"`);
    }
    if (/[. ]$/.test(segment)) {
      throw new Error(
        `Path segment must not end with a dot or space: "${segment}" — Windows strips these, so the write would land on a different path than requested`
      );
    }
  }

  const normalizedBase = resolve(basePath);
  const resolved = resolve(normalizedBase, subPath);

  if (!isContained(normalizedBase, resolved)) {
    throw new Error("Path traversal not allowed: resolved path is outside project");
  }

  return resolved;
}
