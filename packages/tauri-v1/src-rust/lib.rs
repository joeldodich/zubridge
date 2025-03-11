use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
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
    println!("Rust: zubridge-tauri-v1 commands module loaded");
    println!("Rust: Available commands:");
    println!("  - get_state");
    println!("  - set_state");
    println!("  - dispatch");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_action_serialization() {
        let action = Action {
            action_type: "INCREMENT".to_string(),
            payload: Some(serde_json::json!({ "counter": 1 })),
        };

        let serialized = serde_json::to_string(&action).unwrap();
        let deserialized: Action = serde_json::from_str(&serialized).unwrap();

        assert_eq!(action.action_type, deserialized.action_type);
        assert_eq!(action.payload, deserialized.payload);
    }

    #[test]
    fn test_action_without_payload() {
        let action = Action {
            action_type: "RESET".to_string(),
            payload: None,
        };

        let serialized = serde_json::to_string(&action).unwrap();
        assert!(serialized.contains("RESET"));
        assert!(serialized.contains("null"));
    }
}
