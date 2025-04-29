import type { StoreApi } from 'zustand/vanilla';
import type { AnyState, Handler, RootReducer, StateManager } from '@zubridge/types';
import { findCaseInsensitiveMatch, findNestedHandler, resolveHandler } from '../utils/handler-resolution.js';

/**
 * Options for the Zustand bridge and adapter
 */
export interface ZustandOptions<S extends AnyState> {
  exposeState?: boolean;
  handlers?: Record<string, Handler>;
  reducer?: RootReducer<S>;
}

/**
 * Creates a state manager adapter for Zustand stores
 */
export function createZustandAdapter<S extends AnyState>(
  store: StoreApi<S>,
  options?: ZustandOptions<S>,
): StateManager<S> {
  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    processAction: (action) => {
      try {
        // First check if we have a custom handler for this action type
        if (options?.handlers) {
          // Try to resolve a handler for this action type
          const handler = resolveHandler(options.handlers, action.type);
          if (handler) {
            handler(action.payload);
            return;
          }
        }

        // Next check if we have a reducer
        if (options?.reducer) {
          store.setState(options.reducer(store.getState(), action));
          return;
        }

        // Handle built-in actions
        if (action.type === 'setState') {
          store.setState(action.payload as Partial<S>);
        } else {
          // Check for a matching method in the store state
          const state = store.getState();

          // Try direct match with state functions
          const methodMatch = findCaseInsensitiveMatch(
            Object.fromEntries(Object.entries(state).filter(([_, value]) => typeof value === 'function')),
            action.type,
          );

          if (methodMatch && typeof methodMatch[1] === 'function') {
            methodMatch[1](action.payload);
            return;
          }

          // Try nested path resolution in state
          const nestedStateHandler = findNestedHandler<Function>(state, action.type);
          if (nestedStateHandler) {
            nestedStateHandler(action.payload);
            return;
          }
        }
      } catch (error) {
        console.error('Error processing action:', error);
      }
    },
  };
}
