# Getting Started with @zubridge/tauri

## Installation

Install Zubridge and its peer dependencies:

```bash
npm i @zubridge/tauri zustand @tauri-apps/api
# or using yarn
yarn add @zubridge/tauri zustand @tauri-apps/api
# or using pnpm
pnpm add @zubridge/tauri zustand @tauri-apps/api
```

## Basic Setup

The Zubridge Tauri package provides a state management solution that bridges the backend (Rust) and frontend (JS/TS) processes in Tauri applications. This allows using a single Zustand store across your entire application.

### Core Concepts

1. **Backend Process Store**: A Zustand store created in your TypeScript code that integrates with the Tauri Rust backend
2. **Frontend Process Bridge**: A React hook and dispatch API that connects to the backend process store
3. **State Synchronization**: Automatic synchronization of state between processes
4. **Action Handling**: Dispatching actions from the frontend to be processed in the backend process

## Quick Start

### 1. Set up the Tauri Commands in Rust

First, add the `zubridge-tauri` crate to your `Cargo.toml`:

```toml
[dependencies]
zubridge-tauri = "0.1.0"
# other dependencies
```

Register the necessary commands in your `main.rs` file:

```rust
use tauri::Manager;
use std::sync::Mutex;

#[tauri::command]
fn get_state(state: tauri::State<'_, Mutex<serde_json::Value>>) -> Result<serde_json::Value, String> {
    match state.lock() {
        Ok(state) => Ok(state.clone()),
        Err(_) => Err("Failed to acquire state lock".into()),
    }
}

#[tauri::command]
fn set_state(state: tauri::State<'_, Mutex<serde_json::Value>>, new_state: serde_json::Value) -> Result<(), String> {
    match state.lock() {
        Ok(mut state) => {
            *state = new_state;
            Ok(())
        },
        Err(_) => Err("Failed to acquire state lock".into()),
    }
}

#[tauri::command]
fn update_state(state: tauri::State<'_, Mutex<serde_json::Value>>, update: serde_json::Value) -> Result<(), String> {
    match state.lock() {
        Ok(mut state) => {
            // Merge the update into the state
            if let Some(update_obj) = update.as_object() {
                if let Some(state_obj) = state.as_object_mut() {
                    for (key, value) in update_obj {
                        state_obj.insert(key.clone(), value.clone());
                    }
                }
            }
            Ok(())
        },
        Err(_) => Err("Failed to acquire state lock".into()),
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(serde_json::json!({ "counter": 0 })))  // Initial state
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_state,
            update_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2. Create the Backend Process Store

Create a Zustand store in your TypeScript code:

```typescript
// src/backend/store.ts
import { createStore } from 'zustand/vanilla';
import { backendZustandBridge } from '@zubridge/tauri';
import type { State } from '../types';

// Define your state type
export type State = {
  counter: number;
  // other state properties
};

// Create the store with initial state
export const store = createStore<State>()(() => ({
  counter: 0,
  // other initial values
}));

// Initialize the zubridge bridge
export const initBridge = async () => {
  try {
    // Set up the bridge with your store
    await backendZustandBridge(store);
    console.log('Zubridge initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Zubridge:', error);
  }
};
```

### 3. Create Action Handlers or Reducers

You can use either action handlers or reducers to update your state:

#### Using Action Handlers:

```typescript
// src/features/counter.ts
import type { State } from '../types';

// Action handlers
export const counterHandlers = {
  'COUNTER:INCREMENT': (state: State) => ({ ...state, counter: state.counter + 1 }),
  'COUNTER:DECREMENT': (state: State) => ({ ...state, counter: state.counter - 1 }),
  'COUNTER:SET': (state: State, payload: number) => ({ ...state, counter: payload }),
};
```

#### Using Reducers:

```typescript
// src/features/counter.ts
import type { State } from '../types';
import type { Action } from '@zubridge/tauri';

export const counterReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'COUNTER:INCREMENT':
      return { ...state, counter: state.counter + 1 };
    case 'COUNTER:DECREMENT':
      return { ...state, counter: state.counter - 1 };
    case 'COUNTER:SET':
      return { ...state, counter: action.payload as number };
    default:
      return state;
  }
};
```

### 4. Set Up the Frontend Process

Create a bridge in your frontend process:

```typescript
// src/frontend/store.ts
import { createUseStore } from '@zubridge/tauri';
import type { State } from '../types';

// Create a hook for accessing the store
export const useStore = createUseStore<State>();

// Create a dispatch function for sending actions
export const { dispatch } = useStore;
```

### 5. Use the Store in Components

```tsx
// src/frontend/Counter.tsx
import React from 'react';
import { useStore, dispatch } from './store';

export const Counter: React.FC = () => {
  // Get counter value from store
  const counter = useStore((state) => state.counter);

  return (
    <div>
      <h1>Counter: {counter}</h1>
      <button onClick={() => dispatch('COUNTER:DECREMENT')}>-</button>
      <button onClick={() => dispatch('COUNTER:INCREMENT')}>+</button>
    </div>
  );
};
```

## Additional Documentation

For more detailed information, refer to these guides:

- [Backend Process Guide](./backend-process.md)
- [Frontend Process Guide](./frontend-process.md)
- [API Reference](./api-reference.md)

## Multi-Window Support

One of the key features of Zubridge is its support for multiple windows. State updates are automatically synchronized across all windows, ensuring a consistent state throughout your application.

When a new window is created, it automatically receives the current state and subscribes to future updates. This works seamlessly whether windows are created from the backend process or from other frontend processes.

```typescript
// Example of creating a new window
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// Create a new window
const newWindow = new WebviewWindow('secondWindow', {
  url: '/', // Use your app's URL
  title: 'Second Window',
});

// The new window will automatically receive the current state
```
