# API Reference

This document provides a comprehensive reference for the `@zubridge/electron` API.

## Main Process

### `mainZustandBridge(store, windows, options?)`

Creates a bridge between the main process and renderer processes.

#### Parameters:

- `store`: The Zustand store to bridge
- `windows`: Array of `BrowserWindow`, `BrowserView`, or `WebContentsView` instances to subscribe to the store
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

#### Returns:

An object with:

- `unsubscribe(windows?)`: Function to unsubscribe windows from the store. When called without arguments, unsubscribes all windows and cleans up IPC handlers. When called with an array of windows, only unsubscribes those specific windows.
- `subscribe(windows)`: Function to subscribe additional windows to the store. Returns an object with an `unsubscribe` method.
- `getSubscribedWindows()`: Function to get all currently subscribed window IDs.

#### Example:

```ts
import { app, BrowserWindow } from 'electron';
import { mainZustandBridge } from '@zubridge/electron/main';
import { store } from './store';

const mainWindow = new BrowserWindow({
  /* options */
});
const { unsubscribe, subscribe, getSubscribedWindows } = mainZustandBridge(store, [mainWindow]);

// Later, subscribe a new window
const secondaryWindow = new BrowserWindow({
  /* options */
});
const subscription = subscribe([secondaryWindow]);

// Check which windows are subscribed
const subscribedWindowIds = getSubscribedWindows();
console.log('Subscribed windows:', subscribedWindowIds);

// Unsubscribe specific windows
unsubscribe([secondaryWindow]);

// Unsubscribe all windows and clean up when quitting
app.on('quit', () => unsubscribe());
```

### `createDispatch(store, options?)`

Creates a dispatch function that can be used in the main process to dispatch actions to the store.

#### Parameters:

- `store`: The Zustand store to dispatch actions to
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

#### Returns:

A function that can dispatch actions to the store.

#### Example:

```ts
import { createDispatch } from '@zubridge/electron/main';
import { store } from './store';
import { rootReducer } from '../features/index.js';

// Create dispatch with a reducer
export const dispatch = createDispatch(store, { reducer: rootReducer });

// Use the dispatch function
dispatch('COUNTER:INCREMENT');

// Dispatch with a payload
dispatch('SET_VALUE', 42);

// Dispatch an action object
dispatch({ type: 'SET_VALUE', payload: 42 });

// Dispatch a thunk function
dispatch((getState, dispatch) => {
  const currentState = getState();
  if (currentState.counter < 10) {
    dispatch('COUNTER:INCREMENT');
  }
});
```

## Renderer Process

### `createUseStore<State>()`

Function that creates a hook to access the store state in the renderer process.

#### Parameters:

- `State`: Type parameter representing your application state

#### Returns:

A hook that can be used to select state from the store.

#### Example:

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

### `useDispatch<State>()`

Hook to dispatch actions to the store from the renderer process.

#### Parameters:

- `State`: Type parameter representing your application state

#### Returns:

A dispatch function that can be used to send actions to the main process.

#### Example:

```ts
import { useDispatch } from '@zubridge/electron';
import type { AppState } from '../types';

function Counter() {
  const dispatch = useDispatch<AppState>();

  // Dispatch a string action
  const handleIncrement = () => dispatch('INCREMENT');

  // Dispatch an action object
  const handleCustomIncrement = (amount) => dispatch({
    type: 'INCREMENT_BY',
    payload: amount
  });

  return (
    <div>
      <button onClick={handleIncrement}>+1</button>
      <button onClick={() => handleCustomIncrement(5)}>+5</button>
    </div>
  );
}
```

## Type Definitions

### `Reducer<State>`

A Redux-style reducer function for handling actions.

```ts
type Reducer<State> = (state: State, action: Action) => State;
```

### `Action`

Represents a Redux-style action with a type and optional payload.

```ts
type Action = {
  type: string;
  payload?: unknown;
};
```

### `Thunk<State>`

Represents a thunk function for handling asynchronous logic.

```ts
type Thunk<State> = (
  getState: () => State,
  dispatch: (action: string | Action, payload?: unknown) => unknown,
) => unknown;
```

### `MainZustandBridgeOpts<State>`

Configuration options for the main process bridge.

```ts
type MainZustandBridgeOpts<State> = {
  handlers?: Record<string, (payload?: unknown) => unknown>;
  reducer?: Reducer<State>;
};
```

### `WebContentsWrapper`

Represents any Electron object that has WebContents.

```ts
type WebContentsWrapper = {
  webContents: WebContents;
  isDestroyed: () => boolean;
};
```
