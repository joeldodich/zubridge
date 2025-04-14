// Declare the tray module
mod tray;

use std::sync::Mutex;
// Need Listener trait for app.listen, Emitter trait for app_handle.emit
use tauri::{Emitter, Listener, State};
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

pub struct AppState(pub Mutex<CounterState>);

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
    app_handle: tauri::AppHandle,
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
    // Emit the full state object
    if let Err(e) = app_handle.emit("__zubridge_state_update", current_state_clone) {
        // Log the error but don't necessarily fail the whole command
        eprintln!("Zubridge Backend: Error emitting state update event: {}", e);
    }

    Ok(())
}

// New command to exit the application
#[tauri::command]
fn quit_app() {
    println!("Received quit_app command. Exiting application...");
    std::process::exit(0);
}

// --- Application Setup ---
pub fn run() {
    let initial_state = AppState(Mutex::new(CounterState::default()));

    tauri::Builder::default()
        .setup(|app| {
            // Setup initial tray
            tray::setup_tray(app.handle())?;

            // --- Add Backend Listener for Tray Updates ---
            let app_handle = app.handle().clone();
            // Listen for the Zubridge state update event
            app.listen("__zubridge_state_update", move |event| {
                println!("Backend listener received state-update event.");
                // Trusting compiler: event.payload() seems to be &str here. Attempt direct deserialization.
                let payload_str = event.payload();
                match serde_json::from_str::<CounterState>(payload_str) {
                    Ok(current_state) => {
                        println!("Backend listener successfully deserialized state: {:?}", current_state);
                        // Get the tray handle by ID
                        if let Some(tray) = app_handle.tray_by_id("main-tray") {
                            println!("Found tray, attempting to update menu...");
                            // Regenerate the menu with the current state
                            if let Ok(new_menu) = tray::create_menu(&app_handle, &current_state) { // Pass state to menu creation
                                // Set the new menu for the tray
                                match tray.set_menu(Some(new_menu)) {
                                    Ok(_) => println!("Tray menu updated successfully."),
                                    Err(e) => println!("Error setting tray menu: {:?}", e),
                                }
                            } else {
                                println!("Error creating new tray menu.");
                            }
                        } else {
                                println!("Could not find tray with ID 'main-tray' to update.");
                        }
                    },
                    Err(e) => {
                        println!("Backend listener failed to deserialize payload string: {:?}. Payload: {}", e, payload_str);
                    }
                }
            });
            // --- End Backend Listener ---

            Ok(())
        })
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            __zubridge_get_initial_state,
            __zubridge_dispatch_action,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
