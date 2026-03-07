/**
 * JSON Schema (draft-07) definition for viberails.config.json.
 *
 * This schema will eventually be hosted at https://viberails.sh/schema/v1.json.
 * For now it is exported as a TypeScript object that can be serialized to JSON.
 */
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
      items: {
        type: 'object',
        required: ['from', 'to', 'allow'],
        properties: {
          from: {
            type: 'string',
            description: 'Source package or directory pattern.',
          },
          to: {
            type: 'string',
            description: 'Target package or directory pattern.',
          },
          allow: {
            type: 'boolean',
            description: 'Whether this import direction is allowed or disallowed.',
          },
          reason: {
            type: 'string',
            description: 'Human-readable explanation of why this boundary exists.',
          },
        },
        additionalProperties: false,
      },
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
      items: {
        type: 'object',
        required: ['name', 'path'],
        properties: {
          name: { type: 'string', description: 'Package name from package.json.' },
          path: { type: 'string', description: 'Relative path to the package.' },
          stack: {
            type: 'object',
            properties: {
              framework: { type: 'string' },
              language: { type: 'string' },
              styling: { type: 'string' },
              backend: { type: 'string' },
              packageManager: { type: 'string' },
              linter: { type: 'string' },
              formatter: { type: 'string' },
              testRunner: { type: 'string' },
            },
            additionalProperties: false,
          },
          conventions: { $ref: '#/properties/conventions' },
          rules: {
            type: 'object',
            properties: {
              maxFileLines: { type: 'number' },
              maxTestFileLines: { type: 'number' },
              maxFunctionLines: { type: 'number' },
              requireTests: { type: 'boolean' },
              enforceNaming: { type: 'boolean' },
              enforceBoundaries: { type: 'boolean' },
            },
            additionalProperties: false,
          },
          ignore: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
      description: 'Per-package overrides for monorepo projects.',
    },
  },
  additionalProperties: false,
  definitions: {
    conventionValue: {
      description:
        'A convention value — either a plain string (user-confirmed) or an object with scanner metadata.',
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          required: ['value', '_confidence', '_consistency'],
          properties: {
            value: {
              type: 'string',
              description: 'The convention value.',
            },
            _confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Scanner confidence level.',
            },
            _consistency: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Scanner consistency percentage.',
            },
            _detected: {
              type: 'boolean',
              description: 'Set by mergeConfig when a convention is newly detected during sync.',
            },
          },
          additionalProperties: false,
        },
      ],
    },
  },
} as const;
