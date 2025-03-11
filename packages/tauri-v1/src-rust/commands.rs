use super::*;

#[tauri::command]
pub async fn get_state(app: AppHandle<impl Runtime>) -> Result<serde_json::Value, String> {
    println!("zubridge-tauri-v1: get-state command called");
    let state = {
        let state = app.state::<Mutex<serde_json::Value>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        let value = guard.clone();
        println!("zubridge-tauri-v1: returning state: {}", value);
        value
    };
    Ok(state)
}

#[tauri::command]
pub async fn set_state(app: AppHandle<impl Runtime>, state: serde_json::Value) -> Result<(), String> {
    println!("zubridge-tauri-v1: set-state command called with state: {}", state);
    {
        let current_state = app.state::<Mutex<serde_json::Value>>();
        let mut guard = current_state.lock().map_err(|e| e.to_string())?;
        *guard = state;
    }
    Ok(())
}

#[tauri::command]
pub async fn dispatch(app: AppHandle<impl Runtime>, action: Action) -> Result<(), String> {
    println!("zubridge-tauri-v1: dispatch command called with action: {:?}", action);
    app.emit_all("zubridge-tauri-v1:action", action).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_state_operations() {
        let state = Arc::new(Mutex::new(serde_json::json!({})));
        let initial_state = serde_json::json!({ "counter": 42 });

        {
            let mut guard = state.lock().unwrap();
            *guard = initial_state.clone();
        }

        let value = {
            let guard = state.lock().unwrap();
            guard.clone()
        };

        assert_eq!(value, initial_state);
    }

    #[test]
    fn test_action_creation() {
        let action = Action {
            action_type: "INCREMENT".to_string(),
            payload: Some(serde_json::json!({ "counter": 1 })),
        };

        assert_eq!(action.action_type, "INCREMENT");
        assert!(action.payload.is_some());
    }
}
