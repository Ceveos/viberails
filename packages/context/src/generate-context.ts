import type { ConventionValue, ViberailsConfig } from '@viberails/types';

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
    const srcDir = structure.srcDir ?? 'src';
    lines.push(
      `- Every source file in \`${srcDir}/\` must have a corresponding \`${structure.testPattern}\` file.`,
    );
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

  sections.push('');
  sections.push('Run `viberails check` before committing to catch violations early.\n');

  return sections.join('\n');
}
