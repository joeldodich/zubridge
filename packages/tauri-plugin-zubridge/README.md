# Tauri Plugin Zubridge

A Tauri plugin for state management between frontend and backend. This plugin is the core of the Zubridge system, which provides a simple way to share state between your frontend and backend code.

## Installation

Add the plugin to your `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-zubridge = { path = "../path/to/tauri-plugin-zubridge" }
```

## Usage

### Setup the Plugin

Create a state manager that implements the `StateManager` trait:

```rust
use tauri_plugin_zubridge::{StateManager, JsonValue};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppState {
    counter: i32,
    theme: ThemeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThemeState {
    is_dark: bool,
}

struct AppStateManager {
    state: Mutex<AppState>,
}

impl StateManager for AppStateManager {
    fn get_initial_state(&self) -> JsonValue {
        let state = self.state.lock().unwrap();
        serde_json::to_value(state.clone()).unwrap()
    }

    fn dispatch_action(&mut self, action: JsonValue) -> JsonValue {
        let mut state = self.state.lock().unwrap();

        if let Ok(action_type) = serde_json::from_value::<String>(action["type"].clone()) {
            // Handle actions based on the action_type
            match action_type.as_str() {
                "INCREMENT" => {
                    state.counter += 1;
                },
                "DECREMENT" => {
                    state.counter -= 1;
                },
                "TOGGLE_THEME" => {
                    state.theme.is_dark = !state.theme.is_dark;
                },
                _ => {}
            }
        }

        serde_json::to_value(state.clone()).unwrap()
    }
}
```

### Register the Plugin

Register the plugin in your Tauri application:

```rust
use tauri_plugin_zubridge::{plugin, ZubridgeOptions};

fn main() {
    // Create a state manager
    let state_manager = AppStateManager {
        state: Mutex::new(AppState {
            counter: 0,
            theme: ThemeState { is_dark: false },
        }),
    };

    // Create options for the plugin (or use defaults)
    let options = ZubridgeOptions {
        event_name: "zubridge://state-update".to_string(),
    };

    tauri::Builder::default()
        .plugin(plugin(state_manager, options))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Frontend Integration

There are two main ways to use Zubridge from your frontend:

### 1. Using Zubridge Hooks (Recommended)

The `@zubridge/tauri` package provides hooks that work with any JavaScript framework or vanilla JavaScript, despite their `use` prefix naming convention. They are built on a framework-agnostic foundation using Zustand.

Install the `@zubridge/tauri` package:

```bash
npm install @zubridge/tauri
# or
yarn add @zubridge/tauri
# or
pnpm add @zubridge/tauri
```

Initialize the bridge once at the root of your application:

```typescript
// Example with React
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeBridge } from '@zubridge/tauri';

// Import functions from Tauri API
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Initialize Zubridge *once* before rendering
initializeBridge({
  invoke,
  listen,
  // Optional: Customize command/event names if needed
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// With vanilla JavaScript, you could do:
// document.addEventListener('DOMContentLoaded', () => {
//   initializeBridge({ invoke, listen });
//   // Initialize your app...
// });
```

Then use the hooks in your components:

```typescript
// Example with React
import React from 'react';
import { useZubridgeStore, useZubridgeDispatch } from '@zubridge/tauri';

// Assuming CounterState is your Rust state structure type
import type { CounterState } from '../types';

function Counter() {
  // Access state with a selector
  const counter = useZubridgeStore((state) => (state as CounterState).counter);

  // Get dispatch function
  const dispatch = useZubridgeDispatch();

  // Get the bridge status
  const status = useZubridgeStore((state) => state.__zubridge_status);

  if (status !== 'ready') {
    return <div>Loading state ({status})...</div>;
  }

  const handleIncrement = () => {
    dispatch({ type: 'INCREMENT' });
  };

  const handleDecrement = () => {
    dispatch({ type: 'DECREMENT' });
  };

  const handleToggleTheme = () => {
    dispatch({ type: 'TOGGLE_THEME' });
  };

  return (
    <div>
      <p>Counter Value: {counter ?? 'N/A'}</p>
      <button onClick={handleDecrement}>-</button>
      <button onClick={handleIncrement}>+</button>
      <button onClick={handleToggleTheme}>Toggle Theme</button>
    </div>
  );
}

// With other frameworks like Vue, Svelte, or vanilla JS,
// you would use the same hooks but with that framework's patterns.
// The underlying store mechanism works with any JavaScript environment.
```

### 2. Using the Tauri API Directly

If you prefer not to use the hooks, you can use the Tauri API directly:

```javascript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Get the initial state
async function getInitialState() {
  return await invoke('zubridge.get-initial-state');
}

// Dispatch an action
async function dispatch(actionType, payload = null) {
  return await invoke('zubridge.dispatch-action', {
    action: {
      action_type: actionType,
      payload,
    },
  });
}

// Listen for state updates
let unlistenFn;
async function setupStateListener(callback) {
  unlistenFn = await listen('zubridge://state-update', (event) => {
    console.log('State updated:', event.payload);
    callback(event.payload);
  });
}

// Clean up listener when done
function cleanup() {
  if (unlistenFn) unlistenFn();
}

// Example usage
document.addEventListener('DOMContentLoaded', async () => {
  const initialState = await getInitialState();
  updateUI(initialState);

  await setupStateListener(updateUI);

  document.getElementById('increment-btn').addEventListener('click', () => {
    dispatch('INCREMENT');
  });

  document.getElementById('decrement-btn').addEventListener('click', () => {
    dispatch('DECREMENT');
  });

  function updateUI(state) {
    document.getElementById('counter-value').textContent = state.counter;
    // Update other UI elements based on state
  }
});
```

## Permissions

The plugin requires the following permissions in your capabilities file:

```json
{
  "identifier": "tauri:command",
  "allow": [{ "name": "zubridge.get-initial-state" }, { "name": "zubridge.dispatch-action" }]
}
```

## License

MIT or Apache-2.0
