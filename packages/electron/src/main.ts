import type { BrowserWindow } from 'electron';
import type {
  Action,
  BackendBridge,
  StateManager,
  Thunk,
  WebContentsWrapper,
  AnyState,
  Dispatch,
  Handler,
  RootReducer,
} from '@zubridge/types';
import type { StoreApi } from 'zustand/vanilla';
import { createCoreBridge } from './bridge.js';

/**
 * Re-export core bridge creation function
 */
export { createCoreBridge };

/**
 * Interface for a bridge that connects a Zustand store to the main process
 */
export interface ZustandBridge<S extends AnyState = AnyState> extends BackendBridge<number> {
  subscribe: (windows: Array<BrowserWindow | WebContentsWrapper>) => { unsubscribe: () => void };
  unsubscribe: (windows?: Array<BrowserWindow | WebContentsWrapper>) => void;
  getSubscribedWindows: () => number[];
  dispatch: Dispatch<S>;
  destroy: () => void;
}

/**
 * Creates a dispatch function for a bridge that handles both direct actions and thunks
 */
export function createDispatch<S>(stateManager: StateManager<S>): Dispatch<S> {
  return function dispatch(action: Thunk<S> | Action | string, payload?: unknown) {
    if (typeof action === 'function') {
      try {
        // Handle thunks by passing getState and dispatch
        (action as Thunk<S>)(() => stateManager.getState(), dispatch);
      } catch (error) {
        console.error('Error dispatching thunk:', error);
      }
    } else if (typeof action === 'string') {
      try {
        // Handle string actions with separate payload
        stateManager.processAction({ type: action, payload });
      } catch (error) {
        console.error('Error dispatching action:', error);
      }
    } else {
      try {
        // Handle action objects
        stateManager.processAction(action as Action);
      } catch (error) {
        console.error('Error dispatching action:', error);
      }
    }
  };
}

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
        if (options?.handlers && typeof options.handlers[action.type] === 'function') {
          options.handlers[action.type](action.payload);
          return;
        }

        // Next check if we have a reducer
        if (options?.reducer) {
          store.setState(options.reducer(store.getState(), action));
          return;
        }

        // Handle built-in actions
        if (action.type === 'setState') {
          store.setState(action.payload as Partial<S>);
        } else if (typeof (store.getState() as any)[action.type] === 'function') {
          // If the action type corresponds to a store method, call it with the payload
          (store.getState() as any)[action.type](action.payload);
        }
      } catch (error) {
        console.error('Error processing action:', error);
      }
    },
  };
}

/**
 * Creates a bridge between a Zustand store and the renderer process
 */
export function createZustandBridge<S extends AnyState>(
  store: StoreApi<S>,
  windows: Array<BrowserWindow | WebContentsWrapper> = [],
  options?: ZustandOptions<S>,
): ZustandBridge<S> {
  const stateManager = createZustandAdapter(store, options);
  const coreBridge = createCoreBridge(stateManager, windows);
  const dispatchFn = createDispatch(stateManager);

  return {
    subscribe: coreBridge.subscribe,
    unsubscribe: coreBridge.unsubscribe,
    getSubscribedWindows: coreBridge.getSubscribedWindows,
    destroy: coreBridge.destroy,
    dispatch: dispatchFn,
  };
}

/**
 * Legacy bridge alias for backward compatibility
 * @deprecated This is now an alias for createZustandBridge and uses the new IPC channels.
 * Please update your code to use createZustandBridge directly in the future.
 */
export const mainZustandBridge = createZustandBridge;
