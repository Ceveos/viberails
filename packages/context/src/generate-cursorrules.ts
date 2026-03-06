/**
 * Generate a .cursorrules file from generated context and optional user content.
 *
 * If the user has existing .cursorrules content, it is placed first, followed
 * by the generated context. Otherwise, the generated context is returned as-is.
 *
 * @param context - The generated AI context markdown
 * @param userCursorrules - Optional existing .cursorrules content from the user
 * @returns The combined .cursorrules content
 */
export function generateCursorrules(
  context: string,
  userCursorrules?: string,
): string {
  if (userCursorrules) {
    return `${userCursorrules}\n\n${context}`;
  }
  return context;
}
