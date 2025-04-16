# API Reference

This document provides a comprehensive reference for the `@zubridge/electron` API.

## Backend (Main Process) APIs

### Bridge APIs

#### `createGenericBridge(stateManager, windows)`

Creates a generic bridge between the main process and renderer processes, using any state manager that implements the `StateManager` interface.

##### Parameters:

- `stateManager`: Implementation of the `StateManager<State>` interface
- `windows`: Array of `BrowserWindow`, `BrowserView`, or `WebContentsView` instances to subscribe to the store

##### Returns:

A `GenericBridge` object with:

- `subscribe(windows)`: Function to subscribe additional windows to the state updates. Returns an object with an `unsubscribe` method.
- `unsubscribe(windows?)`: Function to unsubscribe windows from updates. When called without arguments, unsubscribes all windows.
- `getSubscribedWindows()`: Function to get all currently subscribed window IDs.
- `destroy()`: Function to clean up resources used by the bridge.

##### Example:

```ts
import { app, BrowserWindow } from 'electron';
import { createGenericBridge } from '@zubridge/electron/main';
import { myStateManager } from './state-manager';

const mainWindow = new BrowserWindow({
  /* options */
});
const { unsubscribe, subscribe } = createGenericBridge(myStateManager, [mainWindow]);

// Unsubscribe when quitting
app.on('quit', unsubscribe);
```

#### `createZustandBridge(store, windows, options?)`

Creates a bridge between a Zustand store in the main process and renderer processes. This is an adapter that converts a Zustand store to implement the `StateManager` interface internally.

##### Parameters:

- `store`: The Zustand store to bridge
- `windows`: Array of `BrowserWindow`, `BrowserView`, or `WebContentsView` instances to subscribe to the store
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

##### Returns:

A `ZustandBridge` object with:

- `subscribe(windows)`: Function to subscribe additional windows to the store updates. Returns an object with an `unsubscribe` method.
- `unsubscribe(windows?)`: Function to unsubscribe windows from the store. When called without arguments, unsubscribes all windows.
- `getSubscribers()`: Function to get all currently subscribed window IDs.
- `getSubscribedWindows()`: Alias for `getSubscribers()`.
- `destroy()`: Function to clean up resources used by the bridge.

##### Example:

```ts
import { app, BrowserWindow } from 'electron';
import { createZustandBridge } from '@zubridge/electron/main';
import { store } from './store';

const mainWindow = new BrowserWindow({
  /* options */
});
const { unsubscribe, subscribe } = createZustandBridge(store, [mainWindow]);

// Using with handlers option
createZustandBridge(store, [mainWindow], {
  handlers: {
    CUSTOM_ACTION: (payload) => {
      console.log('Custom action received:', payload);
      store.setState((state) => ({ ...state, customValue: payload }));
    },
  },
});

// Using with reducer option
createZustandBridge(store, [mainWindow], {
  reducer: (state, action) => {
    switch (action.type) {
      case 'SET_VALUE':
        return { ...state, value: action.payload };
      default:
        return state;
    }
  },
});

// Unsubscribe when quitting
app.on('quit', unsubscribe);
```

#### `mainZustandBridge(store, windows, options?)` (Deprecated)

**Deprecated:** This is now an alias for `createZustandBridge` and uses the new IPC channels. Please migrate to `createZustandBridge`.

##### Parameters and returns:

Same as `createZustandBridge`.

#### `createZustandAdapter(store, options?)`

Creates a Zustand adapter that implements the `StateManager` interface. This is used internally by `createZustandBridge`.

##### Parameters:

- `store`: The Zustand store to adapt
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

##### Returns:

A `StateManager<State>` implementation that wraps the Zustand store.

##### Example:

```ts
import { createZustandAdapter, createGenericBridge } from '@zubridge/electron/main';
import { store } from './store';

// Create an adapter for a Zustand store
const stateManager = createZustandAdapter(store);

// Use the adapter with the generic bridge
const bridge = createGenericBridge(stateManager, [mainWindow]);
```

### Dispatch APIs

#### `createDispatch(store, options?)`

Creates a dispatch function that can be used in the main process to dispatch actions to the store.

##### Parameters:

- `store`: The Zustand store to dispatch actions to
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

##### Returns:

A function that can dispatch actions to the store.

##### Example:

```ts
import { createDispatch } from '@zubridge/electron/main';
import { store } from './store';
import { rootReducer } from '../features/index.js';

// Create dispatch with a reducer
export const dispatch = createDispatch(store, { reducer: rootReducer });

// Use the dispatch function
dispatch('INCREMENT');

// Dispatch with a payload
dispatch('SET_VALUE', 42);

// Dispatch an action object
dispatch({ type: 'SET_VALUE', payload: 42 });

// Dispatch a thunk function
dispatch((getState, dispatch) => {
  const currentState = getState();
  if (currentState.counter < 10) {
    dispatch('INCREMENT');
  }
});
```

