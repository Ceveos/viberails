/**
 * Reusable sub-schema definitions extracted from the main config schema.
 * Keeps the primary schema file under 300 lines.
 */

export const boundarySchema = {
  type: 'object',
  required: ['deny'],
  properties: {
    deny: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
      description:
        'Map of source package/directory to the list of targets it must NOT import from.',
    },
    ignore: {
      type: 'array',
      items: { type: 'string' },
      description:
        'File paths that bypass boundary checks entirely (escape hatch for legitimate exceptions).',
    },
  },
  additionalProperties: false,
} as const;

export const stackSchema = {
  type: 'object',
  properties: {
    framework: { type: 'string', description: 'Primary framework (e.g. "nextjs@15").' },
    language: { type: 'string', description: 'Primary language (e.g. "typescript").' },
    styling: { type: 'string', description: 'Styling solution (e.g. "tailwindcss@4").' },
    backend: { type: 'string', description: 'Backend framework (e.g. "express@5").' },
    orm: { type: 'string', description: 'ORM or database client (e.g. "prisma").' },
    packageManager: { type: 'string', description: 'Package manager (e.g. "pnpm").' },
    linter: { type: 'string', description: 'Linter (e.g. "eslint@9").' },
    formatter: { type: 'string', description: 'Formatter (e.g. "prettier").' },
    testRunner: { type: 'string', description: 'Test runner (e.g. "vitest").' },
  },
  additionalProperties: false,
} as const;

export const structureSchema = {
  type: 'object',
  properties: {
    srcDir: { type: 'string', description: 'Source directory (e.g. "src").' },
    pages: { type: 'string', description: 'Pages or routes directory.' },
    components: { type: 'string', description: 'Components directory.' },
    hooks: { type: 'string', description: 'Hooks directory.' },
    utils: { type: 'string', description: 'Utilities directory.' },
    types: { type: 'string', description: 'Type definitions directory.' },
    tests: { type: 'string', description: 'Tests directory.' },
    testPattern: { type: 'string', description: 'Test file naming pattern (e.g. "*.test.ts").' },
  },
  additionalProperties: false,
} as const;

export const conventionsSchema = {
  type: 'object',
  properties: {
    fileNaming: { type: 'string', description: 'File naming convention (e.g. "kebab-case").' },
    componentNaming: { type: 'string', description: 'Component naming convention.' },
    hookNaming: { type: 'string', description: 'Hook naming convention.' },
    importAlias: { type: 'string', description: 'Import alias pattern (e.g. "@/*").' },
  },
  additionalProperties: false,
} as const;

export const coverageSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'Command to generate coverage summary data for this package.',
    },
    summaryPath: {
      type: 'string',
      description: 'Path to coverage summary JSON relative to package root.',
    },
  },
  additionalProperties: false,
} as const;

export const packageItemSchema = {
  type: 'object',
  required: ['name', 'path'],
  properties: {
    name: { type: 'string', description: 'Package name from package.json.' },
    path: { type: 'string', description: 'Relative path to the package ("." for root).' },
    stack: { ...stackSchema, description: 'Technology stack for this package.' },
    structure: { ...structureSchema, description: 'Directory structure for this package.' },
    conventions: { ...conventionsSchema, description: 'Coding conventions for this package.' },
    coverage: {
      ...coverageSchema,
      description: 'Coverage generation and summary settings for this package.',
    },
    rules: {
      type: 'object',
      properties: {
        maxFileLines: { type: 'number' },
        maxTestFileLines: { type: 'number' },
        testCoverage: { type: 'number' },
        enforceNaming: { type: 'boolean' },
        enforceBoundaries: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    ignore: { type: 'array', items: { type: 'string' } },
    boundaries: {
      type: 'object',
      properties: {
        deny: { type: 'array', items: { type: 'string' } },
        ignore: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export const defaultsSchema = {
  type: 'object',
  properties: {
    stack: { ...stackSchema, description: 'Default stack inherited by all packages.' },
    structure: { ...structureSchema, description: 'Default structure inherited by all packages.' },
    conventions: {
      ...conventionsSchema,
      description: 'Default conventions inherited by all packages.',
    },
    coverage: {
      ...coverageSchema,
      description: 'Default coverage settings inherited by all packages.',
    },
  },
  additionalProperties: false,
  description: 'Shared defaults for all packages. Packages inherit and can override.',
} as const;
