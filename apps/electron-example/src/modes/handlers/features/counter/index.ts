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
      counter: (state.counter || 0) - 1,
    }));
  };

/**
 * Creates a handler function for setting the counter to a specific value
 */
export const setCounter =
  <S extends State>(store: StoreApi<S>) =>
  (value: number) => {
    console.log(`[Handler] Setting counter to ${value}`);
    store.setState((state) => ({
      ...state,
      counter: value,
    }));
  };

/**
 * Creates a handler function for resetting the counter to zero
 */
export const resetCounter =
  <S extends State>(store: StoreApi<S>) =>
  () => {
    console.log('[Handler] Resetting counter to 0');
    store.setState((state) => ({
      ...state,
      counter: 0,
    }));
  };
