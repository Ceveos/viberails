import { describe, expect, it } from 'vitest';
import { generateCursorrules } from './generate-cursorrules.js';

describe('generateCursorrules', () => {
  it('returns context as-is when no user content provided', () => {
    const context = '# my-app\n\n## Architecture\n\nA Next.js app.';

    expect(generateCursorrules(context)).toBe(context);
  });

  it('prepends user content before generated context', () => {
    const context = '# my-app\n\n## Architecture\n\nA Next.js app.';
    const userContent = 'Always use semicolons.\nPrefer const over let.';

    const result = generateCursorrules(context, userContent);

    expect(result).toBe(`${userContent}\n\n${context}`);
    expect(result.indexOf(userContent)).toBe(0);
    expect(result.indexOf(context)).toBeGreaterThan(userContent.length);
  });
});
