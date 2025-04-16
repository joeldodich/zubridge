# Migration Guide: Zubridge Electron Backend Contract

This guide helps you migrate from the previous Zubridge Electron architecture to the new backend contract approach.

## Why Migrate?

The new backend contract offers several benefits:

- Greater flexibility to use any state management solution in the main process
- Clearer separation between backend (authoritative) and frontend (replica) states
- More standardized communication protocol
- Compatibility with other data stores beyond Zustand

## Migration Steps

### 1. Update Your Dependencies

Ensure you're using the latest version of `@zubridge/electron`:

```bash
npm install @zubridge/electron@latest
# or
yarn add @zubridge/electron@latest
# or
pnpm add @zubridge/electron@latest
```

> **Note:** For transitional compatibility, `mainZustandBridge` is now an alias for `createZustandBridge` and uses the new IPC channels. You can continue using `mainZustandBridge` temporarily, but are encouraged to update your imports to use `createZustandBridge` directly. Both functions have identical signatures and accept the same options, making the migration as simple as renaming your imports.

### 2. Main Process Code Changes

#### Before (Zustand-specific approach):

```javascript
// main.js
import { mainZustandBridge } from '@zubridge/electron/main';
import { createStore } from 'zustand/vanilla';

// Create a Zustand store
const store = createStore((set) => ({
  counter: 0,
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  decrement: () => set((state) => ({ counter: state.counter - 1 })),
}));

// Initialize the bridge when your app is ready
app.whenReady().then(() => {
  // Create the main window
  const mainWindow = new BrowserWindow({
    // window configuration...
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Initialize the bridge with the window
  mainZustandBridge(store, [mainWindow]);
});
```

#### After (New Backend Contract):

Option 1: Using the `createZustandBridge` adapter (easiest migration path):

The `createZustandBridge` function has the exact same signature as `mainZustandBridge`, making migration straightforward. All options like `handlers` and `reducer` continue to work as before.

```javascript
// main.js
import { createZustandBridge } from '@zubridge/electron/main';
import { createStore } from 'zustand/vanilla';

// Create a Zustand store
const store = createStore((set) => ({
  counter: 0,
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  decrement: () => set((state) => ({ counter: state.counter - 1 })),
}));

// Initialize the bridge when your app is ready
app.whenReady().then(() => {
  // Create the main window
  const mainWindow = new BrowserWindow({
    // window configuration...
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Example 1: Basic usage - identical to previous mainZustandBridge
  createZustandBridge(store, [mainWindow]);

  // Example 2: With handlers option - identical to previous mainZustandBridge
  createZustandBridge(store, [mainWindow], {
    handlers: {
      CUSTOM_ACTION: (payload) => {
        console.log('Custom action received:', payload);
        store.setState((state) => ({ ...state, customValue: payload }));
      },
    },
  });

  // Example 3: With reducer option - identical to previous mainZustandBridge
  createZustandBridge(store, [mainWindow], {
    reducer: (state, action) => {
      switch (action.type) {
        case 'SET_VALUE':
          return { ...state, value: action.payload };
        case 'RESET':
          return { counter: 0 };
        default:
          return state;
      }
    },
  });
});
```

Option 2: Using the generic bridge with a custom state manager:

```javascript
// main.js
import { createGenericBridge } from '@zubridge/electron/main';
import { ipcMain } from 'electron';

// Define your state
const appState = {
  counter: 0,
};

// Create a simple state manager
const stateManager = {
  getState: () => appState,

  // Simple event emitter implementation
  listeners: new Set(),
  subscribe: (listener) => {
    stateManager.listeners.add(listener);
    return () => {
      stateManager.listeners.delete(listener);
    };
  },

  // Process actions to update state
  processAction: (action) => {
    switch (action.type) {
      case 'INCREMENT':
        appState.counter += 1;
        break;
      case 'DECREMENT':
        appState.counter -= 1;
        break;
      default:
        console.log('Unknown action:', action.type);
    }

    // Notify all listeners about the state change
    stateManager.listeners.forEach((listener) => {
      listener(appState);
    });
  },
};

// Initialize the bridge when your app is ready
app.whenReady().then(() => {
  // Create the main window
  const mainWindow = new BrowserWindow({
    // window configuration...
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Initialize the bridge with the window
  createGenericBridge(stateManager, [mainWindow]);
});
```

