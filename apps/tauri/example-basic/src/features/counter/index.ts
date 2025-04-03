import type { Store } from '../index.js';

export const handlers = (setState: Store['setState']) => ({
  'COUNTER:INCREMENT': () => setState((state) => ({ ...state, counter: state.counter + 1 })),
  'COUNTER:DECREMENT': () => setState((state) => ({ ...state, counter: state.counter - 1 })),
});
