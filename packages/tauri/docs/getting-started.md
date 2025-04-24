# Getting Started with @zubridge/tauri

## Installation

Install the frontend library and its peer dependencies:

```bash
# Using npm
npm install @zubridge/tauri zustand @tauri-apps/api

# Using yarn
yarn add @zubridge/tauri zustand @tauri-apps/api

# Using pnpm
pnpm add @zubridge/tauri zustand @tauri-apps/api
```

_Note: While the hooks in this library use React-style naming conventions (`useZubridgeStore`, `useZubridgeDispatch`), they can be used with any JavaScript framework or vanilla JavaScript. The core functionality relies on Zustand's framework-agnostic store system._

## Core Concepts

`@zubridge/tauri` bridges your Tauri Rust backend state with your frontend JavaScript/TypeScript application using hooks that can be used with React or other frameworks.

1.  **Rust Backend State:** Your application's authoritative state lives in your Rust backend, typically managed using `tauri::State` and Mutexes or other synchronization primitives.
2.  **Communication Contract:** The frontend library expects the Rust backend to expose specific Tauri commands and events:
    - Command: `__zubridge_get_initial_state()` - Returns the entire current state.
    - Command: `__zubridge_dispatch_action(action: ZubridgeAction)` - Receives an action from the frontend to process.
    - Event: `__zubridge_state_update` - Emitted by the Rust backend _after_ the state changes, containing the _new_ complete state.
3.  **Frontend Hooks:**
    - `useZubridgeStore`: A hook to access the state replica synchronized from the backend.
    - `useZubridgeDispatch`: A hook to get a function for dispatching actions to the backend `__zubridge_dispatch_action` command.
4.  **State Synchronization:** The library listens for `__zubridge_state_update` events from the Rust backend and updates an internal Zustand store replica used by `useZubridgeStore`.

## Framework Compatibility

Despite the `use` prefix in the hook names, the core functionality of Zubridge is framework-agnostic:

- **React**: Works seamlessly with React components (examples in this guide use React)
- **Other Frameworks**: Can be used with Vue, Svelte, Angular, or any JavaScript framework
- **Vanilla JS**: Can be used in plain JavaScript without any framework

The hooks are built on Zustand, which itself supports non-React usage patterns through its vanilla store API.

## Quick Start

### 1. Implement the Backend Contract in Rust

In your Tauri application's Rust code (`src-tauri/src/lib.rs` or similar):

- Define your application's state struct (e.g., `AppState`).
- Manage the state using `tauri::State` and `Mutex`.
- Implement the `__zubridge_get_initial_state` command.
- Implement the `__zubridge_dispatch_action` command, which should:
  - Modify the Rust state based on the received action.
  - Emit the `__zubridge_state_update` event with the **new, complete state** after modification.
- Ensure **all** modifications to your Rust state (whether via the dispatch command or other commands) consistently emit the `__zubridge_state_update` event.

```rust
// src-tauri/src/lib.rs (Example)
use tauri::{State, Manager, Emitter}; // Added Emitter
use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use serde_json::Value as AnyState; // Or use your specific action payload type

// 1. Define your state
#[derive(Serialize, Deserialize, Clone, Debug, Default)] // Ensure it can be serialized and cloned for events
pub struct CounterState {
    counter: i32,
}

// Wrapper for Tauri state management
pub struct AppState(pub Mutex<CounterState>);

// 2. Define the Action structure expected from the frontend
#[derive(Deserialize, Debug)]
pub struct ZubridgeAction {
    #[serde(rename = "type")]
    action_type: String,
    payload: Option<AnyState>,
}

// 3. Implement the required commands

#[tauri::command]
fn __zubridge_get_initial_state(state: State<'_, AppState>) -> Result<CounterState, String> {
    println!("Rust: Received request for initial state.");
    state.0.lock()
        .map(|locked_state| locked_state.clone()) // Clone the state to return
        .map_err(|e| format!("Failed to lock state mutex: {}", e))
}

#[tauri::command]
fn __zubridge_dispatch_action(
    action: ZubridgeAction,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle, // Inject AppHandle to emit events
) -> Result<(), String> {
    println!("Rust: Received action: {:?}", action);

    let mut locked_state = state.0.lock().map_err(|e| format!("Failed to lock state mutex: {}", e))?;

    // --- Modify State based on action ---
    match action.action_type.as_str() {
        "INCREMENT" => {
            locked_state.counter += 1;
            println!("Rust: Incremented counter to {}", locked_state.counter);
        },
        "DECREMENT" => {
            locked_state.counter -= 1;
            println!("Rust: Decremented counter to {}", locked_state.counter);
        },
        "SET_COUNTER" => {
             if let Some(payload) = action.payload {
                 if let Ok(value) = serde_json::from_value::<i32>(payload) {
                    locked_state.counter = value;
                     println!("Rust: Set counter to {}", value);
                 } else {
                    return Err("Invalid payload for SET_COUNTER: Expected an integer.".to_string());
                 }
             } else {
                return Err("Missing payload for SET_COUNTER.".to_string());
             }
        },
        _ => {
            println!("Rust: Received unknown action type '{}'", action.action_type);
            // Optionally return an error for unhandled actions
        },
    }
    // --- End Modify State ---

    // --- Emit State Update ---
    // Clone the *current* state after mutation
    let current_state_clone = locked_state.clone();
    // Drop the lock *before* emitting
    drop(locked_state);

    println!("Rust: Emitting state update event with state: {:?}", current_state_clone);
    // Emit the full state object using the specific event name
    if let Err(e) = app_handle.emit("__zubridge_state_update", current_state_clone) {
        eprintln!("Rust: Error emitting state update event: {}", e);
    }
    // --- End Emit State Update ---

    Ok(())
}

// Example: Another command that modifies state MUST also emit the update
#[tauri::command]
fn reset_counter_externally(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut locked_state = state.0.lock().map_err(|e| format!("Failed to lock state mutex: {}", e))?;
    locked_state.counter = 0;
    let current_state_clone = locked_state.clone();
    drop(locked_state);
    // IMPORTANT: Emit update after any state change
    let _ = app_handle.emit("__zubridge_state_update", current_state_clone);
    Ok(())
}


fn main() {
    let initial_state = AppState(Mutex::new(CounterState::default()));

    tauri::Builder::default()
        .manage(initial_state) // Manage your state
        .invoke_handler(tauri::generate_handler![
            __zubridge_get_initial_state,
            __zubridge_dispatch_action,
            reset_counter_externally // Register all commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

_**Important:** Your Rust code **must** emit the `__zubridge_state_update` event with the full, updated state payload **every time** the state changes, regardless of how it was changed (via `__zubridge_dispatch_action` or any other command)._

### 2. Initialize Bridge in Frontend

At the root of your application, call `initializeBridge` once, passing the `invoke` and `listen` functions from your chosen Tauri API version.

```tsx
// Example using React
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

// Example using vanilla JavaScript
// document.addEventListener('DOMContentLoaded', () => {
//   const { invoke } = window.__TAURI__.tauri;
//   const { listen } = window.__TAURI__.event;
//
//   initializeBridge({ invoke, listen });
//
//   // Your app initialization code...
// });
```

### 3. Use the Hooks in Your Frontend Components

Import and use the `useZubridgeStore` and `useZubridgeDispatch` hooks in your components.

```

```
