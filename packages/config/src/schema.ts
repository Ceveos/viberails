/**
 * JSON Schema (draft-07) definition for viberails.config.json.
 *
 * This schema will eventually be hosted at https://viberails.sh/schema/v1.json.
 * For now it is exported as a TypeScript object that can be serialized to JSON.
 */
import { boundarySchema, defaultsSchema, packageItemSchema } from './schema-parts.js';

export const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://viberails.sh/schema/v1.json',
  title: 'viberails configuration',
  description: 'Configuration file for viberails — guardrails for vibe coding.',
  type: 'object',
  required: ['version', 'name', 'packages', 'rules'],
  properties: {
    $schema: {
      type: 'string',
      description: 'JSON Schema URL for editor validation.',
    },
    version: {
      type: 'number',
      const: 1,
      description: 'Config format version. Always 1.',
    },
    name: {
      type: 'string',
      description: 'Project name, typically from package.json.',
    },
    rules: {
      type: 'object',
      required: [
        'maxFileLines',
        'testCoverage',
        'enforceNaming',
        'enforceBoundaries',
        'enforceMissingTests',
      ],
      properties: {
        maxFileLines: {
          type: 'number',
          default: 300,
          description: 'Maximum number of lines allowed per file.',
        },
        maxTestFileLines: {
          type: 'number',
          default: 0,
          description:
            'Maximum number of lines allowed per test file. Set to 0 to exempt test files.',
        },
        testCoverage: {
          type: 'number',
          default: 80,
          description:
            'Minimum line coverage target percentage. 0 disables coverage threshold checks.',
        },
        enforceNaming: {
          type: 'boolean',
          default: true,
          description: 'Whether to enforce detected file naming conventions.',
        },
        enforceBoundaries: {
          type: 'boolean',
          default: false,
          description: 'Whether to enforce module boundary rules.',
        },
        enforceMissingTests: {
          type: 'boolean',
          default: true,
          description: 'Whether to enforce that every source file has a corresponding test file.',
        },
      },
      additionalProperties: false,
      description: 'Rule thresholds and toggles for enforcement.',
    },
    ignore: {
      type: 'array',
      items: { type: 'string' },
      description: 'Project-specific glob patterns to ignore (universal patterns are built-in).',
    },
    boundaries: {
      ...boundarySchema,
      description: 'Module boundary rules for import enforcement.',
    },
    defaults: defaultsSchema,
    packages: {
      type: 'array',
      items: packageItemSchema,
      description: 'Per-package configs. Single projects use path ".".',
    },
    _meta: {
      type: 'object',
      properties: {
        lastSync: { type: 'string', description: 'ISO timestamp of last sync.' },
        packages: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              conventions: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    consistency: { type: 'number' },
                    detected: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      description: 'Scanner metadata. Regenerated on every sync — not user-editable.',
    },
  },
  additionalProperties: false,
} as const;
