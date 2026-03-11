# @viberails/graph

Import graph analysis and boundary checking for [viberails](https://github.com/Ceveos/viberails). Builds the import graph of a JS/TS project, infers package boundaries, and detects boundary violations and circular dependencies.

## Installation

```bash
npm install @viberails/graph
```

## Usage

```typescript
import { buildGraph, checkBoundaries, inferBoundaries } from '@viberails/graph';

const graph = await buildGraph('./my-monorepo');
const violations = checkBoundaries(graph, boundaryRules);
const inferred = inferBoundaries(graph, workspaces);
```

## Documentation

See the [main repository](https://github.com/Ceveos/viberails) for full documentation.

## License

MIT
