## Usage in the Renderer Process

In the renderer process you can access the store via the `useStore` hook:

```ts annotate
// `src/renderer/counter/index.ts`
import { useStore } from '@zubridge/electron/preload';

const counter = useStore((x) => x.counter);
```

The `useDispatch` hook can be used to dispatch actions and thunks to the store:

```ts annotate
// `src/renderer/dispatch.ts`
import { useDispatch } from '@zubridge/electron';
import type { AppState } from '../features/index.js';

// Uses window.zubridge by default
export const dispatch = useDispatch<AppState>();

// Or explicitly provide handlers
export const dispatch = useDispatch<AppState>(window.customHandlers);
```

```ts annotate
// `src/renderer/counter/index.ts`
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

You can also use the `useDispatch` hook directly in your components:

```tsx annotate
// `src/renderer/components/Counter.tsx`
import { useDispatch } from '@zubridge/electron';
import { useStore } from '../hooks/useStore.js';
import type { AppState } from '../../features/index.js';

export const Counter = () => {
  const counter = useStore((x) => x.counter);
  const dispatch = useDispatch<AppState>();

  return (
    <div>
      <button onClick={() => dispatch('COUNTER:DECREMENT')}>-</button>
      <span>{counter}</span>
      <button onClick={() => dispatch('COUNTER:INCREMENT')}>+</button>
    </div>
  );
};
```
