import { ipcMain } from 'electron';

import type { IpcMainEvent } from 'electron';
import type { StoreApi } from 'zustand';
import type { Action, AnyState, Handler, Thunk, WebContentsWrapper, MainZustandBridge } from '@zubridge/types';
import type { MainZustandBridgeOpts } from '@zubridge/types';

import { IpcChannel } from './constants';

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

export const mainZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  initialWrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<State>,
) => {
  // This is the master list of all window wrappers we care about
  const wrappers: WebContentsWrapper[] = [...initialWrappers];

  // This is a mapping from webContents.id to wrapper
  const wrapperMap = new Map<number, WebContentsWrapper>();

  // Subscriptions tracks which windows should receive updates
  const subscriptions = new Set<number>();

  // Helper to safely get webContents id from a wrapper
  const getWebContentsId = (wrapper: WebContentsWrapper): number | null => {
    try {
      if (!wrapper || !wrapper.webContents || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
        return null;
      }
      return wrapper.webContents.id;
    } catch (error) {
      return null;
    }
  };

  // Helper to safely send a message to a window
  const safelySendToWindow = (wrapper: WebContentsWrapper, channel: string, data: unknown): boolean => {
    try {
      if (!wrapper || !wrapper.webContents || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
        return false;
      }

      if (wrapper.webContents.isLoading()) {
        wrapper.webContents.once('did-finish-load', () => {
          try {
            if (!wrapper.webContents.isDestroyed()) {
              wrapper.webContents.send(channel, data);
            }
          } catch (e) {
            // Ignore errors during load
          }
        });
        return true;
      }

      wrapper.webContents.send(channel, data);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Initialize our wrapper map with initial wrappers
  for (const wrapper of initialWrappers) {
    const id = getWebContentsId(wrapper);
    if (id !== null) {
      wrapperMap.set(id, wrapper);
    }
  }

  // Create the dispatcher
  const dispatch = createDispatch(store, options);

  // Remove destroyed windows from our subscriptions
  const cleanupDestroyedWindows = () => {
    const toRemove: number[] = [];

    for (const id of subscriptions) {
      const wrapper = wrapperMap.get(id);
      let isValid = false;

      try {
        isValid = !(!wrapper || wrapper.isDestroyed() || wrapper.webContents.isDestroyed());
      } catch (e) {
        // If we get an error, assume the window is destroyed
        isValid = false;
      }

      if (!isValid) {
        toRemove.push(id);
        wrapperMap.delete(id);
      }
    }

    for (const id of toRemove) {
      subscriptions.delete(id);
    }
  };

  // Handle dispatch events from renderers
  ipcMain.on(IpcChannel.DISPATCH, (_event: IpcMainEvent, action: string | Action, payload?: unknown) => {
    try {
      cleanupDestroyedWindows();

      // Always pass the action as-is to dispatch
      dispatch(action, payload);
    } catch (error) {
      console.error('Error handling dispatch:', error);
    }
  });

  // Handle getState requests from renderers
  ipcMain.handle(IpcChannel.GET_STATE, () => {
    try {
      cleanupDestroyedWindows();
      const state = store.getState();
      return sanitizeState(state);
    } catch (error) {
      console.error('Error handling getState:', error);
      return {};
    }
  });

  // Subscribe to store changes and broadcast to ALL subscribed windows
  const storeUnsubscribe = store.subscribe((state) => {
    try {
      cleanupDestroyedWindows();

      if (subscriptions.size === 0) {
        return;
      }

      const safeState = sanitizeState(state);

      for (const id of subscriptions) {
        const wrapper = wrapperMap.get(id);
        if (wrapper) {
          safelySendToWindow(wrapper, IpcChannel.SUBSCRIBE, safeState);
        }
      }
    } catch (error) {
      console.error('Error in store subscription handler:', error);
    }
  });

  // Add new windows to tracking and subscriptions
  const subscribe = (newWrappers: WebContentsWrapper[]): { unsubscribe: () => void } => {
    const addedIds: number[] = [];

    // Handle invalid input cases
    if (!newWrappers || !Array.isArray(newWrappers)) {
      return { unsubscribe: () => {} };
    }

    for (const wrapper of newWrappers) {
      const id = getWebContentsId(wrapper);
      if (id === null) continue;

      // Add to our maps
      wrapperMap.set(id, wrapper);
      subscriptions.add(id);
      addedIds.push(id);

      // Set up automatic cleanup when the window is destroyed
      try {
        wrapper.webContents.once('destroyed', () => {
          subscriptions.delete(id);
          wrapperMap.delete(id);
        });
      } catch (e) {
        // Ignore errors during setup
      }

      // Send initial state
      const safeState = sanitizeState(store.getState());
      safelySendToWindow(wrapper, IpcChannel.SUBSCRIBE, safeState);
    }

    // Return an unsubscribe function
    return {
      unsubscribe: () => {
        for (const id of addedIds) {
          subscriptions.delete(id);
        }
      },
    };
  };

  // Subscribe all initial wrappers
  for (const wrapper of initialWrappers) {
    const id = getWebContentsId(wrapper);
    if (id !== null) {
      subscriptions.add(id);

      // Setup cleanup listener
      try {
        wrapper.webContents.once('destroyed', () => {
          subscriptions.delete(id);
          wrapperMap.delete(id);
        });
      } catch (e) {
        // Ignore errors
      }

      // Send initial state
      const safeState = sanitizeState(store.getState());
      safelySendToWindow(wrapper, IpcChannel.SUBSCRIBE, safeState);
    }
  }

  // Unsubscribe all windows and cleanup
  const unsubscribe = () => {
    try {
      // Clear all subscriptions
      subscriptions.clear();
      wrapperMap.clear();

      // Remove listeners
      storeUnsubscribe();
      ipcMain.removeHandler(IpcChannel.GET_STATE);
      ipcMain.removeAllListeners(IpcChannel.DISPATCH);
    } catch (error) {
      console.error('Error in unsubscribe:', error);
    }
  };

  // Get list of currently subscribed window IDs for debugging
  const getSubscribedWindows = (): number[] => {
    return Array.from(subscriptions);
  };

  return {
    getSubscribedWindows,
    subscribe,
    unsubscribe,
  };
};
