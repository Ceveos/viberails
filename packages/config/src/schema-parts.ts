/**
 * Reusable sub-schema definitions extracted from the main config schema.
 * Keeps the primary schema file under 300 lines.
 */

export const conventionValueDef = {
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
} as const;

export const boundaryItemSchema = {
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
} as const;

export const packageItemSchema = {
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
        orm: { type: 'string' },
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
} as const;
