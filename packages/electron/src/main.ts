import type { StoreApi } from 'zustand';
import type { Action, AnyState, Handler, Thunk, WebContentsWrapper, BaseBridge } from '@zubridge/types';
import type { MainZustandBridgeOpts } from '@zubridge/types';

import { createGenericBridge, StateManager } from './generic-bridge';

// The object returned by mainZustandBridge
export interface ZustandBridge extends Omit<BaseBridge<number>, 'getSubscribedWindows'> {
  subscribe: (wrappers: WebContentsWrapper[]) => { unsubscribe: () => void };
  unsubscribe: (wrappers?: WebContentsWrapper[]) => void;
  getSubscribers: () => number[];
  getSubscribedWindows: () => number[]; // Required by BaseBridge
  destroy: () => void;
}

// The function type for initializing the bridge
export type MainZustandBridge = <S extends AnyState, Store extends StoreApi<S>>(
  store: Store,
  wrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<S>,
) => ZustandBridge;

function sanitizeState(state: AnyState) {
  // strip handlers from the state object
  const safeState: Record<string, unknown> = {};

  for (const statePropName in state) {
    const stateProp = state[statePropName];
    if (typeof stateProp !== 'function') {
      safeState[statePropName] = stateProp;
    }
  }

  return safeState;
}

export const createDispatch =
  <State extends AnyState, Store extends StoreApi<State>>(store: Store, options?: MainZustandBridgeOpts<State>) =>
  (action: string | Action | Thunk<State>, payload?: unknown) => {
    try {
      const actionType = (action as Action).type || (action as string);
      const actionPayload = (action as Action).payload || payload;

      if (options?.handlers) {
        // separate handlers case
        const handler = options.handlers[actionType];
        if (typeof handler === 'function') {
          handler(actionPayload);
        }
      } else if (typeof options?.reducer === 'function') {
        // reducer case - action is passed to the reducer
        const reducer = options.reducer;
        const reducerAction = { type: actionType, payload: actionPayload };

        // Safely update state using reducer
        store.setState((state) => {
          try {
            return reducer(state, reducerAction);
          } catch (error) {
            console.error('Error in reducer:', error);
            return state; // Return unchanged state on error
          }
        });
      } else {
        // default case - handlers attached to store
        const state = store.getState();

        const handler = state[actionType as keyof State] as Handler;
        if (typeof handler === 'function') {
          handler(actionPayload);
        }
      }
    } catch (error) {
      console.error('Error in dispatch:', error);
    }
  };

/**
 * Creates a Zustand adapter for the generic bridge
 * This wraps a Zustand store to implement the StateManager interface
 */
export function createZustandAdapter<State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  options?: MainZustandBridgeOpts<State>,
): StateManager<State> {
  const dispatch = createDispatch(store, options);

  return {
    getState: () => {
      const state = store.getState();
      return sanitizeState(state) as State;
    },

    subscribe: (listener) => {
      return store.subscribe(() => {
        const state = store.getState();
        listener(sanitizeState(state) as State);
      });
    },

    processAction: (action: Action) => {
      dispatch(action);
    },
  };
}

/**
 * Creates a bridge between a Zustand store in the main process and renderer processes
 * This is a modernized version of the mainZustandBridge that uses the new backend contract
 */
export const createZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  initialWrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<State>,
): ZustandBridge => {
  const adapter = createZustandAdapter(store, options);
  const bridge = createGenericBridge(adapter, initialWrappers);

  return {
    ...bridge,
    getSubscribers: bridge.getSubscribedWindows,
    getSubscribedWindows: bridge.getSubscribedWindows, // Required by BaseBridge
  };
};

/**
 * Legacy bridge alias for backward compatibility
 * @deprecated This is now an alias for createZustandBridge and uses the new IPC channels.
 * Please update your code to use createZustandBridge directly in the future.
 */
export const mainZustandBridge = createZustandBridge;
