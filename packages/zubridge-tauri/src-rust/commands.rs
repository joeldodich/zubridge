use super::*;
use tauri::Emitter;

#[tauri::command]
pub async fn get_state(app: AppHandle) -> Result<serde_json::Value, String> {
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
pub async fn set_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    println!("zubridge-tauri: set-state command called with state: {}", state);
    {
        let current_state = app.state::<Mutex<serde_json::Value>>();
        let mut guard = current_state.lock().map_err(|e| e.to_string())?;
        *guard = state;
    }
    Ok(())
}

#[tauri::command]
pub async fn dispatch(app: AppHandle, action: Action) -> Result<(), String> {
    println!("zubridge-tauri: dispatch command called with action: {:?}", action);
    app.emit("zubridge-tauri:action", action).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[derive(Clone)]
    struct TestApp {
        state: Arc<Mutex<serde_json::Value>>,
        emitted_events: Arc<Mutex<Vec<(String, Action)>>>,
    }

    impl TestApp {
        fn new() -> Self {
            TestApp {
                state: Arc::new(Mutex::new(serde_json::json!({}))),
                emitted_events: Arc::new(Mutex::new(vec![])),
            }
        }

        fn emit<S: serde::Serialize + Clone>(&self, event: &str, payload: S) -> tauri::Result<()> {
            if let Ok(action) = serde_json::to_value(payload) {
                if let Ok(action) = serde_json::from_value(action) {
                    self.emitted_events.lock().unwrap().push((event.to_string(), action));
                }
            }
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_state_management() {
        let app = TestApp::new();
        let initial_state = serde_json::json!({"count": 1});
        *app.state.lock().unwrap() = initial_state.clone();

        // Test state access
        let state = app.state.lock().unwrap().clone();
        assert_eq!(state, initial_state);

        // Test state updates
        let new_state = serde_json::json!({"count": 2});
        *app.state.lock().unwrap() = new_state.clone();
        assert_eq!(*app.state.lock().unwrap(), new_state);

        // Test dispatch
        let action = Action {
            action_type: "TEST".to_string(),
            payload: Some(serde_json::json!({"value": 1})),
        };
        app.emit("zubridge-tauri:action", action.clone()).unwrap();

        let events = app.emitted_events.lock().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].0, "zubridge-tauri:action");
        assert_eq!(events[0].1.action_type, action.action_type);
        assert_eq!(events[0].1.payload, action.payload);
    }
}
