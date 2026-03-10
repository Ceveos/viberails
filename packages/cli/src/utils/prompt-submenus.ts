import * as clack from '@clack/prompts';
import { assertNotCancelled } from './prompt.js';
import type { RuleOverrides } from './prompt-rules.js';

export const FILE_NAMING_OPTIONS = [
  { value: 'kebab-case', label: 'kebab-case' },
  { value: 'camelCase', label: 'camelCase' },
  { value: 'PascalCase', label: 'PascalCase' },
  { value: 'snake_case', label: 'snake_case' },
] as const;

/** Sub-menu for file limit settings. */
export async function promptFileLimitsMenu(state: RuleOverrides): Promise<void> {
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
    assertNotCancelled(choice);
    if (choice === 'back') return;

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
      assertNotCancelled(result);
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
      assertNotCancelled(result);
      state.maxTestFileLines = Number.parseInt(result, 10);
    }
  }
}

/** Sub-menu for naming and convention settings. */
export async function promptNamingMenu(state: RuleOverrides): Promise<void> {
  while (true) {
    const options: { value: string; label: string; hint?: string }[] = [
      {
        value: 'enforceNaming',
        label: 'Enforce file naming',
        hint: state.enforceNaming ? 'yes' : 'no',
      },
    ];

    if (state.enforceNaming) {
      options.push({
        value: 'fileNaming',
        label: 'File naming convention',
        hint: state.fileNamingValue ?? '(not set)',
      });
    }

    options.push(
      {
        value: 'componentNaming',
        label: 'Component naming',
        hint: state.componentNaming ?? '(not set)',
      },
      {
        value: 'hookNaming',
        label: 'Hook naming',
        hint: state.hookNaming ?? '(not set)',
      },
      {
        value: 'importAlias',
        label: 'Import alias',
        hint: state.importAlias ?? '(not set)',
      },
      { value: 'back', label: 'Back' },
    );

    const choice = await clack.select({ message: 'Naming & conventions', options });
    assertNotCancelled(choice);
    if (choice === 'back') return;

    if (choice === 'enforceNaming') {
      const result = await clack.confirm({
        message: state.fileNamingValue
          ? `Enforce file naming? (detected: ${state.fileNamingValue})`
          : 'Enforce file naming?',
        initialValue: state.enforceNaming,
      });
      assertNotCancelled(result);

      if (result && !state.fileNamingValue) {
        // Must pick a convention before enabling enforcement
        const selected = await clack.select({
          message: 'Which file naming convention should be enforced?',
          options: [...FILE_NAMING_OPTIONS],
        });
        assertNotCancelled(selected);
        state.fileNamingValue = selected;
      }
      state.enforceNaming = result;
    }

    if (choice === 'fileNaming') {
      const selected = await clack.select({
        message: 'Which file naming convention should be enforced?',
        options: [...FILE_NAMING_OPTIONS],
        initialValue: state.fileNamingValue,
      });
      assertNotCancelled(selected);
      state.fileNamingValue = selected;
    }

    if (choice === 'componentNaming') {
      const result = await clack.text({
        message: 'Component naming convention (blank to clear)?',
        initialValue: state.componentNaming ?? '',
        placeholder: 'e.g. PascalCase',
      });
      assertNotCancelled(result);
      state.componentNaming = result.trim() || undefined;
    }

    if (choice === 'hookNaming') {
      const result = await clack.text({
        message: 'Hook naming convention (blank to clear)?',
        initialValue: state.hookNaming ?? '',
        placeholder: 'e.g. useXxx or use-*',
      });
      assertNotCancelled(result);
      state.hookNaming = result.trim() || undefined;
    }

    if (choice === 'importAlias') {
      const result = await clack.text({
        message: 'Import alias pattern (blank to clear)?',
        initialValue: state.importAlias ?? '',
        placeholder: 'e.g. @/* or ~/*',
      });
      assertNotCancelled(result);
      state.importAlias = result.trim() || undefined;
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
        hint: state.enforceMissingTests ? 'yes' : 'no',
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
    assertNotCancelled(choice);
    if (choice === 'back') return;

    if (choice === 'enforceMissingTests') {
      const result = await clack.confirm({
        message: 'Require every source file to have a corresponding test file?',
        initialValue: state.enforceMissingTests,
      });
      assertNotCancelled(result);
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
      assertNotCancelled(result);
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
      assertNotCancelled(result);
      state.coverageSummaryPath = result.trim();
    }

    if (choice === 'coverageCommand') {
      const result = await clack.text({
        message: 'Coverage command (blank to auto-detect from package.json)?',
        initialValue: state.coverageCommand ?? '',
        placeholder: '(auto-detect from package.json test runner)',
      });
      assertNotCancelled(result);
      const trimmed = result.trim();
      state.coverageCommand = trimmed.length > 0 ? trimmed : undefined;
    }
  }
}
