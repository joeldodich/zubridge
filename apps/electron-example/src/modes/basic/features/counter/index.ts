import { type StoreApi } from 'zustand';
import type { BaseState } from '../../../../types/index.js';

/**
 * Attaches the counter handlers to the state object
 * In the basic mode, handlers are part of the state object itself
 */
export const attachCounterHandlers = <S extends BaseState>(store: StoreApi<S>) => {
  const { setState } = store;

  // Set up counter initial state
  setState((state) => ({
    ...state,
    'counter': 0,

    // Implement the increment counter handler
    'COUNTER:INCREMENT': () => {
      console.log('[Basic] Incrementing counter');
      setState((state) => ({
        ...state,
        counter: (state.counter || 0) + 1,
      }));
    },

    // Implement the decrement counter handler
    'COUNTER:DECREMENT': () => {
      console.log('[Basic] Decrementing counter');
      setState((state) => ({
        ...state,
        counter: Math.max(0, (state.counter || 0) - 1),
      }));
    },
  }));
};
