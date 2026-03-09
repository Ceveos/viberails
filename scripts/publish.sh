#!/usr/bin/env bash
set -euo pipefail

# Publish all viberails packages to npm with automatic version bumping.
#
# Usage:
#   ./scripts/publish.sh                # bump minor, publish all packages
#   ./scripts/publish.sh patch          # bump patch version
#   ./scripts/publish.sh minor          # bump minor version (default)
#   ./scripts/publish.sh major          # bump major version
#   ./scripts/publish.sh 0.3.0          # set explicit version
#   ./scripts/publish.sh --dry-run      # preview with minor bump, no publish
#   ./scripts/publish.sh patch --dry-run
#
# Prerequisites:
#   - Logged in to npm: `npm login` (or `pnpm login`)
#   - @viberails org exists on npm with your account as owner
#   - Working tree is clean (no uncommitted changes)

DRY_RUN=""
BUMP="minor"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    patch|minor|major) BUMP="$arg" ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP="$arg" ;;
  esac
done

if [[ -n "$DRY_RUN" ]]; then
  echo "==> Dry run mode — nothing will be published or committed"
fi

# Publish in dependency order. pnpm publish converts workspace:* to real versions.
PACKAGES=(
  packages/types
  packages/scanner
  packages/config
  packages/context
  packages/graph
  packages/cli
)

# Compute the new version
CURRENT_VERSION=$(node -e "console.log(require('./packages/types/package.json').version)")

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP" in
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
    patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  esac
fi

echo "==> Version: $CURRENT_VERSION → $NEW_VERSION ($BUMP)"

# Ensure clean working tree (skip for dry-run so you can preview without committing)
if [[ -z "$DRY_RUN" && -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Update versions in all package.json files
echo "==> Bumping versions..."
for pkg in "${PACKAGES[@]}"; do
  node -e "
    const fs = require('fs');
    const p = './$pkg/package.json';
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    data.version = '$NEW_VERSION';
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  "
done

# Ensure npm authentication (required for @viberails scoped packages)
echo "==> Checking npm authentication..."
if ! npm whoami &>/dev/null; then
  echo "  Not logged in to npm. Running npm login..."
  npm login
fi
echo "  Logged in as: $(npm whoami)"

# Build and test
echo "==> Building all packages..."
pnpm build

echo "==> Running tests..."
pnpm test

# Publish
echo "==> Publishing packages..."
for pkg in "${PACKAGES[@]}"; do
  name=$(node -e "console.log(require('./$pkg/package.json').name)")
  echo "  Publishing $name@$NEW_VERSION..."
  (cd "$pkg" && pnpm publish --no-git-checks --access public $DRY_RUN)
done

# Commit version bump and tag
if [[ -z "$DRY_RUN" ]]; then
  echo "==> Committing version bump..."
  git add -A
  git commit -m "chore: release v$NEW_VERSION"
  git tag "v$NEW_VERSION"
  echo "==> Tagged v$NEW_VERSION (run 'git push && git push --tags' to push)"
else
  echo "==> Dry run complete. Would have published v$NEW_VERSION"
  # Revert version changes
  git checkout -- .
fi

echo "==> Done."
