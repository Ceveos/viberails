import * as fs from 'node:fs';
import { checkCommand } from './check.js';

/**
 * Parse a file path from Claude Code hook stdin JSON.
 * The PostToolUse hook receives `{ tool_input: { file_path: "..." } }` on stdin.
 * Returns the file path or undefined if input is empty/malformed.
 */
export function parseHookFilePath(input: string): string | undefined {
  try {
    if (!input.trim()) return undefined;
    const parsed = JSON.parse(input);
    return parsed?.tool_input?.file_path ?? undefined;
  } catch {
    return undefined;
  }
}

function readStdin(): string {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Run viberails check in Claude Code hook mode.
 *
 * Reads the edited file path from stdin JSON, runs the check,
 * and outputs violation JSON to stderr so Claude sees feedback.
 * Returns exit code 2 if violations found, 0 otherwise.
 * Never throws — errors silently pass to avoid blocking Claude.
 */
export async function hookCheckCommand(cwd?: string): Promise<number> {
  try {
    const filePath = parseHookFilePath(readStdin());
    if (!filePath) return 0;

    // Redirect stdout to capture checkCommand's JSON output
    const originalWrite = process.stdout.write.bind(process.stdout);
    let captured = '';
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      captured += typeof chunk === 'string' ? chunk : chunk.toString();
      return true;
    };

    try {
      await checkCommand({ files: [filePath], format: 'json' }, cwd);
    } finally {
      process.stdout.write = originalWrite;
    }

    if (!captured.trim()) return 0;

    const result = JSON.parse(captured);
    if (result.violations?.length > 0) {
      process.stderr.write(`${captured.trim()}\n`);
      return 2;
    }

    return 0;
  } catch {
    // Never block Claude on internal errors
    return 0;
  }
}
