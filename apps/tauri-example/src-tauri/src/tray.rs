// Remove unused import
// use crate::AppState;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use zubridge_backend_core::ZubridgeAction;

// Make create_menu public so it can be called from lib.rs
pub fn create_menu<R: Runtime>(app: &AppHandle<R>, current_state: &crate::CounterState) -> tauri::Result<Menu<R>> {
    // Display current count (disabled item)
    let counter_display = MenuItem::with_id(app, "counter_display", format!("Counter: {}", current_state.counter), false, None::<&str>)?;
    // Use shorter names like reference
    let increment = MenuItem::with_id(app, "increment", "Increment", true, None::<&str>)?;
    let decrement = MenuItem::with_id(app, "decrement", "Decrement", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &counter_display, // Add the display item
        &PredefinedMenuItem::separator(app)?,
        &increment,
        &decrement,
        &PredefinedMenuItem::separator(app)?,
        &quit,
    ])?;
    Ok(menu)
}

// Handles menu item clicks - Use Zubridge commands
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "increment" => {
            println!("Tray: Increment clicked");
            // Dispatch action using zubridge command
            let action = ZubridgeAction {
                action_type: "INCREMENT_COUNTER".to_string(),
                payload: None,
            };

            // Invoke the zubridge dispatch command
            let _ = app.invoke("__zubridge_dispatch_action", &serde_json::json!({ "action": action }));
        }
        "decrement" => {
            println!("Tray: Decrement clicked");
            // Dispatch action using zubridge command
            let action = ZubridgeAction {
                action_type: "DECREMENT_COUNTER".to_string(),
                payload: None,
            };

            // Invoke the zubridge dispatch command
            let _ = app.invoke("__zubridge_dispatch_action", &serde_json::json!({ "action": action }));
        }
        "quit" => {
            println!("Tray: Quit clicked");
            let _ = app.invoke("quit_app", &serde_json::json!({}));
        }
        // Ignore clicks on display item or unknown ids
        _ => {},
    }
}

// Sets up the system tray
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Create initial menu with default state values
    let initial_state = crate::CounterState::default();
    let menu = create_menu(app, &initial_state)?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Zubridge Tauri Example")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
            // Ensure conversion from MenuId -> &str using as_ref()
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|_tray, event| {
            if let TrayIconEvent::Click {
                id, rect, position, ..
            } = event
            {
                println!("Tray Icon Clicked: id={:?}, rect={:?}, position={:?}", id, rect, position);
                // If you want left-click to show window, you need the app handle
                // Maybe pass app handle to this closure if needed, or handle differently
            }
        })
        .build(app)?;

    Ok(())
}
