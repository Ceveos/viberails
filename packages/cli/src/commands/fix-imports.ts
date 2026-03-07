import * as path from 'node:path';
import type { RenameRecord } from './fix-naming.js';

export interface ImportUpdateRecord {
  file: string;
  oldSpecifier: string;
  newSpecifier: string;
  line: number;
}

/**
 * Strip known JS/TS extensions from a file path for specifier comparison.
 * E.g. "/foo/bar.ts" → "/foo/bar", "/foo/bar.js" → "/foo/bar"
 */
function stripExtension(filePath: string): string {
  return filePath.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
}

/**
 * Compute the new import specifier given the old specifier and the rename.
 * Preserves `.js` suffix if present.
 */
function computeNewSpecifier(oldSpecifier: string, newBare: string): string {
  const hasJsExt = oldSpecifier.endsWith('.js');
  const base = hasJsExt ? oldSpecifier.slice(0, -3) : oldSpecifier;

  // Replace the last path segment
  const dir = base.lastIndexOf('/');
  const prefix = dir >= 0 ? base.slice(0, dir + 1) : '';
  const newSpec = prefix + newBare;

  return hasJsExt ? `${newSpec}.js` : newSpec;
}

/**
 * Update import specifiers in all source files after renames.
 * Uses ts-morph for AST-accurate rewriting.
 *
 * @param renames - The renames that were applied
 * @param projectRoot - Absolute path to project root
 * @returns Records of all import updates made
 */
export async function updateImportsAfterRenames(
  renames: RenameRecord[],
  projectRoot: string,
): Promise<ImportUpdateRecord[]> {
  if (renames.length === 0) return [];

  // Lazy import ts-morph to avoid startup cost
  const { Project, SyntaxKind } = await import('ts-morph');

  // Build rename map: stripped old abs path → { newBare }
  const renameMap = new Map<string, { newBare: string }>();
  for (const r of renames) {
    const oldStripped = stripExtension(r.oldAbsPath);
    const newFilename = path.basename(r.newPath);
    const newName = newFilename.slice(0, newFilename.indexOf('.'));
    renameMap.set(oldStripped, { newBare: newName });
  }

  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
  });

  // Add all TS/JS source files
  project.addSourceFilesAtPaths(path.join(projectRoot, '**/*.{ts,tsx,js,jsx,mjs,cjs}'));

  const updates: ImportUpdateRecord[] = [];
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    // Skip node_modules and dist
    if (filePath.includes('/node_modules/') || filePath.includes('/dist/')) continue;

    const fileDir = path.dirname(filePath);

    // Process static imports
    for (const decl of sourceFile.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue();
      if (!specifier.startsWith('.')) continue;

      const match = resolveToRenamedFile(specifier, fileDir, renameMap, extensions);
      if (!match) continue;

      const newSpec = computeNewSpecifier(specifier, match.newBare);
      updates.push({
        file: filePath,
        oldSpecifier: specifier,
        newSpecifier: newSpec,
        line: decl.getStartLineNumber(),
      });
      decl.setModuleSpecifier(newSpec);
    }

    // Process re-exports
    for (const decl of sourceFile.getExportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue();
      if (!specifier || !specifier.startsWith('.')) continue;

      const match = resolveToRenamedFile(specifier, fileDir, renameMap, extensions);
      if (!match) continue;

      const newSpec = computeNewSpecifier(specifier, match.newBare);
      updates.push({
        file: filePath,
        oldSpecifier: specifier,
        newSpecifier: newSpec,
        line: decl.getStartLineNumber(),
      });
      decl.setModuleSpecifier(newSpec);
    }

    // Process dynamic imports
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const arg = args[0];
      if (arg.getKind() !== SyntaxKind.StringLiteral) continue;

      const specifier = arg.getText().slice(1, -1);
      if (!specifier.startsWith('.')) continue;

      const match = resolveToRenamedFile(specifier, fileDir, renameMap, extensions);
      if (!match) continue;

      const newSpec = computeNewSpecifier(specifier, match.newBare);
      updates.push({
        file: filePath,
        oldSpecifier: specifier,
        newSpecifier: newSpec,
        line: call.getStartLineNumber(),
      });
      // Replace the string literal content
      const quote = arg.getText()[0];
      arg.replaceWithText(`${quote}${newSpec}${quote}`);
    }
  }

  if (updates.length > 0) {
    await project.save();
  }

  return updates;
}

/**
 * Try to resolve a relative specifier to a renamed file.
 * Returns the rename info if matched, undefined otherwise.
 */
function resolveToRenamedFile(
  specifier: string,
  fromDir: string,
  renameMap: Map<string, { newBare: string }>,
  extensions: string[],
): { newBare: string } | undefined {
  // Strip .js extension for resolution (TypeScript convention)
  const cleanSpec = specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier;
  const resolved = path.resolve(fromDir, cleanSpec);

  for (const ext of extensions) {
    const candidate = resolved + ext;
    const stripped = stripExtension(candidate);
    const match = renameMap.get(stripped);
    if (match) return match;
  }

  return undefined;
}
