#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod tray;

use tauri::{Manager};
use zubridge_tauri::commands;
use std::sync::{Arc, Mutex};

fn main() {
    println!("Main: Starting up");

    println!("Main: Creating builder");
    let app_handle = Arc::new(Mutex::new(None));
    let app_handle_setup = app_handle.clone();

    tauri::Builder::default()
        .setup(move |app| {
            println!("Main: Setup called");
            #[cfg(debug_assertions)]
            {
                println!("Main: Debug mode enabled");
            }

            // Create initial state
            let initial_state = serde_json::json!({ "counter": 0 });
            app.manage(Mutex::new(initial_state.clone()));

            // Store app handle
            let handle = app.handle();
            *app_handle_setup.lock().unwrap() = Some(handle.clone());

            // Create menu
            let menu = tray::create_menu(&handle);
            app.get_webview_window("main")
                .expect("no window found")
                .set_menu(menu)
                .expect("failed to set menu");

            // Update counter display
            let handle_for_thread = handle.clone();
            std::thread::spawn(move || {
                let mut last_state = initial_state.clone();
                loop {
                    if let Ok(state) = handle_for_thread.state::<Mutex<serde_json::Value>>().lock() {
                        if last_state != *state {
                            tray::update_counter(&handle_for_thread, &state);
                            last_state = state.clone();
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });

            Ok(())
        })
        .on_menu_event(move |app, event| {
            tray::handle_menu_event(app, event);
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::set_state,
            commands::dispatch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
