# API Reference

This document provides a comprehensive reference for the `@zubridge/tauri` API.

## Initialization

### `initializeBridge(options: ZubridgeTauriOptions): void`

Initializes the Zubridge communication layer. **Must be called once** at the root of your application before any Zubridge hooks are used.

#### Parameters:

- `options`: `ZubridgeTauriOptions` - An object containing:
  - `invoke`: `(cmd: string, args?: Record<string, unknown>) => Promise<any>` - The function to use for calling Tauri commands (e.g., from `@tauri-apps/api/core` or `@tauri-apps/api/tauri`).
  - `listen`: `<T>(event: string, handler: TauriEventHandler<T>) => Promise<TauriUnlistenFn>` - The function to use for listening to Tauri events (e.g., from `@tauri-apps/api/event`).
  - `getInitialStateCommand?`: `string` (Optional) - The name of the Tauri command to invoke for fetching the initial state. Defaults to `__zubridge_get_initial_state`.
  - `dispatchActionCommand?`: `string` (Optional) - The name of the Tauri command to invoke for dispatching actions. Defaults to `__zubridge_dispatch_action`.
  - `stateUpdateEvent?`: `string` (Optional) - The name of the Tauri event to listen for state updates. Defaults to `__zubridge_state_update`.

#### Example:

```typescript
import { initializeBridge } from '@zubridge/tauri';
import { invoke } from '@tauri-apps/api/core'; // v2 example
import { listen } from '@tauri-apps/api/event'; // v2 example

initializeBridge({ invoke, listen });
```

## Frontend Hooks and Functions

These hooks and utilities interact with a Tauri Rust backend via the `invoke` and `listen` functions provided during `initializeBridge`.

### `useZubridgeStore<StateSlice>(selector, equalityFn?)`

React hook to select state from the synchronized frontend store. Relies on the listener set up via the `listen` function provided during initialization.

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

React hook to get the dispatch function for sending actions to the backend. Uses the `invoke` function provided during initialization.

#### Returns:

- `dispatch`: `(action: ZubridgeAction) => Promise<void>`
  A function that takes a `ZubridgeAction` object and sends it to the Rust backend via the provided `invoke` function (targeting the configured dispatch command).

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

**Deprecated / Internal Use:** Directly invokes the configured `getInitialStateCommand` on the Rust backend using the provided `invoke` function.

_Note: Prefer using `useZubridgeStore` to access state. This function bypasses the synchronized internal store and might not be needed for typical application code._

#### Returns:

- A Promise resolving to the application state fetched directly from the backend.

### `updateState(state: AnyState): Promise<void>`

**Removed / Not Applicable:** This function is not part of the current contract-based API. State updates must originate from the backend and be emitted via events.

### `cleanupZubridge(): Promise<void>`

Cleans up the Tauri event listener (using the provided `listen` function's unlisten capability) and resets the internal bridge status. Returns a Promise that resolves when the unlisten function completes.

_Note: Primarily useful for testing or specific application teardown scenarios where the listener needs to be manually stopped._

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

### `ZubridgeTauriOptions`

```typescript
export type TauriEventHandler<T> = (event: { payload: T; [key: string]: any }) => void;
export type TauriUnlistenFn = () => void;

export interface ZubridgeTauriOptions {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<any>;
  listen: <T>(event: string, handler: TauriEventHandler<T>) => Promise<TauriUnlistenFn>;
  getInitialStateCommand?: string; // defaults to '__zubridge_get_initial_state'
  dispatchActionCommand?: string; // defaults to '__zubridge_dispatch_action'
  stateUpdateEvent?: string; // defaults to '__zubridge_state_update'
}
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
