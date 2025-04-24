# `@zubridge/electron` Example App

An Electron application demonstrating the different approaches of using Zubridge with Electron:

- Basic (direct store mutation)
- Handlers (action handler functions)
- Reducers (Redux-style reducers)
- Redux (Redux using RTK)
- Custom (custom state manager using Zubridge backend contract)

## Features

- **Multiple Implementation Approaches**: Compare different state management patterns
- **Main Process State**: Main process serves as the source of truth
- **Multi-Window Support**: All windows share the same state through the Zubridge bridge
- **IPC Abstraction**: Simplified communication between main and renderer processes
- **Type Safety**: Full TypeScript support across all approaches

## Running the example

```bash
# Run with default mode
pnpm dev

# Run with specific mode
pnpm dev:basic
pnpm dev:handlers
pnpm dev:reducers
pnpm dev:redux
pnpm dev:custom
```

## Building for production

```bash
# Build with default mode
pnpm build

# Build with specific mode
pnpm build:basic
pnpm build:handlers
pnpm build:reducers
pnpm build:redux
pnpm build:custom
```

## Project Structure

- `src/` - TypeScript code
  - `main/` - Main process code
  - `renderer/` - Renderer process components and hooks
  - `preload/` - Preload scripts for exposing APIs
  - `features/` - State management implementation for each approach
  - `types/` - Shared type definitions
- `resources/` - Static assets and icons

## Implementation Notes

This example demonstrates best practices for Electron applications using Zubridge:

1. Main process maintains authoritative state
2. Renderer process stays in sync via Zubridge
3. State changes are propagated via IPC
4. Multiple implementation approaches showcase Zubridge's flexibility

For more details on Electron integration, see the [Zubridge Electron documentation](/packages/electron/README.md).
