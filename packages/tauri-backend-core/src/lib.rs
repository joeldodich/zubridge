#![allow(unused)]

use std::fmt::Debug;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{Runtime, Manager, Emitter, AppHandle, State, plugin::{Builder as PluginBuilder, TauriPlugin}};

pub use serde_json::Value as JsonValue;
pub use serde_json::json;

/// The update state listener event name.
const UPDATE_STATE_EVENT: &str = "zubridge://state-update";

/// A trait that manages state for the app.
pub trait StateManager: Send + Sync + 'static {
    /// Get the initial state of the app.
    fn get_initial_state(&self) -> JsonValue;

    /// Apply an action to the state and return the new state.
    fn dispatch(&mut self, action: JsonValue) -> JsonValue;
}

/// An action to be dispatch to the state manager.
#[derive(Deserialize, Debug)]
pub struct ZubridgeAction {
    /// A string label for the action
    pub action_type: String,
    /// An optional payload for the action
    pub payload: Option<JsonValue>,
}

/// Options for the Zubridge plugin.
#[derive(Clone)]
pub struct ZubridgeOptions {
    /// The event name to use for state updates. Defaults to "zubridge://state-update".
    pub event_name: String,
}

impl Default for ZubridgeOptions {
    fn default() -> Self {
        Self {
            event_name: "zubridge://state-update".to_string(),
        }
    }
}

mod commands {
    use super::*;

    #[tauri::command]
    pub fn __zubridge_get_initial_state(state: State<Arc<Mutex<dyn StateManager>>>) -> JsonValue {
        println!("💬 [zubridge-core] Getting initial state");
        let state_manager = state.lock().unwrap();
        let initial_state = state_manager.get_initial_state();
        println!("💬 [zubridge-core] Initial state: {:?}", initial_state);
        initial_state
    }

    #[tauri::command]
    pub fn __zubridge_dispatch_action(
        action: JsonValue,
        app_handle: AppHandle,
        state: State<Arc<Mutex<dyn StateManager>>>,
        options: State<ZubridgeOptions>,
    ) -> JsonValue {
        println!("💬 [zubridge-core] Dispatching action: {:?}", action);
        println!("💬 [zubridge-core] Using event name: {}", options.event_name);

        let mut state_manager = state.lock().unwrap();
        let current_state = state_manager.dispatch(action);

        println!("💬 [zubridge-core] New state after dispatch: {:?}", current_state);

        // Emit the updated state to all frontend windows
        match app_handle.emit(&options.event_name, current_state.clone()) {
            Ok(_) => println!("💬 [zubridge-core] Successfully emitted state update event"),
            Err(e) => println!("⚠️ [zubridge-core] Failed to emit state update: {}", e),
        }

        current_state
    }
}

// Re-export the command functions so they're accessible
pub use commands::{__zubridge_get_initial_state, __zubridge_dispatch_action};

/// Creates the Zubridge Tauri plugin and the state manager Arc.
/// The plugin manages ZubridgeOptions, the Arc must be managed by the app.
/// Currently only supports the tauri::Wry runtime.
pub fn plugin<S: StateManager>(
    state_manager: S,
    options: ZubridgeOptions,
) -> (TauriPlugin<tauri::Wry>, Arc<Mutex<dyn StateManager>>) {
    let state_arc: Arc<Mutex<dyn StateManager>> = Arc::new(Mutex::new(state_manager));
    let state_arc_clone = state_arc.clone();

    let plugin = tauri::plugin::Builder::new("zubridge")
        .invoke_handler(tauri::generate_handler![
            __zubridge_get_initial_state,
            __zubridge_dispatch_action
        ])
        .setup(move |app, _api| {
            // Register the ZubridgeOptions in the app state
            app.manage(options);
            // Register the state manager in the app state
            app.manage(state_arc_clone);
            Ok(())
        })
        .build();

    (plugin, state_arc)
}

/// Creates the Zubridge Tauri plugin and the state manager Arc with default options.
/// The plugin manages ZubridgeOptions, the Arc must be managed by the app.
/// Currently only supports the tauri::Wry runtime.
pub fn plugin_default<S: StateManager>(
    state_manager: S
) -> (TauriPlugin<tauri::Wry>, Arc<Mutex<dyn StateManager>>) {
    plugin(state_manager, ZubridgeOptions::default())
}
