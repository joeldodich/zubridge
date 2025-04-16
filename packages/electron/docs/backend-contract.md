# Electron Backend Contract

This document details the contract your Electron main process must fulfill to integrate with the `@zubridge/electron` frontend library. This architecture assumes the main process holds the authoritative application state, and the renderer process stores (like Zustand or Redux) act as synchronized replicas.

## Overview

The core idea is to standardize communication between main and renderer processes:

1. **Backend State:** Your authoritative state lives in the main process.
2. **Frontend Replica:** Any state management library in the renderer process can subscribe to state updates.
3. **Synchronization:**
   - The renderer fetches the initial state using a specific IPC channel.
   - The main process emits updates whenever its state changes.
   - The renderer listens for these updates to keep its replica in sync.
   - The renderer sends user actions to the main process using a specific IPC channel.

## 1. Required IPC Channels

Your main process must implement handlers for the following IPC channels:

### a) `__zubridge_get_initial_state`

Fetches the current state for frontend initialization.

```javascript
import { ipcMain } from 'electron';

// Example implementation
ipcMain.handle('__zubridge_get_initial_state', async (event) => {
  try {
    // Return your application's current state
    return yourStateManager.getState();
  } catch (error) {
    console.error('Error getting initial state:', error);
    throw new Error(`Failed to get initial state: ${error.message}`);
  }
});
```

- **Return:** The full current state as a serializable object.

### b) `__zubridge_dispatch_action`

Receives actions from the renderer process, processes them, and updates the state.

```javascript
ipcMain.on('__zubridge_dispatch_action', (event, action) => {
  try {
    console.log('Backend Contract: Received action:', action);

    // Process the action based on its type and payload
    // This is where your state mutation logic lives
    const success = yourStateManager.processAction(action);

    // After the state is updated, emit the new state to all renderer processes
    // This will happen automatically if you're using a state manager that emits updates
  } catch (error) {
    console.error('Error processing action:', error);
  }
});
```

- **Input:** An action object with the structure: `{ type: string, payload?: any }`.
- **Behavior:** Process the action and update the state accordingly.

## 2. Required State Update Emission

Your state manager in the main process **must** emit state updates whenever the state changes. This ensures renderer processes stay in sync with the authoritative state.

```javascript
function emitStateUpdate(newState) {
  // Send the updated state to all renderer processes
  // It's your responsibility to keep track of which BrowserWindow instances
  // should receive these updates
  for (const window of activeWindows) {
    if (!window.isDestroyed() && window.webContents) {
      window.webContents.send('__zubridge_state_update', newState);
    }
  }
}

// Example of integrating with your state manager
yourStateManager.subscribe((newState) => {
  emitStateUpdate(newState);
});
```

- **Channel Name:** `__zubridge_state_update`
- **Payload:** The complete current state.

## 3. Implementation Approaches

There are multiple ways to implement this contract based on your state management preferences:

### Option 1: Simple State Object

For simpler applications, you can maintain a plain JavaScript object:

```javascript
import { ipcMain } from 'electron';
import { BrowserWindow } from 'electron';

// Simple state management
const appState = {
  counter: 0,
  todos: [],
};

// Track active windows
const activeWindows = new Set();

// Initialize window tracking
export function trackWindow(window) {
  activeWindows.add(window);
  window.webContents.on('destroyed', () => {
    activeWindows.delete(window);
  });
}

// Emit state updates to all active windows
function emitStateUpdate() {
  for (const window of activeWindows) {
    if (!window.isDestroyed() && window.webContents) {
      window.webContents.send('__zubridge_state_update', appState);
    }
  }
}

// Process actions
function processAction(action) {
  switch (action.type) {
    case 'INCREMENT':
      appState.counter += 1;
      break;
    case 'ADD_TODO':
      appState.todos.push(action.payload);
      break;
    // Add more cases as needed
    default:
      console.log('Unknown action type:', action.type);
  }

  // Emit the updated state
  emitStateUpdate();
}

// Set up IPC handlers
ipcMain.handle('__zubridge_get_initial_state', () => {
  return appState;
});

ipcMain.on('__zubridge_dispatch_action', (event, action) => {
  processAction(action);
});
```

### Option 2: Redux in Main Process

For more complex state management, you might use Redux in the main process:

```javascript
import { createStore } from 'redux';
import { ipcMain } from 'electron';

// Your Redux reducer
function reducer(state = { counter: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, counter: state.counter + 1 };
    // Add more cases
    default:
      return state;
  }
}

// Create Redux store
const store = createStore(reducer);

// Track active windows and emit updates
const activeWindows = new Set();

export function trackWindow(window) {
  activeWindows.add(window);
  window.webContents.on('destroyed', () => {
    activeWindows.delete(window);
  });

  // Send initial state to the new window
  if (!window.isDestroyed() && window.webContents) {
    window.webContents.send('__zubridge_state_update', store.getState());
  }
}

// Subscribe to store changes
store.subscribe(() => {
  const state = store.getState();

  for (const window of activeWindows) {
    if (!window.isDestroyed() && window.webContents) {
      window.webContents.send('__zubridge_state_update', state);
    }
  }
});

// Set up IPC handlers
ipcMain.handle('__zubridge_get_initial_state', () => {
  return store.getState();
});

ipcMain.on('__zubridge_dispatch_action', (event, action) => {
  store.dispatch(action);
});
```

### Option 3: Using the Zustand Adapter

For applications already using Zustand, we provide an adapter that implements this contract automatically:

```javascript
import { mainZubridgeBridge } from '@zubridge/electron/main';
import { createStore } from 'zustand/vanilla';

// Create your Zustand store
const store = createStore((set) => ({
  counter: 0,
  increment: () => set((state) => ({ counter: state.counter + 1 })),
}));

// Initialize the bridge with active windows
export function initializeBridge(windows) {
  return mainZustandBridge(store, windows);
}
```

## Implementation Notes

- Always handle errors gracefully in your IPC handlers to avoid crashing the application.
- Consider security implications when processing actions from renderer processes.
- Make sure your state is serializable for IPC communication.
- Track BrowserWindow instances to ensure state updates are sent to all active windows.
- For large applications, consider optimizing state updates to only send relevant changes.