### 3. Preload Script Changes

> **Note:** Similar to the main process, `preloadZustandBridge` is now an alias for `preloadBridge` and uses the new IPC channels. You can continue using `preloadZustandBridge` temporarily, but are encouraged to update your imports to use `preloadBridge` directly. The API is identical, making migration as simple as updating your import statements.

#### Before:

```javascript
// preload.js
import { preloadZustandBridge } from '@zubridge/electron/preload';
import { contextBridge } from 'electron';

// Initialize the handlers
const { handlers } = preloadZustandBridge();

// Expose the handlers through the contextBridge
contextBridge.exposeInMainWorld('zubridge', handlers);
```

#### After:

```javascript
// preload.js
import { preloadBridge } from '@zubridge/electron/preload';
import { contextBridge } from 'electron';

// Initialize the handlers
const { handlers } = preloadBridge();

// Expose the handlers through the contextBridge
contextBridge.exposeInMainWorld('zubridge', handlers);
```

### 4. Renderer Process (No Changes Required)

The renderer process code using Zustand remains the same:

```javascript
// renderer.js
import { createUseStore, useDispatch } from '@zubridge/electron';
import { useEffect } from 'react';

// Create the useStore hook
const useStore = createUseStore();

// Create a component using the store
function Counter() {
  const counter = useStore((state) => state.counter);
  const dispatch = useDispatch();

  return (
    <div>
      <h1>Count: {counter}</h1>
      <button onClick={() => dispatch('INCREMENT')}>+</button>
      <button onClick={() => dispatch('DECREMENT')}>-</button>
    </div>
  );
}
```

## Using Alternative State Management Libraries

One of the key benefits of the new backend contract is the ability to use alternative state management libraries in your renderer process. Here's how to use the backend contract with Redux:

```javascript
// renderer-redux.js
import { createStore } from 'redux';
import { useSelector, useDispatch, Provider } from 'react-redux';
import { useEffect } from 'react';

// Define a Redux reducer
const reducer = (state = { counter: 0 }, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, counter: state.counter + 1 };
    case 'DECREMENT':
      return { ...state, counter: state.counter - 1 };
    case 'SET_STATE':
      return { ...action.payload };
    default:
      return state;
  }
};

// Create a Redux store
const reduxStore = createStore(reducer);

// Create a bridge to connect to the Electron backend
const connectToBackend = () => {
  // Get initial state
  window.zubridge.getState().then((initialState) => {
    reduxStore.dispatch({ type: 'SET_STATE', payload: initialState });
  });

  // Subscribe to state updates
  window.zubridge.subscribe((newState) => {
    reduxStore.dispatch({ type: 'SET_STATE', payload: newState });
  });
};

// Connect backend when the app initializes
connectToBackend();

// Create a component using Redux
function Counter() {
  const counter = useSelector((state) => state.counter);
  const dispatch = useDispatch();

  // Wrap dispatch to send actions to the backend
  const backendDispatch = (action) => {
    window.zubridge.dispatch(action);
    return action; // For Redux middleware compatibility
  };

  return (
    <div>
      <h1>Count: {counter}</h1>
      <button onClick={() => backendDispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => backendDispatch({ type: 'DECREMENT' })}>-</button>
    </div>
  );
}

// Wrap your app with Redux Provider
function App() {
  return (
    <Provider store={reduxStore}>
      <Counter />
    </Provider>
  );
}
```

## Conclusion

Migrating to the new backend contract provides more flexibility while maintaining the simplicity of the previous Zubridge approach. You can choose to keep using Zustand in the main process (with the Zustand adapter) or switch to a completely different state management approach.
