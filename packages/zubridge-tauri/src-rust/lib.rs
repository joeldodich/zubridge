use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    #[serde(rename = "type")]
    pub action_type: String,
    pub payload: Option<serde_json::Value>,
}

pub mod commands;
pub use commands::*;

#[cfg(debug_assertions)]
pub fn __debug_init() {
    println!("Rust: zubridge-tauri commands module loaded");
    println!("Rust: Available commands:");
    println!("  - get_state");
    println!("  - set_state");
    println!("  - dispatch");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    struct TestState {
        state: Mutex<serde_json::Value>,
    }

    impl TestState {
        fn new() -> Self {
            TestState {
                state: Mutex::new(serde_json::json!({}))
            }
        }

        fn get_state(&self) -> Result<serde_json::Value, String> {
            Ok(self.state.lock().unwrap().clone())
        }

        fn dispatch(&self, action: Action) -> Result<(), String> {
            let mut state = self.state.lock().unwrap();
            if let Some(payload) = action.payload {
                *state = payload;
            }
            Ok(())
        }

        fn subscribe<F>(&self, _callback: F) -> Result<Box<dyn FnOnce() -> Result<(), String>>, String>
        where
            F: Fn(serde_json::Value) + 'static,
        {
            Ok(Box::new(|| Ok(())))
        }
    }

    #[test]
    fn test_dispatch() {
        let state = TestState::new();
        let action = Action {
            action_type: "TEST:ACTION".to_string(),
            payload: Some(serde_json::Value::String("test".to_string())),
        };

        let result = state.dispatch(action);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_state() {
        let state = TestState::new();
        let result = state.get_state();
        assert!(result.is_ok());
    }

    #[test]
    fn test_subscribe() {
        let state = TestState::new();
        let callback = |_state: serde_json::Value| {};

        let result = state.subscribe(callback);
        assert!(result.is_ok());

        let unsubscribe = result.unwrap();
        assert!(unsubscribe().is_ok());
    }

    #[test]
    fn test_state_updates() {
        let state = TestState::new();
        let new_value = serde_json::json!({ "count": 1 });

        let action = Action {
            action_type: "setState".to_string(),
            payload: Some(new_value.clone()),
        };

        state.dispatch(action).unwrap();
        let current_state = state.get_state().unwrap();
        assert_eq!(current_state, new_value);
    }
}
