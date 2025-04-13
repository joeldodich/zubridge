use crate::{AppState, CounterState}; // Import AppState and CounterState
use tauri::{
    AppHandle,
    CustomMenuItem, // Use CustomMenuItem for menu items in v1
    Manager,
    SystemTray, // Use SystemTray for the tray definition
    SystemTrayEvent, // Use SystemTrayEvent for event matching
    SystemTrayMenu, // Use SystemTrayMenu for the menu
    SystemTrayMenuItem, // Use SystemTrayMenuItem for predefined items
};
// Import the action struct from lib.rs
// use crate::ZubridgeAction;

// Create the initial system tray definition
pub fn create_tray() -> SystemTray {
    // Here we create the menu items struct
    let counter_display = CustomMenuItem::new("counter_display".to_string(), "Counter: 0").disabled(); // Initial state, disabled
    let increment = CustomMenuItem::new("increment".to_string(), "Increment");
    let decrement = CustomMenuItem::new("decrement".to_string(), "Decrement");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    // Here we define the menu structure using the items
    let tray_menu = SystemTrayMenu::new()
        .add_item(counter_display)
        .add_native_item(SystemTrayMenuItem::Separator) // Use native separator
        .add_item(increment)
        .add_item(decrement)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    // We configure the tray instance
    SystemTray::new().with_menu(tray_menu)
    // .with_id("main-tray") // v1 doesn't use ID here, use tray_handle()
    // Icon path defined in tauri.conf.json
}

// Function to create an updated menu based on state (used for updates)
pub fn create_menu(current_state: &CounterState) -> SystemTrayMenu {
    // Create items (these calls are not fallible)
    let counter_display = CustomMenuItem::new(
        "counter_display".to_string(),
        format!("Counter: {}", current_state.counter),
    )
    .disabled();
    let increment = CustomMenuItem::new("increment".to_string(), "Increment");
    let decrement = CustomMenuItem::new("decrement".to_string(), "Decrement");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    // Build the menu - item addition is not fallible here
    let menu = SystemTrayMenu::new()
        .add_item(counter_display)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(increment)
        .add_item(decrement)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    menu // Return menu directly
}

// Handles tray events (menu clicks, icon clicks)
pub fn handle_tray_event(app_handle: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => {
            let state = app_handle.state::<AppState>();
            let mut state_changed = false;

            match id.as_str() {
                "increment" => {
                    println!("Tray: Increment clicked");
                    state.0.lock().unwrap().counter += 1;
                    state_changed = true;
                }
                "decrement" => {
                    println!("Tray: Decrement clicked");
                    state.0.lock().unwrap().counter -= 1;
                    state_changed = true;
                }
                "quit" => {
                    println!("Tray: Quit clicked");
                    app_handle.exit(0);
                }
                _ => {},
            }

            if state_changed {
                let current_state_clone = state.0.lock().unwrap().clone();
                println!("Tray: Emitting state update event with state: {:?}", current_state_clone);
                // Use emit_all from Manager trait
                if let Err(e) = app_handle.emit_all("__zubridge_state_update", current_state_clone) {
                    eprintln!("Tray: Error emitting state update event: {}", e);
                }
            }
        }
        SystemTrayEvent::LeftClick { position, size, .. } => {
            println!("Tray Icon Left Clicked: pos={:?}, size={:?}", position, size);
            // Optionally show the main window on left click
            if let Some(window) = app_handle.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::RightClick { position, size, .. } => {
            println!("Tray Icon Right Clicked: pos={:?}, size={:?}", position, size);
        }
        SystemTrayEvent::DoubleClick { position, size, .. } => {
            println!("Tray Icon Double Clicked: pos={:?}, size={:?}", position, size);
        }
        _ => {},
    }
}

// REMOVED: setup_tray function (integrated into lib.rs Builder setup)
