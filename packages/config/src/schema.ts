/**
 * JSON Schema (draft-07) definition for viberails.config.json.
 *
 * This schema will eventually be hosted at https://viberails.sh/schema/v1.json.
 * For now it is exported as a TypeScript object that can be serialized to JSON.
 */
import { boundaryItemSchema, conventionValueDef, packageItemSchema } from './schema-parts.js';

export const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://viberails.sh/schema/v1.json',
  title: 'viberails configuration',
  description: 'Configuration file for viberails — guardrails for vibe coding.',
  type: 'object',
  required: ['version', 'name', 'stack', 'rules'],
  properties: {
    $schema: {
      type: 'string',
      description: 'JSON Schema URL for editor validation.',
    },
    version: {
      type: 'number',
      const: 1,
      description: 'Config format version. Always 1 for V1.0.',
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
    stack: {
      type: 'object',
      required: ['language', 'packageManager'],
      properties: {
        framework: {
          type: 'string',
          description: 'Primary framework identifier (e.g. "nextjs@15", "remix@2").',
        },
        language: {
          type: 'string',
          description: 'Primary language (e.g. "typescript", "javascript").',
        },
        styling: {
          type: 'string',
          description: 'Styling solution (e.g. "tailwindcss@4", "css-modules").',
        },
        backend: {
          type: 'string',
          description: 'Backend framework (e.g. "express@5", "fastify").',
        },
        orm: {
          type: 'string',
          description: 'ORM or database client (e.g. "prisma", "drizzle", "typeorm").',
        },
        packageManager: {
          type: 'string',
          description: 'Package manager (e.g. "pnpm", "npm", "yarn").',
        },
        linter: {
          type: 'string',
          description: 'Linter (e.g. "eslint@9", "biome").',
        },
        formatter: {
          type: 'string',
          description: 'Formatter (e.g. "prettier", "biome").',
        },
        testRunner: {
          type: 'string',
          description: 'Test runner (e.g. "vitest", "jest").',
        },
      },
      additionalProperties: false,
      description: 'Detected or configured technology stack.',
    },
    structure: {
      type: 'object',
      properties: {
        srcDir: {
          type: 'string',
          description: 'Source directory (e.g. "src"), or omit for flat structure.',
        },
        pages: {
          type: 'string',
          description: 'Pages or routes directory (e.g. "src/app").',
        },
        components: {
          type: 'string',
          description: 'Components directory (e.g. "src/components").',
        },
        hooks: {
          type: 'string',
          description: 'Hooks directory (e.g. "src/hooks").',
        },
        utils: {
          type: 'string',
          description: 'Utilities directory (e.g. "src/utils", "src/lib").',
        },
        types: {
          type: 'string',
          description: 'Type definitions directory (e.g. "src/types").',
        },
        tests: {
          type: 'string',
          description: 'Tests directory (e.g. "tests", "__tests__").',
        },
        testPattern: {
          type: 'string',
          description: 'Test file naming pattern (e.g. "*.test.ts", "*.spec.ts").',
        },
      },
      additionalProperties: false,
      description: 'Detected or configured directory structure.',
    },
    conventions: {
      type: 'object',
      properties: {
        fileNaming: { $ref: '#/definitions/conventionValue' },
        componentNaming: { $ref: '#/definitions/conventionValue' },
        hookNaming: { $ref: '#/definitions/conventionValue' },
        importAlias: { $ref: '#/definitions/conventionValue' },
      },
      additionalProperties: false,
      description: 'Detected or configured coding conventions.',
    },
    rules: {
      type: 'object',
      required: [
        'maxFileLines',
        'maxFunctionLines',
        'requireTests',
        'enforceNaming',
        'enforceBoundaries',
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
            'Maximum number of lines allowed per test file. Set to 0 to exempt test files from size checks.',
        },
        maxFunctionLines: {
          type: 'number',
          default: 50,
          description: 'Maximum number of lines allowed per function.',
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
      description: 'Glob patterns for files and directories to ignore.',
    },
    boundaries: {
      type: 'array',
      items: boundaryItemSchema,
      description: 'Module boundary rules for import enforcement.',
    },
    workspace: {
      type: 'object',
      required: ['packages', 'isMonorepo'],
      properties: {
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Relative paths to workspace packages.',
        },
        isMonorepo: {
          type: 'boolean',
          description: 'Whether this project is a monorepo with multiple packages.',
        },
      },
      additionalProperties: false,
      description: 'Workspace configuration for monorepo projects.',
    },
    packages: {
      type: 'array',
      items: packageItemSchema,
      description: 'Per-package overrides for monorepo projects.',
    },
  },
  additionalProperties: false,
  definitions: {
    conventionValue: conventionValueDef,
  },
} as const;
