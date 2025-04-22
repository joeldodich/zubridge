use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::{AppHandle, Manager, State, Emitter};

// Re-export serde and serde_json for convenience
pub use serde;
pub use serde_json;

// Example module with sample implementation
pub mod example;

/// The core Action type that Zubridge uses
#[derive(Deserialize, Debug, Serialize, Clone)]
pub struct ZubridgeAction {
    #[serde(rename = "type")]
    pub action_type: String,
    pub payload: Option<JsonValue>,
}

/// A trait for state managers that can process Zubridge actions
pub trait StateManager: Send + Sync + 'static {
    /// Get the current state as a JSON value
    fn get_state(&self) -> JsonValue;

    /// Process an action and return the result
    fn process_action(&self, action: &ZubridgeAction) -> Result<(), String>;

    /// Set the entire state at once (used for initialization and bulk updates)
    fn set_state(&self, state: JsonValue) -> Result<(), String>;
}

/// Options for configuring the ZubridgeHandler
#[derive(Debug, Clone)]
pub struct ZubridgeOptions {
    /// The name of the event to emit when state changes (default: "__zubridge_state_update")
    pub event_name: String,
    /// The name of the command to get initial state (default: "__zubridge_get_initial_state")
    pub get_state_command: String,
    /// The name of the command to dispatch actions (default: "__zubridge_dispatch_action")
    pub dispatch_command: String,
    /// Whether to emit state updates after every action (default: true)
    pub auto_emit_updates: bool,
}

impl Default for ZubridgeOptions {
    fn default() -> Self {
        Self {
            event_name: "__zubridge_state_update".to_string(),
            get_state_command: "__zubridge_get_initial_state".to_string(),
            dispatch_command: "__zubridge_dispatch_action".to_string(),
            auto_emit_updates: true,
        }
    }
}

/// Core handler for Zubridge functionality
pub struct ZubridgeHandler<S: StateManager> {
    state_manager: Arc<S>,
    options: ZubridgeOptions,
}

impl<S: StateManager> ZubridgeHandler<S> {
    /// Create a new ZubridgeHandler with the provided state manager
    pub fn new(state_manager: S) -> Self {
        Self {
            state_manager: Arc::new(state_manager),
            options: ZubridgeOptions::default(),
        }
    }

    /// Create a new ZubridgeHandler with custom options
    pub fn with_options(state_manager: S, options: ZubridgeOptions) -> Self {
        Self {
            state_manager: Arc::new(state_manager),
            options,
        }
    }

    /// Get the Tauri command handler for retrieving initial state
    pub fn get_initial_state_handler(&self) -> impl Fn() -> Result<JsonValue, String> + Clone {
        let state_manager = self.state_manager.clone();
        move || Ok(state_manager.get_state())
    }

    /// Get the Tauri command handler for dispatching actions
    pub fn dispatch_action_handler(&self) -> impl Fn(ZubridgeAction, AppHandle) -> Result<(), String> + Clone {
        let state_manager = self.state_manager.clone();
        let options = self.options.clone();

        move |action: ZubridgeAction, app_handle: AppHandle| {
            // Process the action using the state manager
            state_manager.process_action(&action)?;

            // Emit state updates if configured to do so
            if options.auto_emit_updates {
                let current_state = state_manager.get_state();
                if let Err(e) = app_handle.emit(&options.event_name, current_state) {
                    eprintln!("Zubridge: Error emitting state update event: {}", e);
                }
            }

            Ok(())
        }
    }

    /// Register commands with the Tauri app builder
    pub fn register_commands<R: tauri::Runtime>(
        &self,
        app: &mut tauri::App<R>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let get_state_handler = self.get_initial_state_handler();
        let dispatch_handler = self.dispatch_action_handler();
        let get_state_command = self.options.get_state_command.clone();
        let dispatch_command = self.options.dispatch_command.clone();

        app.register_handler(tauri::tauri_dyn_handler!(
            // Wrap each in a move || closure to capture clones of handler/command_name
            move |request| -> Result<String, tauri::Error> {
                let command = request.command_name();
                if command == get_state_command {
                    match get_state_handler() {
                        Ok(state) => Ok(serde_json::to_string(&state)?),
                        Err(e) => Err(tauri::Error::from(e)),
                    }
                } else if command == dispatch_command {
                    let action: ZubridgeAction = serde_json::from_str(request.message())?;
                    let app_handle = request.app_handle().clone();
                    match dispatch_handler(action, app_handle) {
                        Ok(_) => Ok("".to_string()),
                        Err(e) => Err(tauri::Error::from(e)),
                    }
                } else {
                    Err(tauri::Error::from(format!("Unknown command: {}", command)))
                }
            }
        ));

        Ok(())
    }
}

/// A simple Mutex-based implementation of StateManager
pub struct MutexStateManager<T: Serialize + Clone + 'static> {
    inner: Mutex<T>,
    reducer: Box<dyn Fn(&mut T, &ZubridgeAction) -> Result<(), String> + Send + Sync>,
}

