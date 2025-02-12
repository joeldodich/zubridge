use tauri::{
    AppHandle, Manager, Runtime, Emitter,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
use serde_json::json;
use std::sync::Mutex;

/// Create a menu for the tray
pub fn create_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    let counter_value = app
        .state::<Mutex<serde_json::Value>>()
        .try_lock()
        .map(|state| state["counter"].as_i64().unwrap_or(0))
        .unwrap_or(0);

    let counter = MenuItem::with_id(app, "counter", format!("Counter: {}", counter_value), false, None::<&str>)?;
    let increment = MenuItem::with_id(app, "increment", "Increment", true, None::<&str>)?;
    let decrement = MenuItem::with_id(app, "decrement", "Decrement", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(app, &[&counter, &increment, &decrement, &quit])
}

/// Create the tray icon
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), tauri::Error> {
    let menu = create_tray_menu(app)?;
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            match event.id.0.as_str() {
                "quit" => std::process::exit(0),
                "increment" | "decrement" => {
                    let new_state = {
                        let state = app.state::<Mutex<serde_json::Value>>();
                        let mut state_guard = match state.lock() {
                            Ok(guard) => guard,
                            Err(_) => return,
                        };

                        let counter = state_guard["counter"].as_i64().unwrap_or(0);
                        let new_counter = if event.id.0.as_str() == "increment" {
                            counter + 1
                        } else {
                            counter - 1
                        };

                        let new_state = json!({ "counter": new_counter });
                        *state_guard = new_state.clone();
                        new_state
                    };

                    let _ = app.emit("zubridge-tauri:state-update", new_state);

                    if let Some(tray) = app.tray_by_id("main-tray") {
                        if let Ok(menu) = create_tray_menu(app) {
                            let _ = tray.set_menu(Some(menu));
                        }
                    }
                }
                _ => (),
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the tray menu
pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>, _state: &serde_json::Value) {
    if let Ok(menu) = create_tray_menu(app) {
        if let Some(tray) = app.tray_by_id("main-tray") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

