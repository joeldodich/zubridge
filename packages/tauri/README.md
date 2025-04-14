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

`@zubridge/tauri` requires initialization with functions that handle communication with your Tauri backend. You provide implementations for `invoke` (to call Tauri commands) and `listen` (to subscribe to Tauri events), typically sourced from `@tauri-apps/api` v1 or v2.

1.  **Initialization:** You call `initializeBridge` at the root of your app, passing your `invoke` and `listen` functions.
2.  **Backend Contract:** Your Rust backend still needs to expose specific Tauri commands (default: `__zubridge_get_initial_state`, `__zubridge_dispatch_action`) and emit a standard event (default: `__zubridge_state_update`) when state changes. See [Implementing the Rust Backend Contract](./docs/backend-process.md).
3.  **Frontend Hooks:** Zubridge React hooks (`useZubridgeStore`, `useZubridgeDispatch`) use the provided `invoke` and `listen` functions internally.
4.  **Internal Store:** `useZubridgeStore` uses an internal, frontend-only Zustand store as a synchronized replica of the backend state, populated initially via `invoke` and updated via `listen`.
5.  **Action Dispatch:** `useZubridgeDispatch` provides a function to send action objects to the Rust backend via the provided `invoke` function (targeting the `__zubridge_dispatch_action` command).

<img alt="zubridge tauri app architecture" src="https://raw.githubusercontent.com/goosewobbler/zubridge/main/resources/zubridge-tauri-app-architecture-v2.png"/>
_(Note: This diagram is outdated and needs updating to reflect the current architecture.)_

## Features

- Connect React frontend components to Rust backend state using Zustand-like hooks.
- **Supports both Tauri v1 and v2 APIs** via dependency injection.
- Simplifies state synchronization logic in the frontend.
- Type-safe interactions (when used with TypeScript).
- Automatic state synchronization across multiple windows.
- Clear separation between frontend state access and backend state logic.

## Installation

```bash
# Using npm
npm install @zubridge/tauri zustand react
# You also need your specific Tauri API package, e.g.:
npm install @tauri-apps/api # (for v2)
# or
npm install @tauri-apps/api@v1 # (for v1)

# Using yarn
yarn add @zubridge/tauri zustand react
# You also need your specific Tauri API package, e.g.:
yarn add @tauri-apps/api # (for v2)
# or
yarn add @tauri-apps/api@v1 # (for v1)

# Using pnpm
pnpm add @zubridge/tauri zustand react
# You also need your specific Tauri API package, e.g.:
pnpm add @tauri-apps/api # (for v2)
# or
pnpm add @tauri-apps/api@v1 # (for v1)
```

_Note: `zustand` and `react` are peer dependencies. You need to install the appropriate Tauri API package (`@tauri-apps/api` v1 or v2) yourself to provide the `invoke` and `listen` functions._

## Quick Start

1.  **Implement Backend Contract:** In your Tauri Rust application (`src-tauri/src/lib.rs`), define your state, manage it, and implement the required commands and event emission as detailed in the [Implementing the Rust Backend Contract](./docs/backend-process.md) guide.

2.  **Initialize Bridge in Frontend:** At the root of your React application (e.g., `main.tsx` or `App.tsx`), import and call `initializeBridge` once, passing the `invoke` and `listen` functions from your chosen Tauri API version.

    ```tsx
    // Example: src/main.tsx
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App';
    import { initializeBridge } from '@zubridge/tauri';
    import { invoke } from '@tauri-apps/api/core'; // Using v2 API
    import { listen } from '@tauri-apps/api/event'; // Using v2 API
    // OR for v1:
    // import { invoke } from '@tauri-apps/api/tauri';
    // import { listen } from '@tauri-apps/api/event';

    // Initialize Zubridge *before* rendering your app
    initializeBridge({ invoke, listen });

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    ```

3.  **Use Frontend Hooks:** In your React components, import and use the Zubridge hooks:

    ```tsx
    // Example: src/MyComponent.tsx
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
