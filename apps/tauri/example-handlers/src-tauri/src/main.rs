#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tray;

use tauri::Manager;
use tauri::Listener;
use tauri::Emitter;
use zubridge_tauri::commands;
use std::sync::{Arc, Mutex};
use zubridge_tauri::types::Action;
use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

#[tauri::command]
fn create_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    println!("Creating window with label: {}", label);

    // List all existing windows for debugging
    let existing_windows = app.webview_windows()
        .into_iter()
        .map(|(label, _)| label)
        .collect::<Vec<_>>();
    println!("Existing windows: {:?}", existing_windows);

    // Create a new window using WebviewWindowBuilder with app handle as first parameter (Tauri v2)
    match WebviewWindowBuilder::new(
        &app,
        label.clone(),
        WebviewUrl::App("/".into())
    )
    .title("Runtime Window")
    .inner_size(320.0, 380.0)
    .build() {
        Ok(_) => {
            println!("Window created successfully with label: {}", label);
            Ok(())
        },
        Err(err) => {
            println!("Error creating window: {}", err);
            Err(format!("Error creating window: {}", err))
        }
    }
}

#[tauri::command]
fn close_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    match app.get_webview_window(&label) {
        Some(window) => {
            println!("Closing window with label: {}", label);
            window.close()
                .map_err(|err| format!("Error closing window: {}", err))
        },
        None => {
            let error = format!("Window with label '{}' not found", label);
            println!("{}", error);
            Err(error)
        }
    }
}

fn main() {
    println!("Starting zubridge-tauri example app");

    println!("Main: Creating builder");
    let app_handle = Arc::new(Mutex::new(None));
    let app_handle_setup = app_handle.clone();

    tauri::Builder::default()
        .setup(move |app| {
            // Create initial state
            let initial_state = serde_json::json!({ "counter": 0 });
            app.manage(Mutex::new(initial_state.clone()));
            app.emit("zubridge-tauri:state-update", initial_state.clone()).unwrap();

            // Setup tray and state management
            let handle = app.handle();
            *app_handle_setup.lock().unwrap() = Some(handle.clone());
            tray::setup_tray(&handle)?;

            // Listen for window creation action
            let window_creation_handle = handle.clone();
            app.listen_any("zubridge-tauri:action", move |event: tauri::Event| {
                // Event handling code for zubridge-tauri:action
                let payload_str = event.payload();
                if let Ok(action) = serde_json::from_str::<Action>(payload_str) {
                    println!("Received action: {:?}", action);

                    if action.action_type == "WINDOW:CREATE" {
                        // Generate a unique label for the new window
                        let window_label = format!("runtime-{}", std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis());

                        println!("Creating window with label: {} from event", window_label);

                        // Create the window
                        if let Err(e) = create_window(window_creation_handle.clone(), window_label.clone()) {
                            println!("Error creating window: {}", e);
                        } else {
                            println!("Window created successfully: {}", window_label);
                        }
                    } else if action.action_type == "WINDOW:CLOSE" {
                        if let Some(value) = action.payload {
                            if let Some(payload_obj) = value.as_object() {
                                if let Some(window_id) = payload_obj.get("windowId").and_then(|v| v.as_str()) {
                                    if let Err(e) = close_window(window_creation_handle.clone(), window_id.to_string()) {
                                        println!("Error closing window: {}", e);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Update counter display thread
            let handle_for_thread = handle.clone();
            let initial_thread_state = initial_state.clone();
            std::thread::spawn(move || {
                let mut last_state = initial_thread_state;
                loop {
                    if let Ok(state) = handle_for_thread.state::<Mutex<serde_json::Value>>().try_lock() {
                        let current = state.clone();
                        if last_state != current {
                            drop(state);
                            tray::update_tray_menu(&handle_for_thread, &current);
                            last_state = current;
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::set_state,
            commands::update_state,
            create_window,
            close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
