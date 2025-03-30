import { useDispatch } from '@zubridge/electron';

import { useStore } from './hooks/useStore.js';
import type { State } from '../features/index.js';

export const App = () => {
  const counter = useStore((x: State) => x.counter) as number | null;
  const dispatch = useDispatch<State>();

  return (
    <main>
      <button type="button" onClick={() => dispatch('COUNTER:DECREMENT')}>
        decrement
      </button>
      <pre>{counter ?? 'loading...'}</pre>
      <button type="button" onClick={() => dispatch('COUNTER:INCREMENT')}>
        increment
      </button>
      <button type="button" onClick={() => dispatch('WINDOW:CREATE')}>
        create window
      </button>
      <button type="button" onClick={() => dispatch('WINDOW:CLOSE')}>
        close window
      </button>
    </main>
  );
};
