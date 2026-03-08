/**
 * JSON Schema (draft-07) definition for viberails.config.json V2.
 *
 * This schema will eventually be hosted at https://viberails.sh/schema/v2.json.
 * For now it is exported as a TypeScript object that can be serialized to JSON.
 */
import { boundarySchema, defaultsSchema, packageItemSchema } from './schema-parts.js';

export const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://viberails.sh/schema/v2.json',
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
      const: 2,
      description: 'Config format version. Always 2.',
    },
    name: {
      type: 'string',
      description: 'Project name, typically from package.json.',
    },
    enforcement: {
      type: 'string',
      enum: ['warn', 'enforce'],
      default: 'warn',
      description: 'Whether conventions are warned about or enforced as errors.',
    },
    rules: {
      type: 'object',
      required: ['maxFileLines', 'requireTests', 'enforceNaming', 'enforceBoundaries'],
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
        requireTests: {
          type: 'boolean',
          default: true,
          description: 'Whether to require test files for source modules.',
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