## Frontend (Renderer Process) APIs

### Preload Script APIs

#### `preloadBridge()`

Creates handlers for the renderer process to interact with the main process through the backend contract.

##### Returns:

An object with a `handlers` property that should be exposed to the renderer process.

##### Example:

```ts
// preload.js
import { contextBridge } from 'electron';
import { preloadBridge } from '@zubridge/electron/preload';

const { handlers } = preloadBridge();

// Expose the handlers to the renderer process
contextBridge.exposeInMainWorld('zubridge', handlers);
```

#### `preloadZustandBridge()` (Deprecated)

**Deprecated:** This is now an alias for `preloadBridge` and uses the new IPC channels. Please migrate to `preloadBridge`.

##### Returns:

Same as `preloadBridge`.

### Renderer Process Hooks

#### `createUseStore<State>(customHandlers?)`

Function that creates a hook to access the store state in the renderer process.

##### Parameters:

- `customHandlers`: Optional custom handlers to use instead of `window.zubridge`
- `State`: Type parameter representing your application state

##### Returns:

A hook that can be used to select state from the store.

##### Example:

```ts
// hooks/useStore.ts
import { createUseStore } from '@zubridge/electron';
import type { AppState } from '../types';

export const useStore = createUseStore<AppState>();

// Component.tsx
import { useStore } from './hooks/useStore';

function Counter() {
  const counter = useStore(state => state.counter);
  return <div>{counter}</div>;
}
```

#### `useDispatch<State>(customHandlers?)`

Hook to dispatch actions to the store from the renderer process.

##### Parameters:

- `customHandlers`: Optional custom handlers to use instead of `window.zubridge`
- `State`: Type parameter representing your application state

##### Returns:

A dispatch function that can be used to send actions to the main process.

##### Example:

```ts
import { useDispatch } from '@zubridge/electron';
import type { AppState } from '../types';

function Counter() {
  const dispatch = useDispatch<AppState>();

  // Dispatch a string action
  const handleIncrement = () => dispatch('INCREMENT');

  // Dispatch an action with payload
  const handleSetCounter = (value) => dispatch('SET_COUNTER', value);

  // Dispatch an action object
  const handleCustomIncrement = (amount) => dispatch({
    type: 'INCREMENT_BY',
    payload: amount
  });

  return (
    <div>
      <button onClick={handleIncrement}>+1</button>
      <button onClick={() => handleSetCounter(0)}>Reset</button>
      <button onClick={() => handleCustomIncrement(5)}>+5</button>
    </div>
  );
}
```

## Type Definitions and Interfaces

### `StateManager<State>`

Interface that defines the contract for state managers used with the generic bridge.

```ts
interface StateManager<State> {
  getState: () => State;
  subscribe: (listener: (state: State) => void) => () => void;
  processAction: (action: Action) => void;
}
```

### `GenericBridge`

Interface for the bridge created by `createGenericBridge`.

```ts
interface GenericBridge {
  subscribe: (wrappers: WebContentsWrapper[]) => { unsubscribe: () => void };
  unsubscribe: (wrappers?: WebContentsWrapper[]) => void;
  getSubscribedWindows: () => number[];
  destroy: () => void;
}
```

### `ZustandBridge`

Interface for the bridge created by `createZustandBridge`.

```ts
interface ZustandBridge extends Omit<BaseBridge<number>, 'getSubscribedWindows'> {
  subscribe: (wrappers: WebContentsWrapper[]) => { unsubscribe: () => void };
  unsubscribe: (wrappers?: WebContentsWrapper[]) => void;
  getSubscribers: () => number[];
  getSubscribedWindows: () => number[];
  destroy: () => void;
}
```

### `Action`

Represents a Redux-style action with a type and optional payload.

```ts
type Action<T extends string = string> = {
  type: T;
  payload: unknown;
};
```

### `Thunk<State>`

Represents a thunk function for handling asynchronous logic.

```ts
type Thunk<State> = (getState: StoreApi<State>['getState'], dispatch: Dispatch<State>) => void;
```

### `MainZustandBridgeOpts<State>`

Configuration options for the Zustand bridge.

```ts
type MainZustandBridgeOpts<State extends AnyState> = {
  handlers?: Record<string, Handler>;
  reducer?: RootReducer<State>;
};
```

### `WebContentsWrapper`

Represents any Electron object that has WebContents.

```ts
interface WebContentsWrapper {
  webContents: WebContents;
  isDestroyed(): boolean;
}
```

### `Handlers<State>`

Interface for the handlers exposed to the renderer process.

```ts
interface Handlers<State extends AnyState> extends BaseHandler<State> {
  getState(): Promise<State>;
  subscribe(callback: (newState: State) => void): () => void;
}
```
