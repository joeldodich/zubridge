# Frontend Process Guide

This guide explains how to use the `@zubridge/tauri` library in your frontend React application to interact with your Tauri Rust backend state.

## Accessing State with `useZubridgeStore`

The primary way to access the synchronized state from your Rust backend is the `useZubridgeStore` hook. It connects to an internal Zustand store that is kept up-to-date by listening to `__zubridge_state_update` events emitted by your Rust backend.

```typescript
import React from 'react';
import { useZubridgeStore } from '@zubridge/tauri';

// Assuming CounterState is your Rust state structure type
// defined in a shared types file or similar.
import type { CounterState } from '../types';

function CounterDisplay() {
  // Use a selector to get specific parts of the state.
  // Provide the expected type for the state slice.
  const counter = useZubridgeStore((state) => (state as CounterState).counter);

  // You can also get the bridge status (initializing, ready, error)
  const status = useZubridgeStore((state) => state.__zubridge_status);

  if (status !== 'ready') {
    return <div>Loading state ({status})...</div>;
  }

  // Handle cases where state might not be fully loaded yet
  return <div>Counter Value: {counter ?? 'N/A'}</div>;
}
```

**Key Points:**

- The hook automatically handles initialization (calling `__zubridge_get_initial_state` on first use) and listens for backend events (`__zubridge_state_update`).
- **Use Selectors:** For performance, always use selector functions (`state => state.someValue`) to extract only the parts of the state your component needs. This prevents unnecessary re-renders.
- **Type Safety:** Provide the expected type of your application's state when using selectors (e.g., `(state as CounterState).counter`) to get type checking and autocompletion, as the hook itself works with a generic `AnyState` internally.

## Dispatching Actions with `useZubridgeDispatch`

To trigger state changes in the Rust backend, use the `useZubridgeDispatch` hook to get a dispatch function.

```typescript
import React from 'react';
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';
import type { CounterState } from '../types';

function CounterControls() {
  // Get the dispatch function
  const dispatch = useZubridgeDispatch();
  const counter = useZubridgeStore((state) => (state as CounterState).counter);
  const status = useZubridgeStore((state) => state.__zubridge_status);

  if (status !== 'ready') {
      return <p>Initializing controls...</p>;
  }

  const handleIncrement = () => {
    // Dispatch an action object
    dispatch({ type: 'INCREMENT' });
  };

  const handleDecrement = () => {
    dispatch({ type: 'DECREMENT' });
  };

  const handleSet = (value: number) => {
    // Include payload when necessary
    dispatch({ type: 'SET_COUNTER', payload: value });
  };

  return (
    <div>
      <p>Current Count: {counter ?? 'N/A'}</p>
      <button onClick={handleDecrement}>Decrement (-)</button>
      <button onClick={handleIncrement}>Increment (+)</button>
      <button onClick={() => handleSet(0)}>Reset to 0</button>
    </div>
  );
}
```

**Key Points:**

- `useZubridgeDispatch` returns a single `dispatch` function.
- You **must** pass an action object with at least a `type` property:
  ```typescript
  type ZubridgeAction = {
    type: string;
    payload?: any; // Optional payload
  };
  ```
- The `dispatch` function sends this action object to your Rust backend by invoking the `__zubridge_dispatch_action` command.
- Your Rust command handler is responsible for interpreting the `type` and `payload` to update the state.

## State Synchronization

State synchronization is driven by the Rust backend.

1.  **Initial Load:** `useZubridgeStore` calls `__zubridge_get_initial_state` once to get the starting state.
2.  **Updates:** The hook listens for `__zubridge_state_update` events.
3.  **Backend Responsibility:** Your Rust code **must** emit the `__zubridge_state_update` event with the full, updated state payload **every time** the state changes.

This ensures all connected frontends receive the latest state consistently.

## Performance Considerations

- **Selectors are Key:** As mentioned, using specific selectors with `useZubridgeStore` is the most crucial performance optimization.
- **Backend Event Emission:** Ensure your Rust backend doesn't emit state updates excessively. Only emit when the state has actually changed.

## Multi-Window Interaction

State synchronization across multiple windows works automatically as long as:

1.  Your Rust backend emits `__zubridge_state_update` events using `app_handle.emit(...)`.
2.  Components in each window use the `useZubridgeStore` hook.

Each window's hook will independently listen for the broadcasted events and update its local state replica.

## Debugging

The library includes console logs (`Zubridge Tauri: ...`) for key events like initialization, state fetching, event listening, and action dispatching. Check your browser's developer console.

For component-level debugging, use `useEffect`:

```typescript
import React, { useEffect } from 'react';
import { useZubridgeStore } from '@zubridge/tauri';
import type { CounterState } from '../types';

function DebugCounter() {
  const counter = useZubridgeStore((state) => (state as CounterState).counter);
  const fullState = useZubridgeStore((state) => state);

  useEffect(() => {
    console.log('Counter changed:', counter);
    // Inspect the full synchronized state (includes internal status)
    console.log('Full Zubridge state:', fullState);
  }, [counter, fullState]); // Depend on the specific slice and/or full state

  return <div>Debug Counter: {counter ?? 'N/A'}</div>;
}
```
