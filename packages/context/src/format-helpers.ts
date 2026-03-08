import type { PackageConfig, ViberailsConfig } from '@viberails/types';

/** Naming convention examples for directive formatting. */
export const NAMING_EXAMPLES: Record<string, string> = {
  'kebab-case': '`user-profile.ts`, not `UserProfile.ts`',
  camelCase: '`userProfile.ts`, not `user-profile.ts`',
  PascalCase: '`UserProfile.ts`, not `user-profile.ts`',
  snake_case: '`user_profile.ts`, not `UserProfile.ts`',
};

/**
 * Get the root package from a config (path === "." or first package).
 */
export function getRootPackage(config: ViberailsConfig): PackageConfig {
  return config.packages.find((p) => p.path === '.') ?? config.packages[0];
}

/**
 * Build the "Development setup" section describing the project's
 * formatter and linter, with guidance on enabling format-on-save.
 */
export function formatDevelopmentSetup(config: ViberailsConfig): string[] {
  const root = getRootPackage(config);
  const linter = root.stack?.linter;
  const formatter = root.stack?.formatter;
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
 * Build the header for a package section.
 */
export function packageHeader(pkg: PackageConfig): string {
  const framework = pkg.stack?.framework;
  if (framework) {
    const name = framework.split('@')[0];
    return `### ${pkg.path} (${name})`;
  }
  return `### ${pkg.path}`;
}

/**
 * Build the per-package overrides section as markdown lines.
 * Only shows packages that differ from the root package.
 */
export function formatPackageOverrides(config: ViberailsConfig): string[] {
  if (config.packages.length <= 1) return [];

  const root = getRootPackage(config);
  const lines: string[] = [];
  lines.push('## Per-package rules\n');
  lines.push('The following packages override global defaults:\n');

  for (const pkg of config.packages) {
    if (pkg.path === '.') continue;
    const pkgLines: string[] = [];

    if (
      pkg.conventions?.fileNaming &&
      pkg.conventions.fileNaming !== root.conventions?.fileNaming
    ) {
      const val = pkg.conventions.fileNaming;
      const examples = NAMING_EXAMPLES[val] ?? `e.g. \`my-module.ts\``;
      pkgLines.push(`- Source files use **${val}**: ${examples}.`);
    }

    if (
      pkg.conventions?.componentNaming &&
      pkg.conventions.componentNaming !== root.conventions?.componentNaming
    ) {
      pkgLines.push(`- Components use **${pkg.conventions.componentNaming}** naming.`);
    }

    if (
      pkg.conventions?.hookNaming &&
      pkg.conventions.hookNaming !== root.conventions?.hookNaming
    ) {
      pkgLines.push(`- Hooks use **${pkg.conventions.hookNaming}** naming.`);
    }

    if (
      pkg.conventions?.importAlias &&
      pkg.conventions.importAlias !== root.conventions?.importAlias
    ) {
      pkgLines.push(`- Import alias: \`${pkg.conventions.importAlias}\`.`);
    }

    if (
      pkg.rules?.maxFileLines !== undefined &&
      pkg.rules.maxFileLines > 0 &&
      pkg.rules.maxFileLines !== config.rules.maxFileLines
    ) {
      pkgLines.push(
        `- Files must not exceed **${pkg.rules.maxFileLines} lines**. Split into focused modules.`,
      );
    }

    if (pkgLines.length > 0) {
      lines.push(packageHeader(pkg));
      lines.push(...pkgLines);
    }
  }

  return lines.length > 2 ? lines : [];
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
