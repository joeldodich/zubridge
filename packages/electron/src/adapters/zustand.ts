import type { StoreApi } from 'zustand/vanilla';
import type { AnyState, Handler, RootReducer, StateManager } from '@zubridge/types';

/**
 * Options for the Zustand bridge and adapter
 */
export interface ZustandOptions<S extends AnyState> {
  exposeState?: boolean;
  handlers?: Record<string, Handler>;
  reducer?: RootReducer<S>;
}

/**
 * Helper function to find a case-insensitive match in an object
 */
function findCaseInsensitiveMatch<T>(obj: Record<string, T>, key: string): [string, T] | undefined {
  // Try exact match first
  if (key in obj) {
    return [key, obj[key]];
  }

  // Try case-insensitive match
  const keyLower = key.toLowerCase();
  const matchingKey = Object.keys(obj).find((k) => k.toLowerCase() === keyLower);

  if (matchingKey) {
    return [matchingKey, obj[matchingKey]];
  }

  return undefined;
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
          const handlerMatch = findCaseInsensitiveMatch(options.handlers, action.type);
          if (handlerMatch && typeof handlerMatch[1] === 'function') {
            handlerMatch[1](action.payload);
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
          const methodMatch = findCaseInsensitiveMatch(
            Object.fromEntries(Object.entries(state).filter(([_, value]) => typeof value === 'function')),
            action.type,
          );

          if (methodMatch && typeof methodMatch[1] === 'function') {
            methodMatch[1](action.payload);
          }
        }
      } catch (error) {
        console.error('Error processing action:', error);
      }
    },
  };
}
