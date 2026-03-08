declare const __PACKAGE_VERSION__: string;
export const VERSION: string = __PACKAGE_VERSION__;

export { compactConfig, expandDefaults } from './compact-config.js';
export { BUILTIN_IGNORE, DEFAULT_IGNORE, DEFAULT_RULES } from './defaults.js';
export { generateConfig } from './generate-config.js';
export { inferCoverageCommand } from './infer-coverage-command.js';
export { loadConfig, loadConfigSafe } from './load-config.js';
export { mergeConfig } from './merge-config.js';
export { configSchema } from './schema.js';
