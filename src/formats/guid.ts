import { randomBytes } from "node:crypto";

/**
 * Generate a 16-character uppercase hex GUID matching Enfusion's format.
 * Example: "6156F2F771D5D73D"
 */
export function generateGuid(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}
