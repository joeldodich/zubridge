import type { StoreApi } from 'zustand';
import type { State } from '../index.js';

/**
 * Creates a handler function for incrementing the counter
 * In the handlers pattern, each action has a separate handler function
 */
export const incrementCounter =
  <S extends State>(store: StoreApi<S>) =>
  () => {
    console.log('[Handler] Incrementing counter');
    store.setState((state) => ({
      ...state,
      counter: (state.counter || 0) + 1,
    }));
  };

/**
 * Creates a handler function for decrementing the counter
 */
export const decrementCounter =
  <S extends State>(store: StoreApi<S>) =>
  () => {
    console.log('[Handler] Decrementing counter');
    store.setState((state) => ({
      ...state,
      counter: Math.max(0, (state.counter || 0) - 1),
    }));
  };
