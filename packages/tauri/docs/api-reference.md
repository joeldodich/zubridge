# API Reference

This document provides a comprehensive reference for the `@zubridge/tauri` API.

## Backend Process

### `backendZustandBridge(store, options?)`

Creates a bridge between the Tauri backend process and frontend processes.

#### Parameters:

- `store`: The Zustand store to bridge
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

#### Returns:

An object with:

- `unsubscribe()`: Function to unsubscribe all frontends from the store and clean up event listeners.
- `getSubscribedWindows()`: Function to get all currently subscribed window labels.
- `broadcastStateToAllWindows(state?)`: Function to manually broadcast state to all windows. If state is not provided, it uses the current store state.

#### Example:

```ts
import { createStore } from 'zustand/vanilla';
import { backendZustandBridge } from '@zubridge/tauri/backend';
import { store } from './store';

// Define your state
const store = createStore({ counter: 0 });

// Initialize the bridge
const { unsubscribe, getSubscribedWindows, broadcastStateToAllWindows } = await backendZustandBridge(store);

// Check which windows are subscribed
const subscribedWindowLabels = getSubscribedWindows();
console.log('Subscribed windows:', subscribedWindowLabels);

// Manually broadcast state to all windows if needed
broadcastStateToAllWindows();

// Unsubscribe all windows and clean up when quitting
window.addEventListener('beforeunload', () => unsubscribe());
```

### `createDispatch(store, options?)`

Creates a dispatch function that can be used in the backend process to dispatch actions to the store.

#### Parameters:

- `store`: The Zustand store to dispatch actions to
- `options`: Optional configuration object
  - `handlers`: Optional object containing store handler functions
  - `reducer`: Optional root reducer function for Redux-style state management

#### Returns:

A function that can dispatch actions to the store.

#### Example:

```ts
import { createDispatch } from '@zubridge/tauri/backend';
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

## Frontend Process

### `createUseStore<State>()`

Function that creates a hook to access the store state in the frontend process.

#### Parameters:

- `State`: Type parameter representing your application state

#### Returns:

A hook that can be used to select state from the store and a dispatch function.

#### Example:

```ts
// hooks/useStore.ts
import { createUseStore } from '@zubridge/tauri';
import type { AppState } from '../types';

export const useStore = createUseStore<AppState>();
export const { dispatch } = useStore;

// Component.tsx
import { useStore, dispatch } from './hooks/useStore';

function Counter() {
  const counter = useStore(state => state.counter);

  return (
    <div>
      <p>{counter}</p>
      <button onClick={() => dispatch('COUNTER:INCREMENT')}>Increment</button>
    </div>
  );
}
```

### Frontend Handlers

The frontend process includes several built-in handlers for communicating with the backend:

#### `getState()`

Fetches the current state from the backend process.

```ts
import { getState } from '@zubridge/tauri/frontend';

// Get the entire state
const state = await getState();
console.log('Current state:', state);
```

#### `subscribe(callback)`

Subscribes to state updates from the backend process.

```ts
import { subscribe } from '@zubridge/tauri/frontend';

// Subscribe to state updates
const unsubscribe = subscribe((newState) => {
  console.log('State updated:', newState);
});

// Later, unsubscribe
unsubscribe();
```

#### `dispatch(action, payload?)`

Dispatches an action to the backend process.

```ts
import { dispatch } from '@zubridge/tauri/frontend';

// Dispatch a string action
await dispatch('COUNTER:INCREMENT');

// Dispatch with a payload
await dispatch('COUNTER:SET', 42);

// Dispatch an action object
await dispatch({ type: 'COUNTER:SET', payload: 42 });
```

## Type Definitions

### `AnyState`

Represents any object that can be used as state.

```ts
type AnyState = Record<string, any>;
```

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

### `BackendZustandBridgeOpts<State>`

Configuration options for the backend process bridge.

```ts
type BackendZustandBridgeOpts<State> = {
  handlers?: Record<string, (payload?: unknown) => unknown>;
  reducer?: Reducer<State>;
};
```

### `StateMetadata`

Metadata included with each state update.

```ts
type StateMetadata = {
  updateId: string;
  timestamp: number;
  sourceWindow: string;
  reason?: string;
};
```

## Rust API

The Tauri backend includes Rust functions for interacting with the state:

### `get_state`

Retrieves the current state from the Tauri backend.

```rust
#[tauri::command]
fn get_state(state: tauri::State<'_, Mutex<serde_json::Value>>) -> Result<serde_json::Value, String>;
```

### `set_state`

Sets the state in the Tauri backend.

```rust
#[tauri::command]
fn set_state(state: tauri::State<'_, Mutex<serde_json::Value>>, new_state: serde_json::Value) -> Result<(), String>;
```

### `update_state`

Updates specific properties of the state.

```rust
#[tauri::command]
fn update_state(state: tauri::State<'_, Mutex<serde_json::Value>>, update: serde_json::Value) -> Result<(), String>;
```

### Event Handling

Zubridge uses Tauri's event system for state synchronization:

- `zubridge-tauri:state-update`: Event emitted when state is updated
- `zubridge-tauri:action`: Event emitted when an action is dispatched
- `zubridge-tauri:subscribe`: Event emitted when a window subscribes to state updates
