# Main Process

This document describes how to set up and use the `@zubridge/electron` package in the main process of your Electron application.

## Bridge Setup

### Basic Setup

In the main process, instantiate the bridge with your store and an array of window or view objects:

```ts
// `src/main/index.ts`
import { app, BrowserWindow } from 'electron';
import { mainBridge } from '@zubridge/electron/main';
import { store } from './store.js';

// create main window
const mainWindow = new BrowserWindow({ ... });

// instantiate bridge
const { unsubscribe, subscribe, getSubscribedWindows } = mainBridge(store, [mainWindow]);

// unsubscribe on quit
app.on('quit', unsubscribe);
```

### Multi-Window Support

For applications with multiple windows, you can:

```ts
// `src/main/index.ts`
import { app, BrowserWindow, WebContentsView } from 'electron';
import { mainBridge } from '@zubridge/electron/main';
import { store } from './store.js';

// create windows
const mainWindow = new BrowserWindow({ ... });
const secondaryWindow = new BrowserWindow({ ... });

// instantiate bridge with multiple windows
const { unsubscribe, subscribe } = mainBridge(store, [mainWindow, secondaryWindow]);

// unsubscribe all windows on quit
app.on('quit', unsubscribe);

// Later, create a new window or view
const runtimeView = new WebContentsView({ ... });

// subscribe the new view to store updates
const subscription = subscribe([runtimeView]);

// When the view is closed, unsubscribe it
runtimeView.webContents.once('destroyed', () => {
  subscription.unsubscribe();
});

// You can also get all currently subscribed window IDs
const subscribedWindowIds = getSubscribedWindows();
console.log('Currently subscribed windows:', subscribedWindowIds);
```

### Advanced Bridge Options

#### Using Separate Handlers

By default, the main process bridge assumes your store handler functions are located on the store object. If you keep your store handler functions separate from the store, you'll need to pass them in as an option:

```ts
// `src/main/index.ts`
import { mainBridge } from '@zubridge/electron/main';
import { store } from './store.js';
import { actionHandlers } from '../features/index.js';

// create handlers for store
const handlers = actionHandlers(store, initialState);

// instantiate bridge with handlers
const { unsubscribe } = mainBridge(store, [mainWindow], { handlers });
```

#### Using Redux-Style Reducers

If you are using Redux-style reducers, you should pass in the root reducer:

```ts
// `src/main/index.ts`
import { mainBridge } from '@zubridge/electron/main';
import { store } from './store.js';
import { rootReducer } from '../features/index.js';

// instantiate bridge with reducer
const { unsubscribe } = mainBridge(store, [mainWindow], { reducer: rootReducer });
```

## Interacting with the Store

### Direct Store Access

In the main process, you can access the store object directly. Any updates you make will be propagated to the renderer process of any subscribed window or view:

```ts
// `src/main/counter/index.ts`
import { store } from '../store.js';

// get current state
const { counter } = store.getState();

// update state
store.setState({ counter: counter + 1 });
```

### Using the Dispatch Helper

There is a dispatch helper which mirrors the functionality of the renderer process `useDispatch` hook:

```ts
// `src/main/dispatch.ts`
import { createDispatch } from '@zubridge/electron/main';
import { store } from './store.js';

export const dispatch = createDispatch(store);
```

You can then use this dispatch function to trigger actions in various formats:

```ts
// `src/main/counter/actions.ts`
import { dispatch } from '../dispatch.js';

// String action type
dispatch('COUNTER:INCREMENT');

// String action type with payload
dispatch('COUNTER:SET', 42);

// Action object
dispatch({ type: 'COUNTER:RESET', payload: 0 });
```

### Working with Thunks

Thunks are function actions that provide an easy way to implement complex logic, especially for async operations. In the main process, thunks are executed locally and receive two arguments:

1. `getState` - A function to access the current state
2. `dispatch` - A function to dispatch further actions

#### Basic Thunk Example

```ts
// `src/main/counter/actions.ts`
import { dispatch } from '../dispatch.js';

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

#### Advanced Thunk Example with Async Operations

```ts
// `src/main/counter/async-actions.ts`
import { dispatch } from '../dispatch.js';

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

    // Chain another thunk
    dispatch(incrementIfLessThan(100));

    return data.value;
  } catch (error) {
    // Handle errors
    dispatch('ERROR:SET', error.message);
    return null;
  } finally {
    dispatch('UI:SET_LOADING', false);
  }
};

// Usage in the main process
dispatch(fetchAndUpdateCounter());
```

Thunks are powerful for:

- Conditional dispatching based on current state
- Async operations with proper loading/error handling
- Combining and sequencing multiple actions
- Reusing business logic across different parts of your application

### Configuring the Dispatch Helper

Just like with the bridge, you can configure the dispatch helper with handlers or a reducer:

```ts
// `src/main/dispatch.ts`
import { createDispatch } from '@zubridge/electron/main';
import { store } from './store.js';
import { actionHandlers } from '../features/index.js';

// With separate handlers
export const dispatch = createDispatch(store, { handlers: actionHandlers(store, initialState) });

// OR with a reducer
import { rootReducer } from '../features/index.js';
export const dispatch = createDispatch(store, { reducer: rootReducer });
```

## API Versions

Previous versions used `mainZustandBridge` instead of `mainBridge`. This function is still available for backward compatibility, but it is recommended to use `mainBridge` in new projects.

```ts
// Legacy approach (still supported)
import { mainZustandBridge } from '@zubridge/electron/main';
const bridge = mainZustandBridge(store, [mainWindow]);

// Modern approach (recommended)
import { mainBridge } from '@zubridge/electron/main';
const bridge = mainBridge(store, [mainWindow]);
```
