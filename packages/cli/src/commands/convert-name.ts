/**
 * Split a bare filename into its constituent words.
 *
 * Handles kebab-case, camelCase, PascalCase, and snake_case inputs.
 * Consecutive uppercase letters (acronyms like "URL") are kept together.
 */
export function splitIntoWords(name: string): string[] {
  // First, split on explicit separators (hyphens and underscores)
  const parts = name.split(/[-_]/);

  const words: string[] = [];
  for (const part of parts) {
    if (part === '') continue;

    // Split camelCase and PascalCase boundaries
    // "UserProfile" → ["User", "Profile"]
    // "parseJSON" → ["parse", "JSON"]
    // "XMLParser" → ["XML", "Parser"]
    let current = '';
    for (let i = 0; i < part.length; i++) {
      const ch = part[i];
      const isUpper = ch >= 'A' && ch <= 'Z';

      if (isUpper && current.length > 0) {
        const prevIsUpper =
          current[current.length - 1] >= 'A' && current[current.length - 1] <= 'Z';
        const nextIsLower = i + 1 < part.length && part[i + 1] >= 'a' && part[i + 1] <= 'z';

        if (!prevIsUpper || nextIsLower) {
          words.push(current.toLowerCase());
          current = '';
        }
      }
      current += ch;
    }
    if (current) words.push(current.toLowerCase());
  }

  return words;
}

/**
 * Convert a bare filename to the specified naming convention.
 *
 * @param bare - The bare filename without extension (e.g. "UserProfile")
 * @param target - The target convention (kebab-case, camelCase, PascalCase, snake_case)
 * @returns The converted name
 */
export function convertName(bare: string, target: string): string {
  const words = splitIntoWords(bare);
  if (words.length === 0) return bare;

  switch (target) {
    case 'kebab-case':
      return words.join('-');
    case 'camelCase':
      return words[0] + words.slice(1).map(capitalize).join('');
    case 'PascalCase':
      return words.map(capitalize).join('');
    case 'snake_case':
      return words.join('_');
    default:
      return bare;
  }
}

function capitalize(word: string): string {
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1);
}
