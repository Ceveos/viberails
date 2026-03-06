import type {
  ConfigConventions,
  ConfigRules,
  ConfigStack,
  ConventionValue,
  DirectoryInfo,
  ScanResult,
  ViberailsConfig,
} from '@viberails/types';

/** Display names for framework identifiers. */
const FRAMEWORK_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  remix: 'Remix',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  vite: 'Vite',
  gatsby: 'Gatsby',
  express: 'Express',
  fastify: 'Fastify',
};

/** Display names for library identifiers. */
const LIBRARY_NAMES: Record<string, string> = {
  'react-query': 'React Query',
  'tanstack-query': 'TanStack Query',
  tailwindcss: 'Tailwind CSS',
  'css-modules': 'CSS Modules',
  'styled-components': 'styled-components',
  zod: 'Zod',
  trpc: 'tRPC',
  prisma: 'Prisma',
  drizzle: 'Drizzle',
};

/** Display names for directory roles. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  pages: 'Pages / Routes',
  components: 'Components',
  hooks: 'Hooks',
  utils: 'Utilities',
  types: 'Type definitions',
  tests: 'Tests',
  styles: 'Styles',
  api: 'API routes',
  config: 'Configuration',
};

/**
 * Format a stack identifier to a human-readable display name.
 * Parses `"name@version"` format and looks up display names.
 */
function displayName(identifier: string): { name: string; version?: string } {
  const atIndex = identifier.indexOf('@');
  if (atIndex > 0) {
    const rawName = identifier.slice(0, atIndex);
    const version = identifier.slice(atIndex + 1);
    return {
      name: FRAMEWORK_NAMES[rawName] ?? LIBRARY_NAMES[rawName] ?? rawName,
      version,
    };
  }
  return {
    name:
      FRAMEWORK_NAMES[identifier] ?? LIBRARY_NAMES[identifier] ?? identifier,
  };
}

/**
 * Format a display name with optional version.
 */
function formatWithVersion(identifier: string): string {
  const { name, version } = displayName(identifier);
  return version ? `${name} ${version}` : name;
}

/**
 * Build a natural language description of the project's technology stack.
 */
function formatStackDescription(
  config: ViberailsConfig,
  scanResult: ScanResult,
): string {
  const { stack } = config;
  const parts: string[] = [];

  // Opening sentence: framework + language + styling
  if (stack.framework) {
    const fw = formatWithVersion(stack.framework);
    const lang = formatWithVersion(stack.language);

    // Detect App Router for Next.js
    let routerNote = '';
    if (
      displayName(stack.framework).name === 'Next.js' &&
      scanResult.structure.directories.some(
        (d) => d.role === 'pages' && d.path.includes('app'),
      )
    ) {
      routerNote = ' using the App Router';
    }

    let sentence = `This is a ${fw} application${routerNote} written in ${lang}`;
    if (stack.styling) {
      sentence += ` with ${formatWithVersion(stack.styling)} for styling`;
    }
    sentence += '.';
    parts.push(sentence);
  } else {
    let sentence = `This is a ${formatWithVersion(stack.language)} project`;
    if (stack.styling) {
      sentence += ` with ${formatWithVersion(stack.styling)} for styling`;
    }
    sentence += '.';
    parts.push(sentence);
  }

  // Backend
  if (stack.backend) {
    parts.push(
      `The backend uses ${formatWithVersion(stack.backend)}.`,
    );
  }

  // Notable libraries
  if (scanResult.stack.libraries.length > 0) {
    const libNames = scanResult.stack.libraries.map((lib) => {
      const display =
        LIBRARY_NAMES[lib.name] ?? FRAMEWORK_NAMES[lib.name] ?? lib.name;
      return lib.version ? `${display} ${lib.version}` : display;
    });
    parts.push(`Notable libraries: ${libNames.join(', ')}.`);
  }

  // Tooling sentence
  const tooling: string[] = [];
  tooling.push(`${formatWithVersion(stack.packageManager)} for package management`);
  if (stack.linter) {
    tooling.push(`${formatWithVersion(stack.linter)} for linting`);
  }
  if (stack.testRunner) {
    tooling.push(`${formatWithVersion(stack.testRunner)} for testing`);
  }
  if (tooling.length > 0) {
    parts.push(`Uses ${tooling.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Build a markdown table of the project's directory structure.
 */
function formatDirectoryTable(directories: DirectoryInfo[]): string {
  const meaningful = directories.filter((d) => d.role !== 'unknown');
  if (meaningful.length === 0) return '';

  const lines: string[] = [
    '| Directory | Purpose | Files |',
    '|-----------|---------|-------|',
  ];

  for (const dir of meaningful) {
    const desc = ROLE_DESCRIPTIONS[dir.role] ?? dir.role;
    lines.push(`| \`${dir.path}\` | ${desc} | ${dir.fileCount} |`);
  }

  return lines.join('\n');
}

