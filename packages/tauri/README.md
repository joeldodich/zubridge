<img alt="zubridge hero image" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-hero.png"/>

_streamlined state management for Tauri apps_

<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@zubridge/tauri" /></a>
<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@zubridge/tauri" /></a>

## Why Zubridge?

> tldr: I want to use Zustand in my Tauri app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For Tauri apps, accessing state across the backend and frontend processes presents a challenge.

Zubridge solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

## How It Works

Zubridge uses an additional Zustand store in the frontend process, which is synchronized in one direction with your application store in the backend process.

Actions from the frontend are dispatched via Tauri commands/events to the backend store, which handles them and updates state accordingly. The frontend store then receives these state updates and synchronizes itself automatically.

<img alt="zubridge tauri app architecture" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-tauri-app-architecture.png"/>

## Features

- Use Zustand seamlessly across backend and frontend processes
- Single store workflow across the IPC boundary
- Type-safe state management between processes
- Automatic state synchronization across windows
- Support for multiple windows
- Works with Tauri v2
- Supports various Zustand patterns (store handlers, separate handlers, Redux-style reducers)
- Handles thunks, inline actions, and action objects
- Automatic cleanup and error recovery

## Installation

```bash
npm install @zubridge/tauri zustand @tauri-apps/api
```

Or use your dependency manager of choice, e.g. `pnpm`, `yarn`.

## Quick Start

1. Create a Zustand store in your backend process
2. Initialize the bridge with your store
3. Use the `createUseStore` function to create a hook for accessing the store in your frontend process

For detailed instructions and examples, see the [Getting Started Guide](./docs/getting-started.md).

For a complete API reference, see the [API Reference](./docs/api-reference.md).

## Example Applications

- [Basic Example](https://github.com/goosewobbler/zubridge/tree/main/apps/tauri/example-basic)
- [Reducers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/tauri/example-reducers)
- [Handlers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/tauri/example-handlers)

## Documentation

For more detailed documentation, see:

- [Getting Started](./docs/getting-started.md)
- [Backend Process Guide](./docs/backend-process.md)
- [Frontend Process Guide](./docs/frontend-process.md)
- [API Reference](./docs/api-reference.md)

## License

MIT
