use super::*;

#[tauri::command]
pub async fn get_state(app: AppHandle<impl Runtime>) -> Result<serde_json::Value, String> {
    println!("zubridge-tauri: get-state command called");
    let state = {
        let state = app.state::<Mutex<serde_json::Value>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        let value = guard.clone();
        println!("zubridge-tauri: returning state: {}", value);
        value
    };
    Ok(state)
}

#[tauri::command]
pub async fn set_state(app: AppHandle<impl Runtime>, state: serde_json::Value) -> Result<(), String> {
    println!("zubridge-tauri: set-state command called with state: {}", state);
    {
        let current_state = app.state::<Mutex<serde_json::Value>>();
        let mut guard = current_state.lock().map_err(|e| e.to_string())?;
        *guard = state;
    }
    Ok(())
}

#[tauri::command]
pub async fn dispatch(app: AppHandle<impl Runtime>, action: Action) -> Result<(), String> {
    println!("zubridge-tauri: dispatch command called with action: {:?}", action);
    app.emit_all("zubridge-tauri:action", action).map_err(|e| e.to_string())
}
