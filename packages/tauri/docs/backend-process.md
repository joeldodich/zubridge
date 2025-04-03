# Backend Process

## Accessing the Store

In the backend process, you create and manage the central Zustand store that serves as the single source of truth for your application state.

```typescript
import { createStore } from 'zustand/vanilla';
import { backendZustandBridge } from '@zubridge/tauri/backend';

// Create a vanilla Zustand store
const store = createStore(() => ({
  counter: 0,
  todos: [],
  user: null,
}));

// Initialize the bridge
const bridge = await backendZustandBridge(store);
```

The `backendZustandBridge` function connects your store to the Tauri IPC system, enabling communication with frontend processes.

## Dispatching Actions

In the backend process, you can dispatch actions directly by manipulating the store:

```typescript
// Direct state manipulation
store.setState({ counter: 5 });

// Using immer-style updates
store.setState((state) => ({
  ...state,
  counter: state.counter + 1,
}));
```

## Configuring Action Handlers

There are several patterns for handling actions in the backend process:

### 1. Store-Based Methods

You can attach methods directly to your store state:

```typescript
const store = createStore(() => ({
  counter: 0,
  increment: () => store.setState((state) => ({ counter: state.counter + 1 })),
  decrement: () => store.setState((state) => ({ counter: state.counter - 1 })),
}));

// Methods are automatically accessible through dispatch
// e.g., dispatch('increment') from a frontend process
```

### 2. Separate Handlers

You can define handlers separately and provide them to the bridge:

```typescript
const handlers = {
  'COUNTER:INCREMENT': () => {
    const { counter } = store.getState();
    store.setState({ counter: counter + 1 });
  },
  'COUNTER:DECREMENT': () => {
    const { counter } = store.getState();
    store.setState({ counter: counter - 1 });
  },
  'COUNTER:SET': (payload) => {
    store.setState({ counter: payload });
  },
};

await backendZustandBridge(store, { handlers });
```

### 3. Reducer Pattern

For Redux-style state management, use a reducer:

```typescript
const initialState = { counter: 0 };

const reducer = (state, action) => {
  switch (action.type) {
    case 'COUNTER:INCREMENT':
      return { ...state, counter: state.counter + 1 };
    case 'COUNTER:DECREMENT':
      return { ...state, counter: state.counter - 1 };
    case 'COUNTER:SET':
      return { ...state, counter: action.payload };
    default:
      return state;
  }
};

await backendZustandBridge(store, { reducer });
```

## State Broadcasting

Zubridge automatically broadcasts state updates to all connected frontend processes. Each update includes metadata that can be useful for debugging:

```typescript
// State updates include metadata
const updateWithMetadata = {
  ...actualState,
  __meta: {
    updateId: 'unique-id',
    timestamp: Date.now(),
    sourceWindow: 'backend',
    reason: 'COUNTER:INCREMENT',
  },
};
```

This metadata helps track the origin and reason for state changes, especially in multi-window applications.

## Multi-Window Support

Zubridge automatically tracks windows and manages subscriptions. When a new window is created:

1. It's automatically subscribed to state updates
2. It receives the current state immediately
3. Any actions it dispatches are processed in the backend process

The bridge provides methods for working with windows:

```typescript
// Get a list of currently subscribed window labels
const subscribedWindows = bridge.getSubscribedWindows();

// Manually broadcast state to all windows
bridge.broadcastStateToAllWindows();

// Unsubscribe all windows and clean up when shutting down
window.addEventListener('beforeunload', () => {
  bridge.unsubscribe();
});
```

## Integration with Tauri Backend

Zubridge integrates with Tauri's backend process through commands and event listeners. The following Rust commands need to be implemented:

```rust
#[tauri::command]
fn get_state(state: tauri::State<'_, Mutex<serde_json::Value>>) -> Result<serde_json::Value, String> {
    // Implementation
}

#[tauri::command]
fn set_state(state: tauri::State<'_, Mutex<serde_json::Value>>, new_state: serde_json::Value) -> Result<(), String> {
    // Implementation
}

#[tauri::command]
async fn emit_action(app_handle: tauri::AppHandle, action: serde_json::Value) -> Result<(), String> {
    // Implementation
}
```

These commands allow the TypeScript code to interact with the Rust backend, ensuring state is properly synchronized across all processes and windows.
