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
