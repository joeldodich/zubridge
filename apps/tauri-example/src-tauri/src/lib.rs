// Declare the tray module
mod tray;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use zubridge_backend_core::{MutexStateManager, ZubridgeAction, ZubridgeHandler};

// --- State Definition ---
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CounterState {
    counter: i32,
}

// --- Action Reducer ---
fn counter_reducer(state: &mut CounterState, action: &ZubridgeAction) -> Result<(), String> {
    println!("Zubridge Backend: Received action: {:?}", action);

    match action.action_type.as_str() {
        "INCREMENT_COUNTER" => {
            state.counter += 1;
            println!("Zubridge Backend: Incremented counter to {}", state.counter);
            Ok(())
        },
        "DECREMENT_COUNTER" => {
            state.counter -= 1;
            println!("Zubridge Backend: Decremented counter to {}", state.counter);
            Ok(())
        },
        "ADD_TO_COUNTER" => {
            if let Some(payload) = &action.payload {
                // Attempt to deserialize payload as i32
                if let Some(value) = payload.as_i64() {
                    state.counter += value as i32;
                    println!("Zubridge Backend: Added {} to counter, new value: {}", value, state.counter);
                    Ok(())
                } else {
                    Err("Invalid payload for ADD_TO_COUNTER: Expected an integer.".to_string())
                }
            } else {
                Err("Missing payload for ADD_TO_COUNTER.".to_string())
            }
        },
        "SET_COUNTER" => {
            if let Some(payload) = &action.payload {
                // Attempt to deserialize payload as i32
                if let Some(value) = payload.as_i64() {
                    state.counter = value as i32;
                    println!("Zubridge Backend: Set counter to {}", value);
                    Ok(())
                } else {
                    Err("Invalid payload for SET_COUNTER: Expected an integer.".to_string())
                }
            } else {
                Err("Missing payload for SET_COUNTER.".to_string())
            }
        },
        "RESET_COUNTER" => {
            state.counter = 0;
            println!("Zubridge Backend: Reset counter to 0");
            Ok(())
        },
        // Support the standard SET_STATE action
        "SET_STATE" => {
            if let Some(payload) = &action.payload {
                match serde_json::from_value::<CounterState>(payload.clone()) {
                    Ok(new_state) => {
                        *state = new_state;
                        println!("Zubridge Backend: State replaced");
                        Ok(())
                    },
                    Err(e) => Err(format!("Failed to deserialize state: {}", e)),
                }
            } else {
                Err("Missing payload for SET_STATE.".to_string())
            }
        },
        // Add more action handlers here as needed
        _ => {
            println!("Zubridge Backend: Received unknown action type '{}'", action.action_type);
            // Optionally return an error for unhandled actions
            Err(format!("Unknown action type: {}", action.action_type))
        },
    }
}

// New command to exit the application (not related to Zubridge)
#[tauri::command]
fn quit_app() {
    println!("Received quit_app command. Exiting application...");
    std::process::exit(0);
}

// --- Application Setup ---
pub fn run() {
    let initial_state = CounterState::default();

    tauri::Builder::default()
        .setup(|app| {
            // Setup initial tray
            tray::setup_tray(app.handle())?;

            // Create the state manager with our reducer
            let state_manager = MutexStateManager::new(initial_state, counter_reducer);

            // Create and register the Zubridge handler
            let zubridge_handler = ZubridgeHandler::new(state_manager);
            zubridge_handler.register_commands(app)?;

            // Set up a listener for the state update event to update the tray
            let app_handle = app.handle().clone();
            app.listen("__zubridge_state_update", move |event| {
                println!("Backend listener received state-update event.");
                // Trusting compiler: event.payload() seems to be &str here. Attempt direct deserialization.
                if let Some(payload_str) = event.payload() {
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
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
