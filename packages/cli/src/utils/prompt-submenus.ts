import * as clack from '@clack/prompts';
import chalk from 'chalk';
import { isCancelled } from './prompt.js';
import { HINT_NOT_SET, SENTINEL_CLEAR, SENTINEL_CUSTOM } from './prompt-constants.js';
import type { RuleOverrides } from './prompt-rules.js';

export const FILE_NAMING_OPTIONS = [
  { value: 'kebab-case', label: 'kebab-case' },
  { value: 'camelCase', label: 'camelCase' },
  { value: 'PascalCase', label: 'PascalCase' },
  { value: 'snake_case', label: 'snake_case' },
] as const;

export const COMPONENT_NAMING_OPTIONS = [
  { value: 'PascalCase', label: 'PascalCase', hint: 'MyComponent.tsx' },
  { value: 'camelCase', label: 'camelCase', hint: 'myComponent.tsx' },
] as const;

export const HOOK_NAMING_OPTIONS = [
  { value: 'useXxx', label: 'useXxx', hint: 'useAuth, useFormData' },
  { value: 'use-*', label: 'use-*', hint: 'use-auth, use-form-data' },
] as const;

/** Sub-menu for file limit settings. */
export async function promptFileLimitsMenu(
  state: Pick<RuleOverrides, 'maxFileLines' | 'maxTestFileLines'>,
): Promise<void> {
  while (true) {
    const choice = await clack.select({
      message: 'File limits',
      options: [
        { value: 'maxFileLines', label: 'Max file lines', hint: String(state.maxFileLines) },
        {
          value: 'maxTestFileLines',
          label: 'Max test file lines',
          hint: state.maxTestFileLines > 0 ? String(state.maxTestFileLines) : '0 (unlimited)',
        },
        { value: 'back', label: 'Back' },
      ],
    });
    if (isCancelled(choice) || choice === 'back') return;

    if (choice === 'maxFileLines') {
      const result = await clack.text({
        message: 'Maximum lines per source file?',
        initialValue: String(state.maxFileLines),
        validate: (v) => {
          if (typeof v !== 'string') return 'Enter a positive number';
          const n = Number.parseInt(v, 10);
          if (Number.isNaN(n) || n < 1) return 'Enter a positive number';
        },
      });
      if (isCancelled(result)) continue;
      state.maxFileLines = Number.parseInt(result, 10);
    }

    if (choice === 'maxTestFileLines') {
      const result = await clack.text({
        message: 'Maximum lines per test file (0 to disable)?',
        initialValue: String(state.maxTestFileLines),
        validate: (v) => {
          if (typeof v !== 'string') return 'Enter a number (0 or positive)';
          const n = Number.parseInt(v, 10);
          if (Number.isNaN(n) || n < 0) return 'Enter a number (0 or positive)';
        },
      });
      if (isCancelled(result)) continue;
      state.maxTestFileLines = Number.parseInt(result, 10);
    }
  }
}

