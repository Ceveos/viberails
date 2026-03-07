import { describe, expect, it } from 'vitest';
import { convertName, splitIntoWords } from './convert-name.js';

describe('splitIntoWords', () => {
  it('splits kebab-case', () => {
    expect(splitIntoWords('user-profile')).toEqual(['user', 'profile']);
  });

  it('splits camelCase', () => {
    expect(splitIntoWords('userProfile')).toEqual(['user', 'profile']);
  });

  it('splits PascalCase', () => {
    expect(splitIntoWords('UserProfile')).toEqual(['user', 'profile']);
  });

  it('splits snake_case', () => {
    expect(splitIntoWords('user_profile')).toEqual(['user', 'profile']);
  });

  it('handles acronyms', () => {
    expect(splitIntoWords('parseJSON')).toEqual(['parse', 'json']);
    expect(splitIntoWords('XMLParser')).toEqual(['xml', 'parser']);
    expect(splitIntoWords('getHTTPSUrl')).toEqual(['get', 'https', 'url']);
  });

  it('handles single word', () => {
    expect(splitIntoWords('button')).toEqual(['button']);
    expect(splitIntoWords('Button')).toEqual(['button']);
  });

  it('handles numbers', () => {
    expect(splitIntoWords('auth2factor')).toEqual(['auth2factor']);
    expect(splitIntoWords('my-app-2')).toEqual(['my', 'app', '2']);
  });

  it('handles empty string', () => {
    expect(splitIntoWords('')).toEqual([]);
  });
});

describe('convertName', () => {
  it('converts to kebab-case', () => {
    expect(convertName('UserProfile', 'kebab-case')).toBe('user-profile');
    expect(convertName('userProfile', 'kebab-case')).toBe('user-profile');
    expect(convertName('user_profile', 'kebab-case')).toBe('user-profile');
  });

  it('converts to camelCase', () => {
    expect(convertName('user-profile', 'camelCase')).toBe('userProfile');
    expect(convertName('UserProfile', 'camelCase')).toBe('userProfile');
    expect(convertName('user_profile', 'camelCase')).toBe('userProfile');
  });

  it('converts to PascalCase', () => {
    expect(convertName('user-profile', 'PascalCase')).toBe('UserProfile');
    expect(convertName('userProfile', 'PascalCase')).toBe('UserProfile');
    expect(convertName('user_profile', 'PascalCase')).toBe('UserProfile');
  });

  it('converts to snake_case', () => {
    expect(convertName('UserProfile', 'snake_case')).toBe('user_profile');
    expect(convertName('user-profile', 'snake_case')).toBe('user_profile');
    expect(convertName('userProfile', 'snake_case')).toBe('user_profile');
  });

  it('handles single-word names', () => {
    expect(convertName('Button', 'kebab-case')).toBe('button');
    expect(convertName('button', 'PascalCase')).toBe('Button');
  });

  it('returns bare name for unknown convention', () => {
    expect(convertName('UserProfile', 'unknown')).toBe('UserProfile');
  });
});
