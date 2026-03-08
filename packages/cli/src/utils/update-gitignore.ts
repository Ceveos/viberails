import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Append viberails entries to .gitignore if not already present.
 * Only scan-result.json is ignored — context.md should be committed
 * so AI agents can read the enforced rules.
 */
export function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (!content.includes('.viberails/scan-result.json')) {
    const block = '\n# viberails\n.viberails/scan-result.json\n';
    const prefix = content.length === 0 ? '' : `${content.trimEnd()}\n`;
    fs.writeFileSync(gitignorePath, `${prefix}${block}`);
  }
}