/** Sub-menu for naming and convention settings. */
export async function promptNamingMenu(state: RuleOverrides): Promise<void> {
  while (true) {
    const ok = chalk.green('\u2713');
    const unset = chalk.dim('-');

    const enforcementLabel = state.enforceNaming
      ? `enforced ${chalk.green('\u2713')}`
      : `not enforced ${chalk.dim('\u2717')}`;
    const options: { value: string; label: string; hint?: string }[] = [
      {
        value: 'fileNaming',
        label: `${state.fileNamingValue ? ok : unset} File naming convention`,
        hint: state.fileNamingValue ?? HINT_NOT_SET,
      },
      {
        value: 'componentNaming',
        label: `${state.componentNaming ? ok : unset} Component exports`,
        hint: state.componentNaming ?? HINT_NOT_SET,
      },
      {
        value: 'hookNaming',
        label: `${state.hookNaming ? ok : unset} Hook exports`,
        hint: state.hookNaming ?? HINT_NOT_SET,
      },
      {
        value: 'importAlias',
        label: `${state.importAlias ? ok : unset} Import alias`,
        hint: state.importAlias ?? HINT_NOT_SET,
      },
      {
        value: 'toggleEnforcement',
        label: state.enforceNaming ? '  Turn off enforcement' : '  Turn on enforcement',
      },
      { value: 'back', label: '  Back' },
    ];

    const choice = await clack.select({
      message: `Naming conventions (${enforcementLabel})`,
      options,
    });
    if (isCancelled(choice) || choice === 'back') return;

    if (choice === 'toggleEnforcement') {
      state.enforceNaming = !state.enforceNaming;
      continue;
    }

    if (choice === 'fileNaming') {
      const selected = await clack.select({
        message: 'File naming convention',
        options: [
          ...FILE_NAMING_OPTIONS,
          { value: SENTINEL_CLEAR, label: 'Clear (no convention)' },
        ],
        initialValue: state.fileNamingValue ?? SENTINEL_CLEAR,
      });
      if (isCancelled(selected)) continue;
      state.fileNamingValue = selected === SENTINEL_CLEAR ? undefined : selected;
    }

    if (choice === 'componentNaming') {
      const selected = await clack.select({
        message: 'Component export naming (e.g. UserProfile)',
        options: [
          ...COMPONENT_NAMING_OPTIONS,
          { value: SENTINEL_CLEAR, label: 'Clear (no convention)' },
        ],
        initialValue: state.componentNaming ?? SENTINEL_CLEAR,
      });
      if (isCancelled(selected)) continue;
      state.componentNaming = selected === SENTINEL_CLEAR ? undefined : selected;
    }

    if (choice === 'hookNaming') {
      const selected = await clack.select({
        message: 'Hook export naming (e.g. useAuth)',
        options: [
          ...HOOK_NAMING_OPTIONS,
          { value: SENTINEL_CLEAR, label: 'Clear (no convention)' },
        ],
        initialValue: state.hookNaming ?? SENTINEL_CLEAR,
      });
      if (isCancelled(selected)) continue;
      state.hookNaming = selected === SENTINEL_CLEAR ? undefined : selected;
    }

    if (choice === 'importAlias') {
      const selected = await clack.select({
        message: 'Import alias pattern',
        options: [
          { value: '@/*', label: '@/*', hint: "import { x } from '@/utils'" },
          { value: '~/*', label: '~/*', hint: "import { x } from '~/utils'" },
          { value: SENTINEL_CUSTOM, label: 'Custom...' },
          { value: SENTINEL_CLEAR, label: 'Clear (no alias)' },
        ],
        initialValue: state.importAlias ?? SENTINEL_CLEAR,
      });
      if (isCancelled(selected)) continue;
      if (selected === SENTINEL_CLEAR) {
        state.importAlias = undefined;
      } else if (selected === SENTINEL_CUSTOM) {
        const result = await clack.text({
          message: 'Custom import alias (e.g. #/*)?',
          initialValue: state.importAlias ?? '',
          placeholder: 'e.g. #/*',
          validate: (v) => {
            if (typeof v !== 'string' || !v.trim()) return 'Alias cannot be empty';
            if (!/^[a-zA-Z@~#$][a-zA-Z0-9@~#$_-]*\/\*$/.test(v.trim()))
              return 'Must match pattern like @/*, ~/*, or #src/*';
          },
        });
        if (isCancelled(result)) continue;
        state.importAlias = result.trim();
      } else {
        state.importAlias = selected;
      }
    }
  }
}

/** Sub-menu for testing and coverage settings. */
export async function promptTestingMenu(state: RuleOverrides): Promise<void> {
  while (true) {
    const options: { value: string; label: string; hint?: string }[] = [
      {
        value: 'enforceMissingTests',
        label: 'Enforce missing tests',
        hint: state.enforceMissingTests ? chalk.green('\u2713') : chalk.dim('\u2717'),
      },
      {
        value: 'testCoverage',
        label: 'Test coverage target',
        hint: state.testCoverage === 0 ? '0 (disabled)' : `${state.testCoverage}%`,
      },
    ];

    if (state.testCoverage > 0) {
      options.push(
        {
          value: 'coverageSummaryPath',
          label: 'Coverage summary path',
          hint: state.coverageSummaryPath,
        },
        {
          value: 'coverageCommand',
          label: 'Coverage command',
          hint: state.coverageCommand ?? 'auto-detect from package.json test runner',
        },
      );
    }

    options.push({ value: 'back', label: 'Back' });

    const choice = await clack.select({ message: 'Testing & coverage', options });
    if (isCancelled(choice) || choice === 'back') return;

    if (choice === 'enforceMissingTests') {
      const result = await clack.confirm({
        message: 'Require every source file to have a corresponding test file?',
        initialValue: state.enforceMissingTests,
      });
      if (isCancelled(result)) continue;
      state.enforceMissingTests = result;
    }

    if (choice === 'testCoverage') {
      const result = await clack.text({
        message: 'Test coverage target (0 disables coverage checks)?',
        initialValue: String(state.testCoverage),
        validate: (v) => {
          if (typeof v !== 'string') return 'Enter a number between 0 and 100';
          const n = Number.parseInt(v, 10);
          if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100';
        },
      });
      if (isCancelled(result)) continue;
      state.testCoverage = Number.parseInt(result, 10);
    }

    if (choice === 'coverageSummaryPath') {
      const result = await clack.text({
        message: 'Coverage summary path (relative to package root)?',
        initialValue: state.coverageSummaryPath,
        validate: (v) => {
          if (typeof v !== 'string' || v.trim().length === 0) return 'Path cannot be empty';
        },
      });
      if (isCancelled(result)) continue;
      state.coverageSummaryPath = result.trim();
    }

    if (choice === 'coverageCommand') {
      const result = await clack.text({
        message: 'Coverage command (blank to auto-detect from package.json)?',
        initialValue: state.coverageCommand ?? '',
        placeholder: '(auto-detect from package.json test runner)',
      });
      if (isCancelled(result)) continue;
      const trimmed = result.trim();
      state.coverageCommand = trimmed.length > 0 ? trimmed : undefined;
    }
  }
}
