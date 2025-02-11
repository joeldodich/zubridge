use super::*;

#[tauri::command]
pub async fn get_state(app: AppHandle<impl Runtime>) -> Result<serde_json::Value, String> {
    println!("Zuri: get-state command called");
    let state = {
        let state = app.state::<Mutex<serde_json::Value>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        let value = guard.clone();
        println!("Zuri: returning state: {}", value);
        value
    };
    Ok(state)
}

#[tauri::command]
pub async fn set_state(app: AppHandle<impl Runtime>, state: serde_json::Value) -> Result<(), String> {
    println!("Zuri: set-state command called with state: {}", state);
    {
        let current_state = app.state::<Mutex<serde_json::Value>>();
        let mut guard = current_state.lock().map_err(|e| e.to_string())?;
        *guard = state;
    }
    Ok(())
}

#[tauri::command]
pub async fn dispatch(app: AppHandle<impl Runtime>, action: Action) -> Result<(), String> {
    println!("Zuri: dispatch command called with action: {:?}", action);
    app.emit_all("zuri:action", action).map_err(|e| e.to_string())
}
