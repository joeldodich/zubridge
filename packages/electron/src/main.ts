import { ipcMain } from 'electron';

import type { IpcMainEvent } from 'electron';
import type { StoreApi } from 'zustand';

import type { Action, AnyState, Handler, Thunk, WebContentsWrapper, MainZustandBridge } from '@zubridge/types';
import type { MainZustandBridgeOpts } from '@zubridge/types';

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
  wrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<State>,
) => {
  const dispatch = createDispatch(store, options);
  const subscriptions = new Map<number, { unsubscribe: () => void }>();

  // Function to filter out destroyed webContents
  const filterDestroyed = () => {
    try {
      for (const [id, subscription] of subscriptions.entries()) {
        try {
          const wrapper = wrappers.find((w) => w.webContents?.id === id);
          if (!wrapper || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
            subscription.unsubscribe();
            subscriptions.delete(id);
          }
        } catch (e) {
          subscription.unsubscribe();
          subscriptions.delete(id);
        }
      }
    } catch (error) {
      console.error('Error in filterDestroyed:', error);
      subscriptions.clear();
    }
  };

  // Handle dispatch events
  ipcMain.on('zubridge-dispatch', (_event: IpcMainEvent, action: string | Action, payload?: unknown) => {
    try {
      filterDestroyed();
      dispatch(action, payload);
    } catch (error) {
      console.error('Error handling dispatch:', error);
    }
  });

  // Handle getState requests
  ipcMain.handle('zubridge-getState', () => {
    try {
      filterDestroyed();
      const state = store.getState();
      return sanitizeState(state);
    } catch (error) {
      console.error('Error handling getState:', error);
      return {};
    }
  });

  // Subscribe to store changes and broadcast to ALL renderer processes
  const storeUnsubscribe = store.subscribe((state) => {
    try {
      filterDestroyed();

      if (subscriptions.size === 0) {
        return;
      }

      const safeState = sanitizeState(state);
      for (const [id, subscription] of subscriptions.entries()) {
        try {
          const wrapper = wrappers.find((w) => w.webContents?.id === id);
          if (!wrapper || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
            subscription.unsubscribe();
            subscriptions.delete(id);
            continue;
          }
          wrapper.webContents.send('zubridge-subscribe', safeState);
        } catch (error) {
          console.error('Error sending state update to window:', error);
        }
      }
    } catch (error) {
      console.error('Error in store subscription handler:', error);
    }
  });

  // Complete cleanup function to unsubscribe and remove listeners
  const unsubscribe = (wrappersToUnsubscribe?: WebContentsWrapper[]) => {
    try {
      if (wrappersToUnsubscribe) {
        // Unsubscribe specific wrappers
        for (const wrapper of wrappersToUnsubscribe) {
          try {
            const id = wrapper.webContents?.id;
            if (id) {
              const subscription = subscriptions.get(id);
              if (subscription) {
                subscription.unsubscribe();
                subscriptions.delete(id);
              }
            }
          } catch (error) {
            // Skip if we can't access the wrapper
          }
        }
        return;
      }

      // Full cleanup
      for (const subscription of subscriptions.values()) {
        subscription.unsubscribe();
      }
      subscriptions.clear();
      storeUnsubscribe();
      ipcMain.removeHandler('zubridge-getState');
      ipcMain.removeAllListeners('zubridge-dispatch');
      ipcMain.removeHandler('zubridge-unsubscribe');
    } catch (error) {
      console.error('Error in unsubscribe:', error);
    }
  };

  // Send initial state immediately to all wrappers
  const initialState = sanitizeState(store.getState());
  for (const wrapper of wrappers) {
    try {
      const webContents = wrapper?.webContents;
      if (!webContents || webContents.isDestroyed()) {
        continue;
      }

      if (webContents.isLoading()) {
        webContents.once('did-finish-load', () => {
          if (!webContents.isDestroyed()) {
            webContents.send('zubridge-subscribe', initialState);
          }
        });
      } else {
        webContents.send('zubridge-subscribe', initialState);
      }
    } catch (error) {
      console.error('Error sending initial state to window:', error);
    }
  }

  // Add new windows to our tracking array
  const subscribe = (newWrappers: WebContentsWrapper[]): { unsubscribe: () => void } => {
    try {
      filterDestroyed();

      if (!newWrappers || !Array.isArray(newWrappers)) {
        console.error('Invalid newWrappers passed to subscribe:', newWrappers);
        return { unsubscribe: () => {} };
      }

      const addedIds = new Set<number>();

      for (const wrapper of newWrappers) {
        try {
          if (!wrapper?.webContents || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
            continue;
          }

          const id = wrapper.webContents.id;
          if (subscriptions.has(id)) {
            continue;
          }

          subscriptions.set(id, { unsubscribe: () => unsubscribe([wrapper]) });
          addedIds.add(id);

          // Set up cleanup when window is destroyed
          wrapper.webContents.once('destroyed', () => {
            const subscription = subscriptions.get(id);
            if (subscription) {
              subscription.unsubscribe();
              subscriptions.delete(id);
            }
          });
        } catch (error) {
          console.error('Error processing wrapper in subscribe:', error);
        }
      }

      // Send current state to new windows
      if (addedIds.size === 0) {
        return { unsubscribe: () => {} };
      }

      const currentState = sanitizeState(store.getState());
      for (const id of addedIds) {
        try {
          const wrapper = wrappers.find((w) => w.webContents?.id === id);
          if (!wrapper || wrapper.isDestroyed() || wrapper.webContents.isDestroyed()) {
            continue;
          }

          if (wrapper.webContents.isLoading()) {
            wrapper.webContents.once('did-finish-load', () => {
              if (!wrapper.webContents.isDestroyed()) {
                wrapper.webContents.send('zubridge-subscribe', currentState);
              }
            });
          } else {
            wrapper.webContents.send('zubridge-subscribe', currentState);
          }
        } catch (error) {
          console.error('Error sending state to new window:', error);
        }
      }

      return {
        unsubscribe: () => {
          try {
            const wrappersToUnsubscribe = newWrappers.filter((w) => w.webContents && addedIds.has(w.webContents.id));
            unsubscribe(wrappersToUnsubscribe);
          } catch (error) {
            console.error('Error in subscribe-returned unsubscribe method:', error);
          }
        },
      };
    } catch (error) {
      console.error('Error in subscribe function:', error);
      return { unsubscribe: () => {} };
    }
  };

  // Get list of subscribed window IDs
  const getSubscribedWindows = (): number[] => {
    try {
      filterDestroyed();
      return Array.from(subscriptions.keys());
    } catch (error) {
      console.error('Error getting subscribed windows:', error);
      return [];
    }
  };

  return {
    unsubscribe,
    subscribe,
    getSubscribedWindows,
  };
};
