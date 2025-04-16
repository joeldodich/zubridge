<img alt="zubridge hero image" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-hero.png"/>

_streamlined state management for Electron apps_

<a href="https://www.npmjs.com/package/@zubridge/electron" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@zubridge/electron" /></a>
<a href="https://www.npmjs.com/package/@zubridge/electron" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@zubridge/electron" /></a>

## Why Zubridge?

> tldr: I want to use Zustand in my Electron app, seamlessly

[Zustand](https://github.com/pmndrs/zustand) is a great state management library. As with other state libraries [such as Redux](https://redux.js.org/tutorials/fundamentals/part-4-store#redux-store), it is [recommended](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#recommended-patterns) that a single store is used in your app.

For Electron apps, accessing state across the main and renderer processes presents a challenge due to the IPC boundary.

`@zubridge/electron` solves this by enabling a single store workflow, abstracting away the IPC management and state synchronization between processes.

## How It Works

Zubridge creates a bridge between your main process Zustand store and your renderer processes. The main process store acts as the single source of truth, while renderer processes receive synchronized copies of the state.

Actions from renderer processes are sent through IPC to the main process, which updates the central store. These updates are then automatically broadcast to all connected renderer processes, ensuring consistent state throughout your application.

<img alt="zubridge electron app architecture" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-electron-app-architecture.png"/>

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

## Documentation

- [Getting Started Guide](docs/getting-started.md) - Step-by-step guide to setting up Zubridge in your Electron app
- [API Reference](docs/api-reference.md) - Complete API documentation
- [Main Process](docs/main-process.md) - Setting up and using Zubridge in the main process
- [Renderer Process](docs/renderer-process.md) - Setting up and using Zubridge in the renderer process
- [Backend Contract](docs/backend-contract.md) - Understanding the IPC contract between processes
- [Migration Guide](docs/migration-guide.md) - Guide for migrating from earlier versions

## Example Applications

The example app demonstrates all three approaches of using zubridge with Electron:

- [Zubridge Electron Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron-example)
  - Basic Mode: Direct store mutation
  - Handlers Mode: Action handler functions
  - Reducers Mode: Redux-style reducers

## License

MIT
