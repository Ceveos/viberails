import { configSchema } from '@viberails/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { serializeSchema } from './serialize-schema.js';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const outDir = join(root, 'public', 'schema');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'v1.json'), serializeSchema(configSchema));
console.log('Generated public/schema/v1.json');