/**
 * Extract the effective value from a ConventionValue (string or object).
 */
function conventionValue(cv: ConventionValue): string {
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Check if a ConventionValue is high confidence.
 */
function isHighConfidence(cv: ConventionValue): boolean {
  return typeof cv === 'object' && cv._confidence === 'high';
}

/**
 * Build convention directives from config.
 */
function formatConventions(config: ViberailsConfig): string {
  const lines: string[] = [];
  const { conventions, structure } = config;

  const conventionEntries: { key: keyof ConfigConventions; label: string }[] = [
    { key: 'fileNaming', label: 'file naming' },
    { key: 'componentNaming', label: 'component naming' },
    { key: 'hookNaming', label: 'hook naming' },
  ];

  for (const { key, label } of conventionEntries) {
    const cv = conventions[key];
    if (!cv) continue;
    const val = conventionValue(cv);
    if (isHighConfidence(cv)) {
      lines.push(`- Files use **${val}** ${label}.`);
    } else {
      lines.push(`- Most files appear to use **${val}** ${label}.`);
    }
  }

  if (conventions.importAlias) {
    const alias = conventionValue(conventions.importAlias);
    const srcDir = structure.srcDir ?? 'src';
    lines.push(`- Use \`${alias}\` as the import alias for \`${srcDir}/\`.`);
  }

  if (structure.testPattern) {
    lines.push(
      `- Tests follow the \`${structure.testPattern}\` pattern.`,
    );
  }

  return lines.join('\n');
}

/**
 * Build quality standard instructions from config rules.
 */
function formatRules(rules: ConfigRules): string {
  const lines: string[] = [];

  lines.push(
    `- Keep files under **${rules.maxFileLines} lines**. Break up large files into focused modules.`,
  );
  lines.push(
    `- Keep functions under **${rules.maxFunctionLines} lines**. Extract helpers for complex logic.`,
  );

  if (rules.requireTests) {
    lines.push(
      '- All public functions should have corresponding tests.',
    );
  }

  if (rules.enforceNaming) {
    lines.push('- Follow the naming conventions described above.');
  }

  return lines.join('\n');
}

/**
 * Build codebase health notes from scan statistics.
 */
function formatCodebaseNotes(scanResult: ScanResult, rules: ConfigRules): string {
  const lines: string[] = [];
  const { statistics, structure } = scanResult;

  // Large files
  const oversized = statistics.largestFiles.filter(
    (f) => f.lines > rules.maxFileLines,
  );
  if (oversized.length > 0) {
    lines.push('**Refactoring candidates** (files exceeding the line limit):');
    for (const f of oversized) {
      lines.push(`- \`${f.path}\` — ${f.lines} lines`);
    }
  }

  // Large directories
  const largeDirs = structure.directories.filter(
    (d) => d.role !== 'unknown' && d.fileCount >= 30,
  );
  if (largeDirs.length > 0) {
    for (const d of largeDirs) {
      lines.push(
        `- \`${d.path}\` has ${d.fileCount} files — consider organizing into subdirectories.`,
      );
    }
  }

  // Summary
  lines.push(
    `\nThe codebase has ${statistics.totalFiles} files totaling ${statistics.totalLines.toLocaleString()} lines of code.`,
  );

  return lines.join('\n');
}

/**
 * Generate AI context markdown from a ViberailsConfig and ScanResult.
 *
 * The output is a natural language document designed to be consumed by AI tools
 * (e.g., as a CLAUDE.md or .cursorrules file). It describes the project's stack,
 * structure, conventions, and quality standards.
 *
 * @param config - The viberails configuration (generated or user-edited)
 * @param scanResult - The raw scan result for statistics and structure details
 * @returns Markdown string suitable for AI context files
 */
export function generateContext(
  config: ViberailsConfig,
  scanResult: ScanResult,
): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${config.name}\n`);

  // Architecture
  sections.push('## Architecture\n');
  sections.push(formatStackDescription(config, scanResult));
  sections.push('');

  const dirTable = formatDirectoryTable(scanResult.structure.directories);
  if (dirTable) {
    sections.push('### Project Structure\n');
    sections.push(dirTable);
    sections.push('');
  }

  // Conventions
  const conventionText = formatConventions(config);
  if (conventionText) {
    sections.push('## Conventions\n');
    sections.push(conventionText);
    sections.push('');
  }

  // Quality Standards
  sections.push('## Quality Standards\n');
  sections.push(formatRules(config.rules));
  sections.push('');

  // Codebase Notes
  sections.push('## Current Codebase Notes\n');
  sections.push(formatCodebaseNotes(scanResult, config.rules));

  return sections.join('\n');
}
