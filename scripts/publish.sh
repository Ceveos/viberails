#!/usr/bin/env bash
set -euo pipefail

# Publish all viberails packages to npm.
#
# Usage:
#   ./scripts/publish.sh           # publish all packages
#   ./scripts/publish.sh --dry-run # preview what would be published
#
# Prerequisites:
#   - Logged in to npm: `npm login` (or `pnpm login`)
#   - @viberails org exists on npm with your account as owner
#   - Working tree is clean (no uncommitted changes)

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "==> Dry run mode — nothing will be published"
fi

# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Build and test
echo "==> Building all packages..."
pnpm build

echo "==> Running tests..."
pnpm test

# Publish in dependency order. pnpm publish converts workspace:* to real versions.
PACKAGES=(
  packages/types
  packages/scanner
  packages/config
  packages/context
  packages/graph
  packages/cli
)

echo "==> Publishing packages..."
for pkg in "${PACKAGES[@]}"; do
  name=$(node -e "console.log(require('./$pkg/package.json').name)")
  version=$(node -e "console.log(require('./$pkg/package.json').version)")
  echo "  Publishing $name@$version..."
  (cd "$pkg" && pnpm publish --no-git-checks $DRY_RUN)
done

echo "==> Done."
