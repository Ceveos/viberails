import type { ImportEdge } from '@viberails/types';
import { type SourceFile, SyntaxKind } from 'ts-morph';

/** File extensions to skip (non-JS assets). */
const SKIP_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.less',
  '.sass',
  '.png',
  '.svg',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.json',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

/**
 * Checks whether an import specifier should be skipped (non-JS asset).
 */
function shouldSkip(specifier: string): boolean {
  const dotIndex = specifier.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return SKIP_EXTENSIONS.has(specifier.slice(dotIndex).toLowerCase());
}

/**
 * Parses all import statements from a ts-morph SourceFile and returns
 * them as ImportEdge objects.
 *
 * Handles static imports, default imports, namespace imports, type-only
 * imports, side-effect imports, dynamic imports, and re-exports.
 *
 * @param sourceFile - A ts-morph SourceFile to extract imports from.
 * @returns Array of ImportEdge objects for each import found.
 */
export function parseImports(sourceFile: SourceFile): ImportEdge[] {
  const edges: ImportEdge[] = [];
  const filePath = sourceFile.getFilePath();

  // Static imports (including type-only, default, namespace, side-effect)
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (shouldSkip(specifier)) continue;

    edges.push({
      source: filePath,
      target: specifier,
      specifier,
      typeOnly: decl.isTypeOnly(),
      dynamic: false,
      line: decl.getStartLineNumber(),
    });
  }

  // Re-exports: export { x } from './foo' and export * from './foo'
  for (const decl of sourceFile.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (!specifier || shouldSkip(specifier)) continue;

    edges.push({
      source: filePath,
      target: specifier,
      specifier,
      typeOnly: decl.isTypeOnly(),
      dynamic: false,
      line: decl.getStartLineNumber(),
    });
  }

  // Dynamic imports: import('...')
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;

    const args = call.getArguments();
    if (args.length === 0) continue;

    const arg = args[0];
    if (arg.getKind() !== SyntaxKind.StringLiteral) continue;

    const specifier = arg.getText().slice(1, -1); // Remove quotes
    if (shouldSkip(specifier)) continue;

    edges.push({
      source: filePath,
      target: specifier,
      specifier,
      typeOnly: false,
      dynamic: true,
      line: call.getStartLineNumber(),
    });
  }

  return edges;
}
