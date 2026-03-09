import { parentPort, workerData } from 'node:worker_threads';
import type { GraphOptions } from './build-graph.js';
import { buildImportGraphSync } from './build-graph.js';

const { projectRoot, options } = workerData as {
  projectRoot: string;
  options?: GraphOptions;
};

const result = buildImportGraphSync(projectRoot, options);
parentPort?.postMessage(result);
