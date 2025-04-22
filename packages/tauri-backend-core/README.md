# Zubridge Backend Core

A helper crate for Tauri applications that use Zubridge for frontend-backend communication. This crate simplifies the process of implementing the backend portion of Zubridge by handling command registration, state management, and event emission.

## Features

- **Reduced Boilerplate**: Automatically handles the implementation of Tauri commands that Zubridge expects
- **Convention Enforcement**: Ensures consistent naming for commands and events that match what the frontend expects
- **State Management**: Provides a flexible state manager interface that works with various state storage strategies
- **Easy Integration**: Simple API for registering Zubridge with your Tauri application
- **Tokio Support**: Optional support for tokio-based async state management

## Installation

Add the crate to your Tauri application's `Cargo.toml`:

```toml
[dependencies]
zubridge-backend-core = "0.1.0"
```

For tokio support:

```toml
[dependencies]
zubridge-backend-core = { version = "0.1.0", features = ["tokio"] }
```

## Basic Usage

```rust
use serde::{Deserialize, Serialize};
use tauri::App;
use zubridge_backend_core::{MutexStateManager, ZubridgeAction, ZubridgeHandler};

// 1. Define your application state
#[derive(Serialize, Deserialize, Clone, Debug)]
struct AppState {
    counter: i32,
}

// 2. Define your reducer function
fn app_reducer(state: &mut AppState, action: &ZubridgeAction) -> Result<(), String> {
    match action.action_type.as_str() {
        "INCREMENT" => {
            state.counter += 1;
            Ok(())
        },
        "DECREMENT" => {
            state.counter -= 1;
            Ok(())
        },
        _ => Err(format!("Unknown action type: {}", action.action_type)),
    }
}

// 3. Set up Zubridge in your Tauri application
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Create initial state
            let initial_state = AppState { counter: 0 };

            // Create the state manager with your reducer
            let state_manager = MutexStateManager::new(initial_state, app_reducer);

            // Create and register the Zubridge handler
            let zubridge_handler = ZubridgeHandler::new(state_manager);
            zubridge_handler.register_commands(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

## Advanced Configuration

You can customize the command and event names and other options:

```rust
let options = ZubridgeOptions {
    event_name: "app_state_update".to_string(),
    get_state_command: "get_app_state".to_string(),
    dispatch_command: "dispatch_app_action".to_string(),
    auto_emit_updates: true,
};

let zubridge_handler = ZubridgeHandler::with_options(state_manager, options);
```

## Using Tokio for Async State Management

```rust
#[cfg(feature = "tokio")]
use zubridge_backend_core::tokio_impl::TokioStateManager;

#[cfg(feature = "tokio")]
fn setup_with_tokio(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let initial_state = AppState { counter: 0 };
    let state_manager = TokioStateManager::new(initial_state, app_reducer);
    let zubridge_handler = ZubridgeHandler::new(state_manager);
    zubridge_handler.register_commands(app)?;
    Ok(())
}
```

## Creating a Custom State Manager

You can implement your own state manager by implementing the `StateManager` trait:

```rust
use serde_json::Value as JsonValue;
use zubridge_backend_core::{StateManager, ZubridgeAction};

struct MyCustomStateManager {
    // Your state storage implementation
}

impl StateManager for MyCustomStateManager {
    fn get_state(&self) -> JsonValue {
        // Return your state as a JSON value
    }

    fn process_action(&self, action: &ZubridgeAction) -> Result<(), String> {
        // Process the action and update state
    }

    fn set_state(&self, state: JsonValue) -> Result<(), String> {
        // Set the entire state at once
    }
}
```

## Example

See the `example.rs` module for a complete example implementation.

## License

MIT
