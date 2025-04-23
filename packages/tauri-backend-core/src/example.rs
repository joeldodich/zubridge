use serde::{Deserialize, Serialize};
use tauri::Runtime;

use crate::{MutexStateManager, ZubridgeAction, ZubridgeOptions};

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
pub fn setup_zubridge<R: Runtime>(builder: tauri::Builder<R>) -> Result<tauri::Builder<R>, Box<dyn std::error::Error>> {
    // Create the initial state
    let initial_state = AppState::default();

    // Create the state manager with your reducer
    let state_manager = MutexStateManager::new(initial_state, app_reducer);

    // Initialize and register the Zubridge plugin
    let builder = builder.plugin(crate::init_default(state_manager));

    Ok(builder)
}

// For advanced configuration, you could use custom options
pub fn setup_zubridge_with_custom_options<R: Runtime>(builder: tauri::Builder<R>) -> Result<tauri::Builder<R>, Box<dyn std::error::Error>> {
    let initial_state = AppState::default();
    let state_manager = MutexStateManager::new(initial_state, app_reducer);

    // Create custom options
    let options = ZubridgeOptions {
        event_name: "app_state_update".to_string(),       // Custom event name
        get_state_command: "get_app_state".to_string(),   // Custom command name
        dispatch_command: "dispatch_app_action".to_string(), // Custom command name
        auto_emit_updates: true,
    };

    // Initialize and register the Zubridge plugin with custom options
    let builder = builder.plugin(crate::init(state_manager, options));

    Ok(builder)
}
