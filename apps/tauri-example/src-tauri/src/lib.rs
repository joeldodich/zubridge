#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::AppHandle;
use tauri::Manager;
use tauri::Listener;
use tauri::plugin::TauriPlugin;
use tauri_plugin_zubridge::{self, plugin, StateManager, ZubridgeOptions};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// Define the application state
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

// Define actions
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub enum CounterAction {
    #[serde(rename = "INCREMENT")]
    Increment,
    #[serde(rename = "DECREMENT")]
    Decrement,
    #[serde(rename = "RESET")]
    Reset,
    #[serde(rename = "TOGGLE_THEME")]
    ToggleTheme,
    #[serde(rename = "SET_COUNTER")]
    SetCounter(i32),
}

// State reducer
fn app_reducer(mut state: AppState, action: CounterAction) -> AppState {
    match action {
        CounterAction::Increment => {
            state.counter += 1;
        },
        CounterAction::Decrement => {
            state.counter -= 1;
        },
        CounterAction::Reset => {
            state.counter = 0;
        },
        CounterAction::ToggleTheme => {
            state.theme.is_dark = !state.theme.is_dark;
        },
        CounterAction::SetCounter(value) => {
            state.counter = value;
        }
    }

    state
}

// Custom state manager
pub struct AppStateManager {
    state: Mutex<AppState>,
}

impl AppStateManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(AppState::default()),
        }
    }
}

// Implement StateManager for our custom state manager
impl StateManager for AppStateManager {
    fn get_initial_state(&self) -> tauri_plugin_zubridge::JsonValue {
        let state = self.state.lock().unwrap();
        serde_json::to_value(state.clone()).unwrap()
    }

    fn dispatch_action(&mut self, action: tauri_plugin_zubridge::JsonValue) -> tauri_plugin_zubridge::JsonValue {
        println!("Dispatching action: {:?}", action);
        let mut state = self.state.lock().unwrap();

        // Parse the action from JsonValue
        if let Ok(action_type) = serde_json::from_value::<String>(action["type"].clone()) {
            println!("Action type: {}", action_type);
            let new_state = match action_type.as_str() {
                "INCREMENT_COUNTER" => app_reducer(state.clone(), CounterAction::Increment),
                "DECREMENT_COUNTER" => app_reducer(state.clone(), CounterAction::Decrement),
                "RESET" => app_reducer(state.clone(), CounterAction::Reset),
                "THEME:TOGGLE" => app_reducer(state.clone(), CounterAction::ToggleTheme),
                "SET_COUNTER" => {
                    if let Some(payload) = action.get("payload") {
                        if let Some(value) = payload.as_i64() {
                            app_reducer(state.clone(), CounterAction::SetCounter(value as i32))
                        } else {
                            println!("SET_COUNTER: payload is not a number: {:?}", payload);
                            state.clone()
                        }
                    } else {
                        println!("SET_COUNTER: no payload");
                        state.clone()
                    }
                },
                _ => {
                    println!("Unknown action type: {}", action_type);
                    state.clone()
                },
            };

            println!("Updating state: {:?}", new_state);
            *state = new_state.clone();
            serde_json::to_value(new_state).unwrap()
        } else {
            println!("Failed to parse action type");
            serde_json::to_value(state.clone()).unwrap()
        }
    }
}

// Create a module for commands to avoid macro name conflicts
pub mod commands {
    use super::*;

    // Command to quit the app
    #[tauri::command]
    pub fn quit_app(app_handle: AppHandle) {
        app_handle.exit(0);
    }
}

#[path = "tray.rs"]
mod tray;

// Initialize the Zubridge plugin with our custom state manager
pub fn init() -> TauriPlugin<tauri::Wry> {
    let state_manager = AppStateManager::new();
    let options = ZubridgeOptions {
        event_name: "zubridge://state-update".to_string(),
    };

    plugin(state_manager, options)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_state = AppState::default();
    let state_manager = AppStateManager::new();

    // Create custom options with the correct event name
    let options = ZubridgeOptions {
        event_name: "zubridge://state-update".to_string(),
    };

    let zubridge_plugin = plugin(state_manager, options.clone());

    tauri::Builder::default()
        .plugin(zubridge_plugin)
        .setup(move |app| {
            // Manage the concrete initial state if needed elsewhere
            app.manage(initial_state.clone());

            // Setup the tray icon - Clone the app_handle to pass ownership
            match tray::setup_tray(app.app_handle().clone()) {
                Ok(tray) => {
                    println!("Tray setup successfully");
                    // Store the tray if you need to update it later
                    app.manage(tray);
                },
                Err(e) => {
                    eprintln!("Failed to setup tray: {}", e);
                }
            }

            // Get the app handle to use in the closure
            let app_handle = app.app_handle().clone();

            // Set up event listener for state updates - use the same options object
            let event_handle = app_handle.clone();
            let event_name = options.event_name.clone();
            app_handle.listen(&options.event_name, move |event| {
                println!("Event received: {}", event_name);

                // The payload() method returns &str directly, not Option<&str>
                let payload_str = event.payload();
                println!("Payload: {}", payload_str);

                // Parse the updated state
                match serde_json::from_str::<AppState>(payload_str) {
                    Ok(updated_state) => {
                        println!("Successfully parsed state: {:?}", updated_state);

                        // Update the tray menu with the new state
                        println!("Attempting to update tray menu");
                        if let Some(tray) = event_handle.tray_by_id("main-tray") {
                            println!("Found tray with id main-tray");
                            match tray::create_menu(&event_handle, &updated_state) {
                                Ok(new_menu) => {
                                    println!("Created new menu, applying to tray");
                                    // Don't use a reference to the menu - pass it directly
                                    let result = tray.set_menu(Some(new_menu));
                                    println!("Tray menu update result: {:?}", result);
                                },
                                Err(e) => {
                                    eprintln!("Failed to create new menu: {}", e);
                                }
                            }
                            println!("Tray menu update complete");
                        } else {
                            eprintln!("Could not find tray with id main-tray");
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to parse state update: {}", e);
                    }
                }
                println!("Event handler complete");
            });

            Ok(())
        })
        // Register commands using their full command_id for Tauri v2
        .invoke_handler(tauri::generate_handler![
            commands::quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
