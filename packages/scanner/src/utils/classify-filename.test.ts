import { describe, expect, it } from 'vitest';
import { classifyFilename } from './classify-filename.js';

describe('classifyFilename', () => {
  describe('kebab-case', () => {
    it('classifies user-profile as kebab-case', () => {
      expect(classifyFilename('user-profile')).toBe('kebab-case');
    });

    it('classifies use-auth as kebab-case', () => {
      expect(classifyFilename('use-auth')).toBe('kebab-case');
    });

    it('classifies my-component-v2 as kebab-case', () => {
      expect(classifyFilename('my-component-v2')).toBe('kebab-case');
    });
  });

  describe('camelCase', () => {
    it('classifies userProfile as camelCase', () => {
      expect(classifyFilename('userProfile')).toBe('camelCase');
    });

    it('classifies useAuth as camelCase', () => {
      expect(classifyFilename('useAuth')).toBe('camelCase');
    });

    it('classifies myComponentV2 as camelCase', () => {
      expect(classifyFilename('myComponentV2')).toBe('camelCase');
    });
  });

  describe('PascalCase', () => {
    it('classifies UserProfile as PascalCase', () => {
      expect(classifyFilename('UserProfile')).toBe('PascalCase');
    });

    it('classifies Button as PascalCase', () => {
      expect(classifyFilename('Button')).toBe('PascalCase');
    });

    it('classifies API as PascalCase', () => {
      expect(classifyFilename('API')).toBe('PascalCase');
    });

    it('classifies HTTPClient as PascalCase', () => {
      expect(classifyFilename('HTTPClient')).toBe('PascalCase');
    });
  });

  describe('snake_case', () => {
    it('classifies user_profile as snake_case', () => {
      expect(classifyFilename('user_profile')).toBe('snake_case');
    });
  });

  describe('unknown (ambiguous)', () => {
    it('classifies utils as unknown', () => {
      expect(classifyFilename('utils')).toBe('unknown');
    });

    it('classifies index as unknown', () => {
      expect(classifyFilename('index')).toBe('unknown');
    });

    it('classifies app as unknown', () => {
      expect(classifyFilename('app')).toBe('unknown');
    });
  });
});
