// Declare the tray module
mod tray;

use std::sync::{Arc, Mutex};
// Use tauri::Manager for listen/emit/tray access in v1
use tauri::{AppHandle, Manager, State};
// Add serde for state serialization and action deserialization
use serde::{Deserialize, Serialize};
// Bring AnyState/Value from serde_json
use serde_json::Value as AnyState;

// --- State Management ---
// Use a Mutex to safely manage shared state across threads
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CounterState {
    counter: i32,
}

pub struct AppState(pub Arc<Mutex<CounterState>>); // Use Arc for shared ownership across threads

impl AppState {
    // Helper to get the current counter value
    fn get_count(&self) -> i32 {
        self.0.lock().unwrap().counter
    }

    // Helper to increment the counter
    fn increment(&self) {
        let mut state = self.0.lock().unwrap();
        state.counter += 1;
    }

    // Helper to decrement the counter
    fn decrement(&self) {
        let mut state = self.0.lock().unwrap();
        state.counter -= 1;
    }

    // Helper to add a specific value
    fn add(&self, value: i32) {
        let mut state = self.0.lock().unwrap();
        state.counter += value;
    }
}

// --- Zubridge Action Definition ---
// This must match the structure defined in the frontend library
#[derive(Deserialize, Debug, Serialize, Clone)] // Make it public and add Serialize/Clone if needed for invoke
pub struct ZubridgeAction { // Make struct public
    #[serde(rename = "type")] // Map JSON `type` to Rust field `action_type`
    pub action_type: String, // Make fields public
    pub payload: Option<AnyState>, // Make fields public
}

// --- Zubridge Commands ---
// These functions will be callable from the frontend

#[tauri::command]
fn __zubridge_get_initial_state(state: State<'_, AppState>) -> Result<CounterState, String> {
    println!("Zubridge Backend: Received request for initial state.");
    match state.0.lock() {
        Ok(locked_state) => Ok(locked_state.clone()), // Clone the state to return
        Err(e) => Err(format!("Failed to lock state mutex: {}", e)),
    }
}

#[tauri::command]
fn __zubridge_dispatch_action(
    action: ZubridgeAction, // The action dispatched from the frontend
    state: State<'_, AppState>,
    app_handle: AppHandle, // AppHandle is automatically injected in v1 commands
) -> Result<(), String> {
    println!("Zubridge Backend: Received action: {:?}", action);

    let mut locked_state = state.0.lock().map_err(|e| format!("Failed to lock state mutex: {}", e))?;

    // --- Action Handling Logic ---
    match action.action_type.as_str() {
        "INCREMENT_COUNTER" => {
            locked_state.counter += 1;
            println!("Zubridge Backend: Incremented counter to {}", locked_state.counter);
        },
        "DECREMENT_COUNTER" => {
            locked_state.counter -= 1;
            println!("Zubridge Backend: Decremented counter to {}", locked_state.counter);
        },
        "ADD_TO_COUNTER" => {
            if let Some(payload) = action.payload {
                // Attempt to deserialize payload as i32
                if let Ok(value) = serde_json::from_value::<i32>(payload) {
                    locked_state.counter += value;
                    println!("Zubridge Backend: Added {} to counter, new value: {}", value, locked_state.counter);
                } else {
                    return Err("Invalid payload for ADD_TO_COUNTER: Expected an integer.".to_string());
                }
            } else {
                return Err("Missing payload for ADD_TO_COUNTER.".to_string());
            }
        },
        "SET_COUNTER" => {
            if let Some(payload) = action.payload {
                // Attempt to deserialize payload as i32
                if let Ok(value) = serde_json::from_value::<i32>(payload) {
                    locked_state.counter = value;
                    println!("Zubridge Backend: Set counter to {}", value);
                } else {
                    return Err("Invalid payload for SET_COUNTER: Expected an integer.".to_string());
                }
            } else {
                return Err("Missing payload for SET_COUNTER.".to_string());
            }
        },
        "RESET_COUNTER" => {
            locked_state.counter = 0;
            println!("Zubridge Backend: Reset counter to 0");
        },
        // Add more action handlers here as needed
        _ => {
            println!("Zubridge Backend: Received unknown action type '{}'", action.action_type);
            // Optionally return an error for unhandled actions
            // return Err(format!("Unknown action type: {}", action.action_type));
        },
    }

    // --- Emit State Update ---
    // Clone the *current* state after mutation to send to all listeners
    let current_state_clone = locked_state.clone();
    // Drop the lock before emitting to avoid potential deadlocks if a listener tries to lock state
    drop(locked_state);

    println!("Zubridge Backend: Emitting state update event with state: {:?}", current_state_clone);
    // Use app_handle directly from Manager trait
    if let Err(e) = app_handle.emit_all("__zubridge_state_update", current_state_clone.clone()) {
        // Log the error but don't necessarily fail the whole command
        eprintln!("Zubridge Backend: Error emitting state update event: {}", e);
    }

    // Update the tray menu directly after emitting the event
    let tray_handle = app_handle.tray_handle();
    let new_menu = tray::create_menu(&current_state_clone);
    if let Err(e) = tray_handle.set_menu(new_menu) {
        eprintln!("Zubridge Backend: Error updating tray menu: {}", e);
    } else {
        println!("Zubridge Backend: Tray menu updated successfully.");
    }

    Ok(())
}

