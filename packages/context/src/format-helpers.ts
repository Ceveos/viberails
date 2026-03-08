import type { ConventionValue, PackageConfigOverrides, ViberailsConfig } from '@viberails/types';

/** Naming convention examples for directive formatting. */
export const NAMING_EXAMPLES: Record<string, string> = {
  'kebab-case': '`user-profile.ts`, not `UserProfile.ts`',
  camelCase: '`userProfile.ts`, not `user-profile.ts`',
  PascalCase: '`UserProfile.ts`, not `user-profile.ts`',
  snake_case: '`user_profile.ts`, not `UserProfile.ts`',
};

/**
 * Extract the effective value from a ConventionValue (string or object).
 */
export function conventionValue(cv: ConventionValue): string {
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Build the "Development setup" section describing the project's
 * formatter and linter, with guidance on enabling format-on-save.
 */
export function formatDevelopmentSetup(config: ViberailsConfig): string[] {
  const { linter, formatter } = config.stack;
  if (!linter && !formatter) return [];

  const lines: string[] = [];
  lines.push('## Development setup\n');

  const toolName = (id: string): string => {
    const name = id.split('@')[0];
    if (name === 'biome') return 'Biome';
    if (name === 'prettier') return 'Prettier';
    if (name === 'eslint') return 'ESLint';
    return name;
  };

  if (formatter && linter) {
    const fmt = toolName(formatter);
    const lint = toolName(linter);
    if (fmt === lint) {
      lines.push(`This project uses **${fmt}** for formatting and linting.\n`);
    } else {
      lines.push(`This project uses **${fmt}** for formatting and **${lint}** for linting.\n`);
    }
  } else if (formatter) {
    lines.push(`This project uses **${toolName(formatter)}** for formatting.\n`);
  } else if (linter) {
    lines.push(`This project uses **${toolName(linter)}** for linting.\n`);
  }

  lines.push('- Enable format-on-save in your editor to avoid lint failures on commit.');

  if (formatter) {
    const fmt = toolName(formatter);
    if (fmt === 'Biome') {
      lines.push(
        '- If using VS Code, install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) and enable format-on-save.',
      );
    } else if (fmt === 'Prettier') {
      lines.push(
        '- If using VS Code, install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and enable format-on-save.',
      );
    }
  }

  return lines;
}

/**
 * Build the header for a package override section.
 */
export function packageHeader(pkg: PackageConfigOverrides): string {
  const framework = pkg.stack?.framework;
  if (framework) {
    const name = typeof framework === 'string' ? framework.split('@')[0] : framework;
    return `### ${pkg.path} (${name})`;
  }
  return `### ${pkg.path}`;
}

/**
 * Build the per-package overrides section as markdown lines.
 */
export function formatPackageOverrides(config: ViberailsConfig): string[] {
  if (!config.packages || config.packages.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Per-package rules\n');
  lines.push('The following packages have rules that differ from the global defaults:\n');

  for (const pkg of config.packages) {
    const pkgLines: string[] = [];

    if (pkg.conventions?.fileNaming) {
      const val = conventionValue(pkg.conventions.fileNaming);
      const examples = NAMING_EXAMPLES[val] ?? `e.g. \`my-module.ts\``;
      pkgLines.push(`- Source files use **${val}**: ${examples}.`);
    }

    if (pkg.conventions?.componentNaming) {
      const val = conventionValue(pkg.conventions.componentNaming);
      pkgLines.push(`- Components use **${val}** naming.`);
    }

    if (pkg.conventions?.hookNaming) {
      const val = conventionValue(pkg.conventions.hookNaming);
      pkgLines.push(`- Hooks use **${val}** naming.`);
    }

    if (pkg.conventions?.importAlias) {
      const val = conventionValue(pkg.conventions.importAlias);
      pkgLines.push(`- Import alias: \`${val}\`.`);
    }

    if (pkg.rules?.maxFileLines !== undefined && pkg.rules.maxFileLines > 0) {
      pkgLines.push(
        `- Files must not exceed **${pkg.rules.maxFileLines} lines**. Split into focused modules.`,
      );
    }

    if (pkg.rules?.maxFunctionLines !== undefined && pkg.rules.maxFunctionLines > 0) {
      pkgLines.push(
        `- Functions must not exceed **${pkg.rules.maxFunctionLines} lines**. Extract helpers for complex logic.`,
      );
    }

    if (pkgLines.length > 0) {
      lines.push(packageHeader(pkg));
      lines.push(...pkgLines);
    }
  }

  return lines;
}

/**
 * Build the boundary rules section as markdown lines.
 * Groups deny rules by source package for compact output.
 */
export function formatBoundaryRules(config: ViberailsConfig): string[] {
  if (!config.rules.enforceBoundaries || !config.boundaries) {
    return [];
  }

  const { deny } = config.boundaries;
  const sources = Object.keys(deny).filter((k) => deny[k].length > 0);
  if (sources.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Boundary rules\n');
  lines.push('These import boundaries are enforced:\n');

  for (const source of sources) {
    const targets = deny[source].map((t) => `\`${t}\``).join(', ');
    lines.push(`- \`${source}\` must NOT import from: ${targets}`);
  }

  return lines;
}
