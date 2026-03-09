/**
 * Serialize a JSON schema object to a formatted JSON string.
 * Used by the build script to generate public/schema/v1.json.
 */
export function serializeSchema(schema: Record<string, unknown>): string {
  return JSON.stringify(schema, null, 2) + '\n';
}
