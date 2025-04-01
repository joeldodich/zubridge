# @zubridge/electron

A bridge between Electron's main and renderer processes for Zustand stores.

## Features

- Use Zustand seamlessly across main and renderer processes
- Single store workflow across the IPC boundary
- Type-safe state management between processes
- Automatic state synchronization across windows
- Support for multiple windows and views
- Works with the latest [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security#checklist-security-recommendations)
- Supports various Zustand patterns (store handlers, separate handlers, Redux-style reducers)
- Handles thunks, inline actions, and action objects
- Automatic cleanup for destroyed windows and error recovery

## Installation

```bash
npm install @zubridge/electron zustand
```

Or use your dependency manager of choice, e.g. `pnpm`, `yarn`.

## Quick Start

1. Create a Zustand store in your main process
2. Initialize the bridge with your store and windows
3. Use the `createUseStore` function to create a hook for accessing the store in your renderer process

For detailed instructions and examples, see the [Getting Started Guide](docs/getting-started.md).

For a complete API reference, see the [API Reference](docs/api-reference.md).

## Example Applications

- [Basic Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-basic)
- [Reducers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-reducers)
- [Handlers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-handlers)

## License

MIT
