# @viberails/scanner

Project scanner for [viberails](https://github.com/Ceveos/viberails). Detects framework, language, tooling, directory structure, naming conventions, and codebase statistics from an existing JS/TS project.

## Installation

```bash
npm install @viberails/scanner
```

## Usage

```typescript
import { scan } from '@viberails/scanner';

const result = await scan('./my-project');
// result.stack, result.structure, result.conventions, result.statistics
```

Each detected convention includes a confidence level (`high`, `medium`, `low`) based on consistency across your files.

## Documentation

See the [main repository](https://github.com/Ceveos/viberails) for full documentation.

## License

MIT
