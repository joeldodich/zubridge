import type { UnifiedStore } from './index.js';
import type { StateManager } from '@zubridge/types';
import type { State } from '../../types/index.js';

/**
 * Creates a custom store adapter that converts a StateManager to the UnifiedStore interface
 * Useful for EventEmitter-based stores and other custom implementations
 */
export function createCustomAdapter<S>(customStore: StateManager<S>): UnifiedStore<State> {
  return {
    getState: () => customStore.getState() as unknown as State,
    getInitialState: () => customStore.getState() as unknown as State,
    setState: (partial, replace) => {
      // Using processAction since StateManager doesn't have setState
      if (typeof partial === 'function') {
        const currentState = customStore.getState() as unknown as State;
        const newState = partial(currentState);

        // Use processAction with a custom action
        customStore.processAction({
          type: 'SET_STATE',
          payload: newState,
        });
      } else {
        // Use processAction with a custom action
        customStore.processAction({
          type: 'SET_STATE',
          payload: partial,
        });
      }
    },
    subscribe: (listener) => {
      return customStore.subscribe((state) => listener(state as unknown as State, state as unknown as State));
    },
  };
}