// New command to exit the application
#[tauri::command]
fn quit_app(app_handle: AppHandle) {
    println!("Received quit_app command. Exiting application...");
    app_handle.exit(0);
}

// --- Application Setup ---
pub fn run() {
    // Use Arc for state sharing in v1
    let initial_state = AppState(Arc::new(Mutex::new(CounterState::default())));
    // Create the system tray instance (menu is set in setup)
    let system_tray = tray::create_tray();

    tauri::Builder::default()
        .manage(initial_state) // Manage state
        .system_tray(system_tray) // Add the tray definition
        .on_system_tray_event(tray::handle_tray_event) // Handle tray events
        .setup(|app| {
            // --- Force Open DevTools on Main Window --- //
            #[cfg(debug_assertions)] // Only open devtools in debug builds
            {
                use tauri::Manager; // Ensure Manager trait is in scope
                if let Some(window) = app.get_window("main") {
                    println!("Attempting to open devtools for main window...");
                    window.open_devtools();
                    window.close_devtools(); // Close them immediately after opening (hacky way to enable context menu?)
                } else {
                    println!("Could not find main window to open devtools for.");
                }
            }
            // --- End DevTools Force --- //

            // --- Add Backend Listener for Tray Updates ---
            let app_handle = app.handle(); // Get AppHandle in setup
            // Listen for the Zubridge state update event
            app.listen_global("__zubridge_state_update", move |event| {
                println!("Backend listener received state-update event.");
                if let Some(payload_str) = event.payload() {
                    match serde_json::from_str::<CounterState>(payload_str) {
                        Ok(current_state) => {
                            println!("Backend listener successfully deserialized state: {:?}", current_state);
                            let tray_handle = app_handle.tray_handle();
                            println!("Found tray, attempting to update menu...");
                            let new_menu = tray::create_menu(&current_state);
                            match tray_handle.set_menu(new_menu) {
                                Ok(_) => println!("Tray menu updated successfully from listener."),
                                Err(e) => println!("Error setting tray menu from listener: {:?}", e),
                            }
                        },
                        Err(e) => {
                            println!("Backend listener failed to deserialize payload string: {:?}. Payload: {}", e, payload_str);
                        }
                    }
                } else {
                    println!("Backend listener received event with no payload.");
                }
            });
            // --- End Backend Listener ---
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            __zubridge_get_initial_state,
            __zubridge_dispatch_action,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
