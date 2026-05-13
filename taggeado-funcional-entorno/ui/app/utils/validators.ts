/**
 * Validates a Dynatrace entity ID format to prevent DQL injection.
 * Valid format: TYPE-HEXID (e.g., HOST-1234ABCD5678EF90)
 */
const ENTITY_ID_REGEX = /^[A-Z_]+-[A-F0-9]{16}$/i;

export function validateEntityId(entityId: string): boolean {
  return ENTITY_ID_REGEX.test(entityId);
}

/**
 * Sanitizes a search term for safe use in DQL contains() expressions.
 * Removes characters that could break DQL string literals.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/["\\\n\r\t]/g, "").trim();
}
