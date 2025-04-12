# API Reference

This document provides a comprehensive reference for the `@zubridge/tauri` API.

## Frontend Hooks and Functions

This library provides hooks and utilities to interact with a Tauri Rust backend that adheres to the defined Zubridge backend contract. It manages a frontend Zustand store as a synchronized replica of the backend state.

### `useZubridgeStore<StateSlice>(selector, equalityFn?)`

React hook to select state from the synchronized frontend store.

#### Parameters:

- `selector`: `(state: InternalState) => StateSlice`
  A function to pick data from the store. The `state` argument includes internal properties (`__zubridge_status`, `__zubridge_error`) alongside your application state fields.
- `equalityFn`: `(a: StateSlice, b: StateSlice) => boolean` (Optional)
  A function to compare the selected state slice for changes. Defaults to React's default shallow equality check.

#### Returns:

- `StateSlice`: The selected state slice.

#### Example:

```tsx
import { useZubridgeStore } from '@zubridge/tauri';
import type { CounterState } from '../types'; // Your app's state type

function CounterDisplay() {
  // Select the counter value, casting the state argument
  const counter = useZubridgeStore((state) => (state as CounterState).counter);
  const status = useZubridgeStore((state) => state.__zubridge_status);

  if (status !== 'ready') return <p>Loading...</p>;
  return <p>Counter: {counter ?? 'N/A'}</p>;
}
```

### `useZubridgeDispatch()`

React hook to get the dispatch function for sending actions to the backend.

#### Returns:

- `dispatch`: `(action: ZubridgeAction) => Promise<void>`
  A function that takes a `ZubridgeAction` object and sends it to the Rust backend via the `__zubridge_dispatch_action` command.

#### Example:

```tsx
import { useZubridgeDispatch } from '@zubridge/tauri';

function CounterButtons() {
  const dispatch = useZubridgeDispatch();

  const handleIncrement = () => {
    // Dispatch an action object
    dispatch({ type: 'INCREMENT' });
  };
  const handleSet = (value: number) => {
    dispatch({ type: 'SET_COUNTER', payload: value });
  };

  return (
    <>
      <button onClick={handleIncrement}>+</button>
      <button onClick={() => handleSet(0)}>Reset</button>
    </>
  );
}
```

### `getState(): Promise<AnyState>`

Directly invokes the `get_state` command on the Rust backend to fetch the current state.

_Note: This function assumes your backend implements a `get_state` command consistent with the example project. It bypasses the synchronized internal store._

#### Returns:

- A Promise resolving to the application state.

### `updateState(state: AnyState): Promise<void>`

Directly invokes the `update_state` command on the Rust backend.

_Note: This function assumes your backend implements an `update_state` command consistent with the example project. Use with caution as it bypasses the action flow._

#### Parameters:

- `state`: The complete state object to send to the backend.

#### Returns:

- A Promise resolving when the command completes.

### `cleanupZubridge(): void`

Cleans up the Tauri event listener used for state synchronization and resets the internal bridge status. Useful mainly for testing or specific application teardown scenarios.

## Type Definitions

### `AnyState`

Represents any plain JavaScript object that can be used as state.

```ts
import type { AnyState } from '@zubridge/types';
// type AnyState = Record<string, any>; // Effective definition
```

### `ZubridgeAction`

Represents the action structure sent to the backend `__zubridge_dispatch_action` command.

```ts
export type ZubridgeAction = {
  type: string;
  payload?: any; // Corresponds to Rust's serde_json::Value
};
```

### `InternalState` (Exported for Testing)

Represents the shape of the internal Zustand store, including Zubridge status flags alongside the application state.

```ts
export type InternalState = AnyState & {
  __zubridge_status: 'initializing' | 'ready' | 'error' | 'uninitialized';
  __zubridge_error?: any;
};
```

## Required Rust Backend Contract (Summary)

Your Tauri Rust backend **must** implement the following contract for the frontend library to function correctly. See `docs/getting-started.md` for a detailed implementation example.

### Required Commands:

- `__zubridge_get_initial_state()`
  - **Purpose:** Provide the initial state to the frontend on load.
  - **Returns:** `Result<YourStateType, String>` (Replace `YourStateType` with your actual Rust state struct, e.g., `CounterState`)
- `__zubridge_dispatch_action(action: ZubridgeAction)`
  - **Purpose:** Receive and process actions from the frontend.
  - **Input Struct:**
    ```rust
    #[derive(serde::Deserialize)]
    pub struct ZubridgeAction {
        #[serde(rename = "type")]
        action_type: String,
        payload: Option<serde_json::Value>,
    }
    ```
  - **Returns:** `Result<(), String>`
  - **Must Emit:** `__zubridge_state_update` event after successful state mutation.

### Required Event:

- `__zubridge_state_update`
  - **Purpose:** Notify frontends about state changes.
  - **Payload:** The _complete, current_ state (`YourStateType`) serialized.
  - **Emission:** Must be emitted via `app_handle.emit(...)` **every time** the authoritative Rust state changes.
