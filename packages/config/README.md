# @viberails/config

Config generation, loading, and merging for [viberails](https://github.com/Ceveos/viberails). Converts scan results into a `viberails.config.json` with smart defaults and confidence-based filtering.

## Installation

```bash
npm install @viberails/config
```

## Usage

```typescript
import { generateConfig, loadConfig } from '@viberails/config';

// Generate config from scan results
const config = generateConfig(scanResult);

// Load existing config from disk
const existing = await loadConfig('./my-project');
```

## Documentation

See the [main repository](https://github.com/Ceveos/viberails) for full documentation.

## License

MIT
