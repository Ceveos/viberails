# @viberails/context

AI context file generator for [viberails](https://github.com/Ceveos/viberails). Produces `.viberails/context.md` from your config, writing enforced rules in natural language that AI coding tools can follow.

## Installation

```bash
npm install @viberails/context
```

## Usage

```typescript
import { generateContext } from '@viberails/context';

const markdown = generateContext(config);
// Returns enforced rules as markdown, ready for CLAUDE.md or .cursorrules
```

## Documentation

See the [main repository](https://github.com/Ceveos/viberails) for full documentation.

## License

MIT
