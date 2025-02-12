#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod tray;

use tauri::Manager;
use std::sync::Mutex;

fn main() {
    println!("Main: Starting up");
    let system_tray = tray::create_tray();

    #[cfg(debug_assertions)]
    {
        zubridge_tauri::__debug_init();
        println!("Main: Registering commands");
    }

    println!("Main: Creating builder");
    tauri::Builder::default()
        .setup(move |app| {
            println!("Main: Setup called");

            // Create initial state
            let initial_state = serde_json::json!({ "counter": 0 });
            app.manage(Mutex::new(initial_state.clone()));

            let app_handle = app.handle();

            // Set initial tray title after a short delay
            let app_handle_clone = app_handle.clone();
            let initial_state_clone = initial_state.clone();
            std::thread::spawn(move || {
                // Give the tray time to initialize
                std::thread::sleep(std::time::Duration::from_millis(100));
                tray::update_tray_title(&app_handle_clone, &initial_state_clone);
            });

            // Subscribe to state changes via get_state polling
            let app_handle_clone = app_handle.clone();
            let initial_state_clone = initial_state.clone();
            std::thread::spawn(move || {
                let mut last_state = Some(initial_state_clone);
                loop {
                    if let Ok(state) = app_handle_clone.state::<Mutex<serde_json::Value>>().lock() {
                        if last_state.as_ref() != Some(&*state) {
                            tray::update_tray_title(&app_handle_clone, &state);
                            last_state = Some(state.clone());
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });

            Ok(())
        })
        .system_tray(system_tray)
        .on_system_tray_event(tray::handle_tray_event)
        .invoke_handler(tauri::generate_handler![
            zubridge_tauri::commands::get_state,
            zubridge_tauri::commands::set_state,
            zubridge_tauri::commands::dispatch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
