# Implementing the Rust Backend Contract

This document details the contract your Tauri Rust backend must fulfill to integrate with the `@zubridge/tauri` frontend library. This architecture assumes the Rust backend holds the authoritative application state, and the frontend Zustand store acts as a synchronized replica.

## Overview

The core idea is to standardize communication:

1.  **Backend State:** Your authoritative state lives in Rust, managed likely via `tauri::State` and `std::sync::Mutex` or `RwLock`.
2.  **Frontend Replica:** The `@zubridge/tauri` library manages a Zustand store in the frontend.
3.  **Synchronization:**
    - The frontend fetches the initial state using a specific command.
    - The backend emits a specific event whenever its state changes.
    - The frontend listens for this event to update its replica store.
    - The frontend sends user actions to the backend using a specific command.

## 1. Required State Structure

While your internal Rust state struct (e.g., `ActualState` below) can be typed as needed, it **must** be wrapped or handled such that it can be serialized to and deserialized from `serde_json::Value` for communication via the contract.

```rust
use serde::{Serialize, Deserialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Debug, Default, Clone)] // Implement necessary traits
pub struct ActualState {
    // Your state fields, e.g.:
    counter: i32,
    // other_data: String,
}

// Example Tauri managed state wrapper
pub struct YourBackendState(pub Mutex<ActualState>); // Or RwLock

// You will register this with Tauri: builder.manage(YourBackendState(Mutex::new(ActualState::default())))
```

## 2. Required Tauri Commands

Implement and register these commands using `tauri::Builder::invoke_handler`.

### a) `__zubridge_get_initial_state()`

Fetches the current state for frontend initialization.

- **Signature (Rust):**
  ```rust
  #[tauri::command]
  fn __zubridge_get_initial_state(state: tauri::State<'_, YourBackendState>) -> Result<serde_json::Value, String> {
      match state.inner().0.lock() { // Access the Mutex inside YourBackendState
          Ok(locked_state) => {
              match serde_json::to_value(&*locked_state) {
                  Ok(value) => {
                      println!("Backend Contract: Returning initial state: {:?}", value);
                      Ok(value)
                  },
                  Err(e) => Err(format!("Failed to serialize state: {}", e)),
              }
          },
          Err(e) => Err(format!("Failed to lock state: {}", e.to_string())),
      }
  }
  ```
- **Return:** `Result<serde_json::Value, String>` containing the full current state as JSON.

### b) `__zubridge_dispatch_action(action: ZubridgeAction)`

Receives actions from the frontend, mutates state, and emits the update event.

- **Required Action Struct (Rust):** Define this struct (or import from a potential `zubridge-core-rust` crate).

  ```rust
  #[derive(Debug, serde::Deserialize, Clone)]
  pub struct ZubridgeAction {
      #[serde(rename = "type")]
      pub action_type: String,
      pub payload: Option<serde_json::Value>, // Payload is flexible JSON
  }
  ```

- **Signature (Rust):**

  ```rust
  use tauri::{Manager, Emitter}; // Need Manager for state, Emitter for emit

  #[tauri::command]
  fn __zubridge_dispatch_action(
      action: ZubridgeAction,
      state: tauri::State<'_, YourBackendState>, // Your managed state type
      app_handle: tauri::AppHandle           // To emit events
  ) -> Result<(), String> {
      println!("Backend Contract: Received action: {:?}", action);

      // 1. Lock state for mutation
      let mut locked_state = match state.inner().0.lock() {
          Ok(guard) => guard,
          Err(e) => return Err(format!("Failed to lock state for dispatch: {}", e.to_string())),
      };

      // 2. --- Your State Mutation Logic ---
      // Apply changes based on action.action_type & action.payload
      // This is where your 'basic', 'handlers', or 'reducers' logic lives in Rust.
      match action.action_type.as_str() {
          "INCREMENT" => {
              locked_state.counter += 1; // Example for ActualState having 'counter'
              println!("Backend Contract: Incremented counter to {}", locked_state.counter);
          }
          "DECREMENT" => {
              locked_state.counter -= 1;
              println!("Backend Contract: Decremented counter to {}", locked_state.counter);
          }
          // Add cases for other actions your application needs
          _ => {
              println!("Backend Contract: Unknown action type received: {}", action.action_type);
              // Decide whether to ignore or return an error
          }
      }
      // --- End State Mutation Logic ---

      // 3. Serialize the *new* state
      let new_state_value = match serde_json::to_value(&*locked_state) {
           Ok(value) => value,
           Err(e) => {
               // Log error but don't necessarily fail the command, state was already mutated
               println!("Backend Contract: Failed to serialize state for event emission: {}", e);
               // Might return Ok(()) or an error depending on desired behavior
               return Ok(());
           }
      };

      // 4. Emit the update event (Crucial!)
      println!("Backend Contract: Emitting state update event with payload: {:?}", new_state_value);
      if let Err(e) = app_handle.emit("__zubridge_state_update", new_state_value) {
           println!("Backend Contract: Failed to emit state update event: {}", e);
           // Log error, but the state was mutated, so proceed.
      }

      // 5. Mutex guard is dropped here, unlocking the state.

      Ok(()) // Action processed successfully
  }
  ```

- **Input:** `ZubridgeAction`, `tauri::State<'_, YourBackendState>`, `tauri::AppHandle`.
- **Return:** `Result<(), String>`.

## 3. Required Tauri Event

Your backend **must** emit this event via the `AppHandle` after _every_ state mutation intended to be synced with the frontend.

### a) `__zubridge_state_update`

- **Purpose:** Notifies frontends of the latest state.
- **Emitter:** `app_handle.emit("__zubridge_state_update", new_state_value)?`
- **Payload:** The _complete, current_ state serialized as `serde_json::Value`.

## Implementation Notes

- Ensure your state struct derives `Serialize` and `Deserialize`.
- Register the commands using `tauri::Builder::invoke_handler(tauri::generate_handler![__zubridge_get_initial_state, __zubridge_dispatch_action])`.
- Remember to import necessary traits like `tauri::Manager` and `tauri::Emitter` where needed.
- Consider using Rust helpers provided by `@zubridge/tauri` (if available in the future) to simplify implementing this contract.
