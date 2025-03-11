## Usage in the Backend Process

In the Tauri backend process, you can access the store directly. Any updates you make will be propagated to the frontend process automatically.

```ts annotate
// `src/lib/counter/index.ts`
import { store } from '../store.js';

// increment counter
const { counter } = store.getState();
store.setState({ counter: counter + 1 });
```

There is a dispatch helper which mirrors the functionality of the frontend process dispatch:

```ts annotate
// `src/lib/dispatch.ts`
import { createDispatch } from '@zubridge/tauri/backend';
import { store } from './store.js';

export const dispatch = createDispatch(store);
```

```ts annotate
// `src/lib/counter/index.ts`
import { dispatch } from '../dispatch.js';

// dispatch action
dispatch('COUNTER:INCREMENT');

const onIncrementThunk = (getState, dispatch) => {
  // do something based on the store
  ...

  // dispatch action
  dispatch('COUNTER:INCREMENT');
};

// dispatch thunk
dispatch(onIncrementThunk);
```

By default the backend dispatch helper assumes your store handler functions are located on the store object.

If you keep your store handler functions separate from the store then you will need to pass them in as an option:

```ts annotate
// `src/lib/dispatch.ts`
import { createDispatch } from '@zubridge/tauri/backend';
import { store } from './store.js';
import { actionHandlers } from '../features/index.js';

export const dispatch = createDispatch(store, { handlers: actionHandlers(store, initialState) });
```

Alternatively, if you are using Redux-style reducers, you should pass in the root reducer:

```ts annotate
// `src/lib/dispatch.ts`
import { createDispatch } from '@zubridge/tauri/backend';
import { store } from './store.js';
import { rootReducer } from '../features/index.js';

export const dispatch = createDispatch(store, { reducer: rootReducer });
```

### Rust Backend Integration

State updates in the Rust backend are handled through the Zubridge commands that were set up in the [getting-started](./getting-started.md) guide. Custom actions should be handled through your reducer or handler functions.

The Rust backend can:

- Access current state via the managed state
- Emit state updates through the Zubridge events
- Process actions through the configured reducer/handlers

```rust
// Example of accessing and updating state in a custom command
#[tauri::command]
async fn custom_command(
    state: tauri::State<'_, Mutex<serde_json::Value>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    if let Ok(mut state) = state.lock() {
        // Update state
        *state = serde_json::json!({ "counter": 1 });

        // Emit state update
        let _ = app_handle.emit("@zubridge/tauri:state-update", state.clone());
    }
    Ok(())
}
```

All state updates should be emitted through the `@zubridge/tauri:state-update` event to ensure proper synchronization with the frontend.
