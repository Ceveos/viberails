# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-06

### Added

- feat(cli): improve init display with role grouping and summary section
- feat: formatter detection in scanner (Biome, Prettier)
- feat: "Development setup" section in generated context.md
- feat: VS Code settings and .editorconfig for contributor DX

### Fixed

- fix: move ajv from devDependencies to dependencies in @viberails/config

### Changed

- refactor: split oversized files to comply with 200-line rule

## [0.1.0] - 2026-02-20

### Added

- Project scanner: package.json detection, directory structure analysis, convention inference
- Config system: JSON schema, generation from scan results, merging for sync
- Context generation: .viberails/context.md from config and scan results
- CLI: viberails init, sync, check, fix, boundaries commands
- Monorepo support: workspace detection, per-package scanning, import graph, boundary inference
- Pre-commit hook integration: Lefthook, Husky, raw git hooks
- Confidence model: high/medium/low with consistency thresholds

[0.2.0]: https://github.com/Ceveos/viberails/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ceveos/viberails/releases/tag/v0.1.0
