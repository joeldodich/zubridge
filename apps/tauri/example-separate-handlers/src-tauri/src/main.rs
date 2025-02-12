#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tray;

use tauri::{Manager, Emitter};
use zubridge_tauri::commands;
use std::sync::{Arc, Mutex};

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
            let _ = app.emit("zubridge-tauri:state-update", initial_state.clone());

            // Setup tray and state management
            let handle = app.handle();
            *app_handle_setup.lock().unwrap() = Some(handle.clone());
            tray::setup_tray(&handle)?;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
