use crate::AppState; // Import AppState from lib.rs
use tauri::{
    Emitter, // Add Emitter back for app_handle.emit
    menu::{Menu, MenuItem, PredefinedMenuItem}, // Use PredefinedMenuItem for separator
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
// Import the action struct from lib.rs
// use crate::ZubridgeAction;

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

// Handles menu item clicks - Modify state directly and emit event
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    // Get managed state and app handle for emitting
    let state = app.state::<AppState>();
    let app_handle = app.clone(); // Clone handle for emitting
    // Flag to track if state changed
    let mut state_changed = false;

    match id {
        "increment" => {
            println!("Tray: Increment clicked");
            // Modify state directly
            state.increment();
            state_changed = true;
        }
        "decrement" => {
            println!("Tray: Decrement clicked");
            // Modify state directly
            state.decrement();
            state_changed = true;
        }
        "quit" => {
            println!("Tray: Quit clicked");
            std::process::exit(0); // Exit directly
        }
        // Ignore clicks on display item or unknown ids
        _ => {},
    }

    // --- Emit State Update if Changed ---
    if state_changed {
        let current_state_clone = {
            // Lock, clone, and immediately drop the lock
            let locked_state = state.0.lock().unwrap();
            locked_state.clone()
        };

        println!("Tray: Emitting state update event with state: {:?}", current_state_clone);
        if let Err(e) = app_handle.emit("__zubridge_state_update", current_state_clone) {
            eprintln!("Tray: Error emitting state update event: {}", e);
        }
    }
}

// Sets up the system tray
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Get initial state to create the first menu
    let initial_state = app.state::<AppState>().0.lock().unwrap().clone();
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