impl<T: Serialize + Clone + 'static> MutexStateManager<T> {
    /// Create a new MutexStateManager with the given initial state and reducer function
    pub fn new(
        initial_state: T,
        reducer: impl Fn(&mut T, &ZubridgeAction) -> Result<(), String> + Send + Sync + 'static,
    ) -> Self {
        Self {
            inner: Mutex::new(initial_state),
            reducer: Box::new(reducer),
        }
    }
}

impl<T: Serialize + Clone + 'static> StateManager for MutexStateManager<T> {
    fn get_state(&self) -> JsonValue {
        let state = self.inner.lock().unwrap();
        serde_json::to_value(state.clone()).unwrap_or(JsonValue::Null)
    }

    fn process_action(&self, action: &ZubridgeAction) -> Result<(), String> {
        let mut state = self.inner.lock().map_err(|e| format!("Failed to lock state mutex: {}", e))?;
        (self.reducer)(&mut state, action)
    }

    fn set_state(&self, state: JsonValue) -> Result<(), String> {
        let new_state: T = serde_json::from_value(state)
            .map_err(|e| format!("Failed to deserialize state: {}", e))?;

        let mut current_state = self.inner.lock()
            .map_err(|e| format!("Failed to lock state mutex: {}", e))?;

        *current_state = new_state;
        Ok(())
    }
}

#[cfg(feature = "tokio")]
pub mod tokio_impl {
    use super::*;
    use tokio::sync::Mutex as TokioMutex;

    /// A Tokio-based implementation of StateManager using async Mutex
    pub struct TokioStateManager<T: Serialize + Clone + 'static> {
        inner: TokioMutex<T>,
        reducer: Box<dyn Fn(&mut T, &ZubridgeAction) -> Result<(), String> + Send + Sync>,
    }

    impl<T: Serialize + Clone + 'static> TokioStateManager<T> {
        /// Create a new TokioStateManager with the given initial state and reducer function
        pub fn new(
            initial_state: T,
            reducer: impl Fn(&mut T, &ZubridgeAction) -> Result<(), String> + Send + Sync + 'static,
        ) -> Self {
            Self {
                inner: TokioMutex::new(initial_state),
                reducer: Box::new(reducer),
            }
        }
    }

    impl<T: Serialize + Clone + 'static> StateManager for TokioStateManager<T> {
        fn get_state(&self) -> JsonValue {
            // We use blocking here because the StateManager trait is not async
            // This is a compromise to make the API easier to use
            let state = self.inner.blocking_lock();
            serde_json::to_value(state.clone()).unwrap_or(JsonValue::Null)
        }

        fn process_action(&self, action: &ZubridgeAction) -> Result<(), String> {
            let mut state = self.inner.blocking_lock()
                .map_err(|e| format!("Failed to lock state mutex: {}", e))?;
            (self.reducer)(&mut state, action)
        }

        fn set_state(&self, state: JsonValue) -> Result<(), String> {
            let new_state: T = serde_json::from_value(state)
                .map_err(|e| format!("Failed to deserialize state: {}", e))?;

            let mut current_state = self.inner.blocking_lock()
                .map_err(|e| format!("Failed to lock state mutex: {}", e))?;

            *current_state = new_state;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
    struct TestState {
        counter: i32,
    }

    fn test_reducer(state: &mut TestState, action: &ZubridgeAction) -> Result<(), String> {
        match action.action_type.as_str() {
            "INCREMENT" => {
                state.counter += 1;
                Ok(())
            },
            "DECREMENT" => {
                state.counter -= 1;
                Ok(())
            },
            "SET" => {
                if let Some(ref payload) = action.payload {
                    if let Some(value) = payload.as_i64() {
                        state.counter = value as i32;
                        Ok(())
                    } else {
                        Err("Payload is not a number".to_string())
                    }
                } else {
                    Err("Missing payload for SET action".to_string())
                }
            },
            _ => Err(format!("Unknown action type: {}", action.action_type)),
        }
    }

    #[test]
    fn test_mutex_state_manager() {
        let initial_state = TestState { counter: 0 };
        let manager = MutexStateManager::new(initial_state, test_reducer);

        // Test initial state
        let state_json = manager.get_state();
        let state: TestState = serde_json::from_value(state_json).unwrap();
        assert_eq!(state.counter, 0);

        // Test increment action
        let action = ZubridgeAction {
            action_type: "INCREMENT".to_string(),
            payload: None,
        };
        manager.process_action(&action).unwrap();

        let state_json = manager.get_state();
        let state: TestState = serde_json::from_value(state_json).unwrap();
        assert_eq!(state.counter, 1);

        // Test set action
        let action = ZubridgeAction {
            action_type: "SET".to_string(),
            payload: Some(serde_json::json!(42)),
        };
        manager.process_action(&action).unwrap();

        let state_json = manager.get_state();
        let state: TestState = serde_json::from_value(state_json).unwrap();
        assert_eq!(state.counter, 42);
    }
}
