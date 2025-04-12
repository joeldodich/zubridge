<img alt="zubridge hero image" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-hero.png"/>

_streamlined state management for Tauri apps_

<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Version">
  <img src="https://img.shields.io/npm/v/@zubridge/tauri" /></a>
<a href="https://www.npmjs.com/package/@zubridge/tauri" alt="NPM Downloads">
  <img src="https://img.shields.io/npm/dw/@zubridge/tauri" /></a>

## Why Zubridge?

> tldr: I want to use Zustand-like hooks in my Tauri frontend to interact seamlessly with my Rust backend state.

[Zustand](https://github.com/pmndrs/zustand) provides a simple and effective state management pattern. In Tauri applications, managing state consistently between the Rust backend (where the authoritative state often resides) and multiple frontend windows can be complex.

Zubridge `@zubridge/tauri` simplifies this by providing React hooks (`useZubridgeStore`, `useZubridgeDispatch`) that connect your frontend components to your Rust backend state, abstracting away the necessary Tauri command invocations and event listening.

## How It Works

`@zubridge/tauri` relies on a specific contract with your Rust backend:

1.  **State in Rust:** Your application state is owned and managed by your Rust code.
2.  **Commands & Events:** Your Rust backend exposes specific Tauri commands (`__zubridge_get_initial_state`, `__zubridge_dispatch_action`) and emits a standard event (`__zubridge_state_update`) whenever the state changes.
3.  **Frontend Hooks:** The Zubridge React hooks (`useZubridgeStore`, `useZubridgeDispatch`) interact with these commands and listen for the event.
4.  **Internal Store:** `useZubridgeStore` uses an internal, frontend-only Zustand store as a synchronized replica of the backend state, updated via the `__zubridge_state_update` event.
5.  **Action Dispatch:** `useZubridgeDispatch` provides a function to send action objects to the Rust backend via the `__zubridge_dispatch_action` command.

<img alt="zubridge tauri app architecture" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-tauri-app-architecture-v2.png"/>
_(Note: Diagram needs update to show Rust as backend)_ -> TODO: Update diagram

## Features

- Connect React frontend components to Rust backend state using Zustand-like hooks.
- Simplifies IPC for state management in Tauri v2.
- Type-safe interactions (when used with TypeScript).
- Automatic state synchronization across multiple windows.
- Clear separation between frontend state access and backend state logic.

## Installation

```bash
# Using npm
npm install @zubridge/tauri zustand react @types/react @tauri-apps/api

# Using yarn
yarn add @zubridge/tauri zustand react @types/react @tauri-apps/api

# Using pnpm
pnpm add @zubridge/tauri zustand react @types/react @tauri-apps/api
```

_Note: `zustand`, `react`, `@types/react`, and `@tauri-apps/api` are peer dependencies._

## Quick Start

1.  **Implement Backend Contract:** In your Tauri Rust application (`src-tauri/src/lib.rs`), define your state, manage it (e.g., using `tauri::State<Mutex<YourState>>`), and implement the required commands (`__zubridge_get_initial_state`, `__zubridge_dispatch_action`) and event emission (`__zubridge_state_update`) as detailed in the [Implementing the Rust Backend Contract](./docs/backend-process.md) guide.

2.  **Use Frontend Hooks:** In your React components, import and use the Zubridge hooks:

    ```tsx
    import React from 'react';
    import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
    import type { YourStateType } from '../types'; // Your app's state type

    function MyComponent() {
      const dispatch = useZubridgeDispatch();
      // Select state using a selector function
      const counter = useZubridgeStore((state) => (state as YourStateType).counter);
      const status = useZubridgeStore((state) => state.__zubridge_status);

      if (status !== 'ready') {
        return <p>Loading...</p>;
      }

      return (
        <div>
          <p>Counter: {counter ?? 'N/A'}</p>
          <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
        </div>
      );
    }
    ```

For detailed instructions and examples, see the [Getting Started Guide](./docs/getting-started.md).

For a complete API reference, see the [API Reference](./docs/api-reference.md).

## Example Application

A complete example application demonstrating the use of `@zubridge/tauri` with a simple counter state can be found here:

- [Tauri Example App](https://github.com/goosewobbler/zubridge/tree/main/apps/tauri-example)

## Documentation

For more detailed documentation, see:

- [Getting Started](./docs/getting-started.md)
- [Implementing the Rust Backend Contract](./docs/backend-process.md)
- [Frontend Process Guide](./docs/frontend-process.md)
- [API Reference](./docs/api-reference.md)

## License

MIT
