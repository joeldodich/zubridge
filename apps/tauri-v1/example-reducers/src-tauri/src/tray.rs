use tauri::{
    AppHandle, Runtime, Manager, Emitter,
    menu::{MenuBuilder, MenuItemBuilder, MenuEvent, Menu},
};
use serde_json::Value;
use serde_json::json;

/// Create a menu with the default counter text
pub fn create_menu<R: Runtime>(app: &AppHandle<R>) -> Menu<R> {
    create_menu_with_counter(app, "Counter: 0")
}

/// Create a menu with a dynamic counter label.
/// We rebuild the menu so that the counter label can be updated.
pub fn create_menu_with_counter<R: Runtime>(app: &AppHandle<R>, counter_text: &str) -> Menu<R> {
    let counter = MenuItemBuilder::new(counter_text)
        .id("counter")
        .build(app)
        .expect("failed to build counter item");
    let increment = MenuItemBuilder::new("Increment")
        .id("increment")
        .build(app)
        .expect("failed to build increment item");
    let decrement = MenuItemBuilder::new("Decrement")
        .id("decrement")
        .build(app)
        .expect("failed to build decrement item");
    let quit = MenuItemBuilder::new("Quit")
        .id("quit")
        .build(app)
        .expect("failed to build quit item");

    MenuBuilder::new(app)
        .items(&[&counter, &increment, &decrement, &quit])
        .build()
        .expect("failed to build menu")
}

/// Handle a menu event by matching on the menu item's ID.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().0.as_str() {
        "increment" => {
            app.emit("zubridge-tauri:action", json!({
                "type": "INCREMENT",
                "payload": null
            }))
            .unwrap();
        }
        "decrement" => {
            app.emit("zubridge-tauri:action", json!({
                "type": "DECREMENT",
                "payload": null
            }))
            .unwrap();
        }
        "quit" => {
            std::process::exit(0);
        }
        _ => {}
    }
}

/// Update the counter display by rebuilding and setting a new menu on the window.
/// We rebuild the menu because updating an individual menu item isn't as straightforward in Tauri v2.
pub fn update_counter<R: Runtime>(app: &AppHandle<R>, state: &Value) {
    if let Some(counter_val) = state.get("counter") {
        if let Some(counter_num) = counter_val.as_i64() {
            if let Some(window) = app.get_webview_window("main") {
                let new_menu = create_menu_with_counter(app, &format!("Counter: {}", counter_num));
                window.set_menu(new_menu).unwrap();
            }
        }
    }
}
