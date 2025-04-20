# Main Process

This document describes how to set up and use the `@zubridge/electron` package in the main process of your Electron application.

## Bridge Setup Options

Zubridge provides multiple ways to connect your main process state to renderer processes. Choose the approach that best fits your state management solution.

### Option 1: Zustand Integration

For Zustand-based applications (recommended):

```ts
// `src/main/index.ts`
import { app, BrowserWindow } from 'electron';
import { createZustandBridge } from '@zubridge/electron/main';
import { store } from './store.js'; // Your Zustand store

// Create main window
const mainWindow = new BrowserWindow({
  /* config */
});

// Instantiate bridge
const { unsubscribe, subscribe, dispatch, getSubscribedWindows } = createZustandBridge(store, [mainWindow]);

// Use dispatch to send actions
dispatch('COUNTER:INCREMENT');

// Unsubscribe on quit
app.on('quit', unsubscribe);
```

### Option 2: Redux Integration

For Redux-based applications:

```ts
// `src/main/index.ts`
import { app, BrowserWindow } from 'electron';
import { createReduxBridge } from '@zubridge/electron/main';
import { store } from './redux-store.js'; // Your Redux store

// Create main window
const mainWindow = new BrowserWindow({
  /* config */
});

// Instantiate bridge with Redux store
const { unsubscribe, subscribe, dispatch, getSubscribedWindows } = createReduxBridge(store, [mainWindow]);

// Use dispatch to send actions
dispatch({ type: 'COUNTER:INCREMENT' });

// Unsubscribe on quit
app.on('quit', unsubscribe);
```

### Option 3: Custom State Managers

For other state management solutions, implement the `StateManager` interface:

```ts
// `src/main/state-adapter.ts`
import { createCoreBridge, createDispatch } from '@zubridge/electron/main';
import { StateManager, Action } from '@zubridge/types';
import { someThirdPartyStateManager } from 'third-party-library';

// Create an adapter for your state solution
function createStateAdapter(): StateManager<MyAppState> {
  const existingStore = someThirdPartyStateManager({
    initialState: { counter: 0 },
    // other configuration...
  });

  return {
    // Map to existing store's state retrieval method
    getState: () => existingStore.getState(),

    // Map to existing store's subscription method
    subscribe: (listener) => {
      return existingStore.subscribe((newState) => listener(newState));
    },

    // Map actions to existing store's dispatch method
    processAction: (action) => {
      existingStore.dispatch(action);
    },
  };
}

// `src/main/index.ts`
import { app, BrowserWindow } from 'electron';
import { createCoreBridge, createDispatch } from '@zubridge/electron/main';
import { createStateAdapter } from './state-adapter.js';

// Create main window
const mainWindow = new BrowserWindow({
  /* config */
});

// Create adapter and connect to bridge
const stateManager = createStateAdapter();
const bridge = createCoreBridge(stateManager, [mainWindow]);
const dispatch = createDispatch(stateManager);

// Use dispatch to send actions
dispatch('COUNTER:INCREMENT');

// Unsubscribe on quit
app.on('quit', bridge.unsubscribe);
```

## Multi-Window Support

All bridge implementations support multiple windows:

```ts
// Create windows
const mainWindow = new BrowserWindow({
  /* config */
});
const secondaryWindow = new BrowserWindow({
  /* config */
});

// Instantiate bridge with multiple windows
const { unsubscribe, subscribe, getSubscribedWindows } = createZustandBridge(store, [mainWindow, secondaryWindow]);

// Later, create a new window or view
const runtimeView = new WebContentsView({
  /* config */
});

// Subscribe the new view to store updates
const subscription = subscribe([runtimeView]);

// When the view is closed, unsubscribe it
runtimeView.webContents.once('destroyed', () => {
  subscription.unsubscribe();
});

// Get all currently subscribed window IDs
const subscribedWindowIds = getSubscribedWindows();
console.log('Currently subscribed windows:', subscribedWindowIds);
```

## Advanced Bridge Options

### Using Separate Handlers with Zustand

```ts
// `src/main/index.ts`
import { createZustandBridge } from '@zubridge/electron/main';
import { store } from './store.js';
import { actionHandlers } from '../features/index.js';

// Create handlers for store
const handlers = actionHandlers(store, initialState);

// Instantiate bridge with handlers
createZustandBridge(store, [mainWindow], { handlers });
```

### Using Redux-Style Reducers with Zustand

```ts
// `src/main/index.ts`
import { createZustandBridge } from '@zubridge/electron/main';
import { store } from './store.js';
import { rootReducer } from '../features/index.js';

// Instantiate bridge with reducer
createZustandBridge(store, [mainWindow], { reducer: rootReducer });
```

## Interacting with State

### Direct Store Access

In the main process, you can access the store directly:

```ts
// `src/main/counter/index.ts`
import { store } from '../store.js';

// Get current state
const { counter } = store.getState();

// Update state (Zustand example)
store.setState({ counter: counter + 1 });
```

### Using the Dispatch Helper

The dispatch helper provides a consistent way to trigger actions regardless of your state management solution:

```ts
// Using dispatch returned from the bridge
import { dispatch } from '../bridge.js';

// String action type
dispatch('COUNTER:INCREMENT');

// String action type with payload
dispatch('COUNTER:SET', 42);

// Action object
dispatch({ type: 'COUNTER:RESET', payload: 0 });
```

### Working with Thunks

Thunks provide a way to implement complex logic, especially for async operations:

```ts
// `src/main/counter/actions.ts`
import { dispatch } from '../bridge.js';

// Simple thunk with conditional logic
const incrementIfLessThan = (max) => (getState, dispatch) => {
  const { counter } = getState();

  if (counter < max) {
    dispatch('COUNTER:INCREMENT');
    return true;
  }
  return false;
};

// Usage
dispatch(incrementIfLessThan(10));
```

#### Async Thunk Example

```ts
// Complex thunk with async operations
export const fetchAndUpdateCounter = () => async (getState, dispatch) => {
  try {
    // Dispatch a loading action
    dispatch('UI:SET_LOADING', true);

    // Perform async operation
    const response = await fetch('https://api.example.com/counter');
    const data = await response.json();

    // Dispatch results
    dispatch('COUNTER:SET', data.value);

    return data.value;
  } catch (error) {
    // Handle errors
    dispatch('ERROR:SET', error.message);
    return null;
  } finally {
    dispatch('UI:SET_LOADING', false);
  }
};

// Usage
dispatch(fetchAndUpdateCounter());
```

## Legacy API Note

Previous versions used `mainZustandBridge` instead of `createZustandBridge`. This function is still available for backward compatibility, but `createZustandBridge` is recommended for new projects.
