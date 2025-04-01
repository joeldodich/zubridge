# Getting Started with @zubridge/electron

This guide will help you get started with using @zubridge/electron in your Electron application.

## Installation

```bash
npm install @zubridge/electron zustand
```

Or use your dependency manager of choice, e.g. `pnpm`, `yarn`.

## How it works

Zubridge creates a bridge between Electron's main and renderer processes using IPC (Inter-Process Communication). The bridge automatically synchronizes state changes between the main process and all renderer processes, ensuring that all windows stay in sync with the store.

## Basic Setup

### Create Store

First, create the Zustand store for your application using `zustand/vanilla` in the main process. If you are using TypeScript, provide your application state type:

```ts
// `src/main/store.ts`
import { createStore } from 'zustand/vanilla';
import type { AppState } from '../features/index.js';

const initialState: AppState = {
  counter: 0,
  ui: { ... }
};

// create app store
export const store = createStore<AppState>()(() => initialState);
```

### Initialize Bridge in Main Process

In the main process, instantiate the bridge with your store and an array of window or view objects. `BrowserWindow`, `BrowserView` and `WebContentsView` objects are supported.

```ts
// `src/main/index.ts`
import { app, BrowserWindow } from 'electron';
import { mainZustandBridge } from '@zubridge/electron/main';

// create main window
const mainWindow = new BrowserWindow({ ... });

// instantiate bridge
const { unsubscribe } = mainZustandBridge(store, [mainWindow]);

// unsubscribe on quit
app.on('quit', unsubscribe);
```

> **Note:** This example assumes your store handlers are located on the store object itself. For alternative approaches, such as separate handler functions or Redux-style reducers, see the [Main Process](./main-process.md#advanced-bridge-options) guide.

### Create Hook in Renderer Process

In the renderer process, create a hook to access the store:

```ts
// `src/renderer/hooks/useStore.ts`
import { createUseStore } from '@zubridge/electron';
import type { State } from '../../features/index.js';

// Create a hook to access the store
export const useStore = createUseStore<State>();
```

Then use the hook in your components:

```ts
// `src/renderer/App.tsx`
import { useStore } from './hooks/useStore.js';
import { useDispatch } from '@zubridge/electron';
import type { State } from '../features/index.js';

export function App() {
  const counter = useStore((state: State) => state.counter);
  const dispatch = useDispatch<State>();

  return (
    <div>
      <p>Counter: {counter}</p>
      <button onClick={() => dispatch('COUNTER:INCREMENT')}>Increment</button>
    </div>
  );
}
```

## Next Steps

For more advanced usage patterns and detailed examples:

- [Main Process](./main-process.md) - Learn about advanced bridge options, using `createDispatch`, and different handler patterns
- [Renderer Process](./renderer-process.md) - Explore different ways to use the hooks in your components
- [API Reference](./api-reference.md) - Complete reference for all API functions and types

## Example Applications

- [Basic Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-basic)
- [Reducers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-reducers)
- [Handlers Example](https://github.com/goosewobbler/zubridge/tree/main/apps/electron/example-handlers)
