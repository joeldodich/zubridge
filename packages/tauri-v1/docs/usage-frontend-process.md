## Usage in the Frontend Process

In the frontend process you can access the store via the `useStore` hook:

```ts annotate
// `src/components/counter/index.ts`
import { useStore } from '../lib/bridge';

const counter = useStore((x) => x.counter);
```

The `dispatch` function from the bridge can be used to dispatch actions and thunks to the store:

```ts annotate
// `src/components/counter/index.ts`
import { dispatch } from '../lib/bridge';

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

Note that all actions are sent to the backend process via Tauri commands, processed there, and then the updated state is synchronized back to the frontend. This ensures that the backend store remains the single source of truth for your application state.
