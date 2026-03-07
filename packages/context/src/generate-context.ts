import type { ConventionValue, PackageConfigOverrides, ViberailsConfig } from '@viberails/types';

/** Naming convention examples for directive formatting. */
const NAMING_EXAMPLES: Record<string, string> = {
  'kebab-case': '`user-profile.ts`, not `UserProfile.ts`',
  camelCase: '`userProfile.ts`, not `user-profile.ts`',
  PascalCase: '`UserProfile.ts`, not `user-profile.ts`',
  snake_case: '`user_profile.ts`, not `UserProfile.ts`',
};

/**
 * Extract the effective value from a ConventionValue (string or object).
 */
function conventionValue(cv: ConventionValue): string {
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Build the list of enforced rules as markdown bullet points.
 */
function formatEnforcedRules(config: ViberailsConfig): string[] {
  const { rules, conventions, structure } = config;
  const lines: string[] = [];

  if (rules.maxFileLines > 0) {
    lines.push(
      `- Files must not exceed **${rules.maxFileLines} lines**. Split into focused modules.`,
    );
  }

  if (rules.maxFunctionLines > 0) {
    lines.push(
      `- Functions must not exceed **${rules.maxFunctionLines} lines**. Extract helpers for complex logic.`,
    );
  }

  if (rules.enforceNaming && conventions.fileNaming) {
    const val = conventionValue(conventions.fileNaming);
    const examples = NAMING_EXAMPLES[val] ?? `e.g. \`my-module.ts\``;
    lines.push(`- Source files use **${val}**: ${examples}.`);
  }

  if (rules.requireTests && structure.testPattern) {
    if (structure.srcDir) {
      lines.push(
        `- Every source file in \`${structure.srcDir}/\` must have a corresponding \`${structure.testPattern}\` file.`,
      );
    } else {
      lines.push(
        `- Every source file must have a corresponding \`${structure.testPattern}\` file.`,
      );
    }
  }

  return lines;
}

/**
 * Generate a rules-focused context document from a ViberailsConfig.
 *
 * The output tells AI agents what rules are enforced and that commits
 * will fail if they are violated. It does not describe the project's
 * stack, structure, or architecture — that is trivially discoverable.
 *
 * @param config - The viberails configuration
 * @returns Markdown string for `.viberails/context.md`
 */
export function generateContext(config: ViberailsConfig): string {
  const sections: string[] = [];

  sections.push('# viberails enforced rules\n');

  if (config.enforcement === 'enforce') {
    sections.push('Commits will be rejected if these rules are violated:\n');
  } else {
    sections.push(
      'These rules are checked before commits. Violations will be **warned** but not blocked:\n',
    );
  }

  const ruleLines = formatEnforcedRules(config);
  if (ruleLines.length > 0) {
    sections.push(ruleLines.join('\n'));
  } else {
    sections.push('_(No rules configured. Edit `viberails.config.json` to add rules.)_');
  }

  const packageLines = formatPackageOverrides(config);
  if (packageLines.length > 0) {
    sections.push('');
    sections.push(packageLines.join('\n'));
  }

  const boundaryLines = formatBoundaryRules(config);
  if (boundaryLines.length > 0) {
    sections.push('');
    sections.push(boundaryLines.join('\n'));
  }

  const setupLines = formatDevelopmentSetup(config);
  if (setupLines.length > 0) {
    sections.push('');
    sections.push(setupLines.join('\n'));
  }

  sections.push('');
  sections.push('Run `viberails check` before committing to catch violations early.\n');

  return sections.join('\n');
}

/**
 * Build the "Development setup" section describing the project's
 * formatter and linter, with guidance on enabling format-on-save.
 */
function formatDevelopmentSetup(config: ViberailsConfig): string[] {
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
function packageHeader(pkg: PackageConfigOverrides): string {
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
function formatPackageOverrides(config: ViberailsConfig): string[] {
  if (!config.packages || config.packages.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Per-package rules\n');
  lines.push('The following packages have rules that differ from the global defaults:\n');

  for (const pkg of config.packages) {
    lines.push(packageHeader(pkg));

    if (pkg.conventions?.fileNaming) {
      const val = conventionValue(pkg.conventions.fileNaming);
      const examples = NAMING_EXAMPLES[val] ?? `e.g. \`my-module.ts\``;
      lines.push(`- Source files use **${val}**: ${examples}.`);
    }

    if (pkg.conventions?.componentNaming) {
      const val = conventionValue(pkg.conventions.componentNaming);
      lines.push(`- Components use **${val}** naming.`);
    }

    if (pkg.conventions?.hookNaming) {
      const val = conventionValue(pkg.conventions.hookNaming);
      lines.push(`- Hooks use **${val}** naming.`);
    }

    if (pkg.conventions?.importAlias) {
      const val = conventionValue(pkg.conventions.importAlias);
      lines.push(`- Import alias: \`${val}\`.`);
    }

    if (pkg.rules?.maxFileLines !== undefined && pkg.rules.maxFileLines > 0) {
      lines.push(
        `- Files must not exceed **${pkg.rules.maxFileLines} lines**. Split into focused modules.`,
      );
    }

    if (pkg.rules?.maxFunctionLines !== undefined && pkg.rules.maxFunctionLines > 0) {
      lines.push(
        `- Functions must not exceed **${pkg.rules.maxFunctionLines} lines**. Extract helpers for complex logic.`,
      );
    }
  }

  return lines;
}

/**
 * Build the boundary rules section as markdown lines.
 * Only includes deny rules (allow: false).
 */
function formatBoundaryRules(config: ViberailsConfig): string[] {
  if (!config.rules.enforceBoundaries || !config.boundaries || config.boundaries.length === 0) {
    return [];
  }

  const denyRules = config.boundaries.filter((r) => !r.allow);
  if (denyRules.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Boundary rules\n');
  lines.push('These import boundaries are enforced:\n');

  for (const rule of denyRules) {
    const reason = rule.reason ? ` (${rule.reason})` : '';
    lines.push(`- \`${rule.from}\` must NOT import from \`${rule.to}\`${reason}`);
  }

  return lines;
}
