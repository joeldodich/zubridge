use serde::{Deserialize, Serialize};
use tauri::{App, Manager, Wry};

use crate::{MutexStateManager, StateManager, ZubridgeAction, ZubridgeHandler, ZubridgeOptions};

// Define your application state
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppState {
    counter: i32,
    theme: ThemeState,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemeState {
    is_dark: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            counter: 0,
            theme: ThemeState { is_dark: true },
        }
    }
}

// Define your reducer function
pub fn app_reducer(state: &mut AppState, action: &ZubridgeAction) -> Result<(), String> {
    match action.action_type.as_str() {
        "INCREMENT_COUNTER" => {
            state.counter += 1;
            println!("Incremented counter to {}", state.counter);
            Ok(())
        },
        "DECREMENT_COUNTER" => {
            state.counter -= 1;
            println!("Decremented counter to {}", state.counter);
            Ok(())
        },
        "SET_COUNTER" => {
            if let Some(ref payload) = action.payload {
                if let Some(value) = payload.as_i64() {
                    state.counter = value as i32;
                    println!("Set counter to {}", state.counter);
                    Ok(())
                } else {
                    Err("Payload for SET_COUNTER must be a number".to_string())
                }
            } else {
                Err("Missing payload for SET_COUNTER".to_string())
            }
        },
        "TOGGLE_THEME" => {
            state.theme.is_dark = !state.theme.is_dark;
            println!("Toggled theme to {}", if state.theme.is_dark { "dark" } else { "light" });
            Ok(())
        },
        "SET_THEME" => {
            if let Some(ref payload) = action.payload {
                if let Some(is_dark) = payload.as_bool() {
                    state.theme.is_dark = is_dark;
                    println!("Set theme to {}", if state.theme.is_dark { "dark" } else { "light" });
                    Ok(())
                } else {
                    Err("Payload for SET_THEME must be a boolean".to_string())
                }
            } else {
                Err("Missing payload for SET_THEME".to_string())
            }
        },
        // Handle SET_STATE action to support full state replacement
        "SET_STATE" => {
            if let Some(ref payload) = action.payload {
                match serde_json::from_value::<AppState>(payload.clone()) {
                    Ok(new_state) => {
                        *state = new_state;
                        println!("State replaced with new state");
                        Ok(())
                    },
                    Err(e) => Err(format!("Failed to deserialize state: {}", e)),
                }
            } else {
                Err("Missing payload for SET_STATE".to_string())
            }
        },
        _ => {
            println!("Unknown action type: {}", action.action_type);
            Err(format!("Unknown action type: {}", action.action_type))
        }
    }
}

// Function to setup Zubridge in your Tauri app
pub fn setup_zubridge(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    // Create the initial state
    let initial_state = AppState::default();

    // Create the state manager with your reducer
    let state_manager = MutexStateManager::new(initial_state, app_reducer);

    // Create the Zubridge handler (using default options here)
    let zubridge_handler = ZubridgeHandler::new(state_manager);

    // Register the Zubridge commands with your app
    zubridge_handler.register_commands(app)?;

    // Optional: set up a listener for the state update event that you can use for other backend tasks
    let app_handle = app.handle().clone();
    app.listen("__zubridge_state_update", move |event| {
        println!("Received state update event");
        // Access the payload and do something with it
        if let Some(payload) = event.payload() {
            if let Ok(state) = serde_json::from_str::<AppState>(payload) {
                println!("Current counter value: {}", state.counter);
                println!("Current theme: {}", if state.theme.is_dark { "dark" } else { "light" });

                // Update your system tray or perform other backend-only operations
                if let Some(tray) = app_handle.tray_by_id("main-tray") {
                    // Update tray menu or icon based on state
                    println!("Updating tray based on new state");
                }
            }
        }
    });

    Ok(())
}

// For advanced configuration, you could use custom options
pub fn setup_zubridge_with_custom_options(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let initial_state = AppState::default();
    let state_manager = MutexStateManager::new(initial_state, app_reducer);

    // Create custom options
    let options = ZubridgeOptions {
        event_name: "app_state_update".to_string(),       // Custom event name
        get_state_command: "get_app_state".to_string(),   // Custom command name
        dispatch_command: "dispatch_app_action".to_string(), // Custom command name
        auto_emit_updates: true,
    };

    let zubridge_handler = ZubridgeHandler::with_options(state_manager, options);
    zubridge_handler.register_commands(app)?;

    Ok(())
}
