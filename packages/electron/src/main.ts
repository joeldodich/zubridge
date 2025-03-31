import { ipcMain } from 'electron';

import type { IpcMainEvent } from 'electron';
import type { StoreApi } from 'zustand';

import type { Action, AnyState, Handler, Thunk, WebContentsWrapper } from '@zubridge/types';
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
): { unsubscribe: () => void; subscribe: (wrappers: WebContentsWrapper[]) => void } => {
  const dispatch = createDispatch(store, options);
  let currentWrappers = [...wrappers]; // Create a copy of the array

  // Function to filter out destroyed webContents
  const filterDestroyed = () => {
    try {
      // Use extra caution when accessing potentially destroyed objects
      currentWrappers = currentWrappers.filter((wrapper) => {
        if (!wrapper) return false;

        try {
          // Check if wrapper has been destroyed
          if (wrapper.isDestroyed && wrapper.isDestroyed()) return false;

          // Check if webContents is valid
          if (!wrapper.webContents) return false;

          // Check if webContents has been destroyed
          return !wrapper.webContents.isDestroyed();
        } catch (e) {
          // Any error accessing properties suggests the object is no longer valid
          return false;
        }
      });
    } catch (error) {
      console.error('Error in filterDestroyed:', error);
      // In case of a catastrophic error, clear the entire array
      currentWrappers = [];
    }
  };

  // Handle dispatch events
  ipcMain.on('zubridge-dispatch', (_event: IpcMainEvent, action: string | Action, payload?: unknown) => {
    try {
      // Filter out any destroyed windows before dispatch to ensure we don't
      // operate on invalid windows during state changes
      filterDestroyed();
      dispatch(action, payload);
    } catch (error) {
      console.error('Error handling dispatch:', error);
    }
  });

  // Handle getState requests
  ipcMain.handle('zubridge-getState', () => {
    try {
      // Filter out any destroyed windows before responding to getState
      filterDestroyed();
      const state = store.getState();
      return sanitizeState(state);
    } catch (error) {
      console.error('Error handling getState:', error);
      return {}; // Return empty state on error
    }
  });

  // Subscribe to store changes and broadcast to ALL renderer processes
  const storeUnsubscribe = store.subscribe((state) => {
    try {
      // First, filter out any destroyed webContents
      filterDestroyed();

      if (currentWrappers.length === 0) {
        return; // No active windows to update
      }

      const safeState = sanitizeState(state);
      // Send updated state to all windows
      const wrappersCopy = [...currentWrappers]; // Use a copy to avoid modification issues
      for (const wrapper of wrappersCopy) {
        try {
          // Verify wrapper is still valid (redundant but safe)
          if (!wrapper) continue;

          // Verify webContents is still valid
          const webContents = wrapper.webContents;
          if (!webContents) continue;

          // Check for destroyed status one more time
          if (webContents.isDestroyed()) continue;

          // Send the state update
          webContents.send('zubridge-subscribe', safeState);
        } catch (error) {
          console.error('Error sending state update to window:', error);
          // Don't modify currentWrappers within the loop - we're using a copy
        }
      }
    } catch (error) {
      console.error('Error in store subscription handler:', error);
    }
  });

  // Complete cleanup function to unsubscribe and remove listeners
  const unsubscribe = () => {
    // Unsubscribe from store
    storeUnsubscribe();

    // Clean up IPC listeners
    ipcMain.removeHandler('zubridge-getState');
    ipcMain.removeAllListeners('zubridge-dispatch');

    // Clear wrapper references to avoid memory leaks
    currentWrappers = [];
  };

  // Send initial state immediately to all wrappers
  const initialState = sanitizeState(store.getState());
  for (const wrapper of currentWrappers) {
    try {
      const webContents = wrapper?.webContents;
      if (!webContents || webContents.isDestroyed()) {
        continue;
      }

      // Wait for webContents to be ready
      if (webContents.isLoading()) {
        webContents.once('did-finish-load', () => {
          // Check again if destroyed before sending
          if (!webContents.isDestroyed()) {
            webContents.send('zubridge-subscribe', initialState);
          }
        });
      } else {
        webContents.send('zubridge-subscribe', initialState);
      }
    } catch (error) {
      console.error('Error sending initial state to window:', error);
      // Remove this wrapper if we encounter an error
      currentWrappers = currentWrappers.filter((w) => w !== wrapper);
    }
  }

  // Add new windows to our tracking array
  const subscribe = (newWrappers: WebContentsWrapper[]) => {
    try {
      // Filter out any destroyed webContents first
      filterDestroyed();

      // Validate newWrappers to ensure it's an array and not null
      if (!newWrappers || !Array.isArray(newWrappers)) {
        console.error('Invalid newWrappers passed to subscribe:', newWrappers);
        return;
      }

      // Add only new valid wrappers that aren't already in the current list
      for (const newWrapper of newWrappers) {
        try {
          if (!newWrapper) continue;

          // Check if webContents is accessible
          let webContents;
          try {
            webContents = newWrapper.webContents;
          } catch (error) {
            // Skip if we can't access webContents
            continue;
          }

          if (!webContents || webContents.isDestroyed()) {
            continue;
          }

          // Check if this wrapper is already in our list, using safe identity checking
          const alreadyTracked = currentWrappers.some((w) => {
            try {
              return w === newWrapper;
            } catch (error) {
              return false;
            }
          });

          if (!alreadyTracked) {
            currentWrappers.push(newWrapper);

            // Set up an event handler to remove the wrapper when it's destroyed
            try {
              webContents.once('destroyed', () => {
                try {
                  // Filter out this wrapper
                  currentWrappers = currentWrappers.filter((w) => w !== newWrapper);
                } catch (e) {
                  // In case of error, run a full filter to clean up all invalid wrappers
                  filterDestroyed();
                }
              });
            } catch (error) {
              console.error('Error setting up destroyed listener:', error);
            }
          }
        } catch (error) {
          console.error('Error processing wrapper in subscribe:', error);
        }
      }

      // Send current state to any new wrappers
      if (currentWrappers.length === 0) return;

      const currentState = sanitizeState(store.getState());

      // Use a copy for iteration to avoid modification issues
      const newWrappersCopy = [...newWrappers];
      for (const newWrapper of newWrappersCopy) {
        try {
          // Check wrapper validity again
          if (!newWrapper) continue;

          // Check webContents validity
          let webContents;
          try {
            webContents = newWrapper.webContents;
          } catch (error) {
            continue;
          }

          if (!webContents || webContents.isDestroyed()) {
            continue;
          }

          // Send state based on loading status
          if (webContents.isLoading()) {
            try {
              webContents.once('did-finish-load', () => {
                try {
                  // Check again if destroyed before sending
                  if (!webContents.isDestroyed()) {
                    webContents.send('zubridge-subscribe', currentState);
                  }
                } catch (e) {
                  console.error('Error in did-finish-load handler:', e);
                }
              });
            } catch (error) {
              console.error('Error setting up load listener:', error);
            }
          } else {
            webContents.send('zubridge-subscribe', currentState);
          }
        } catch (error) {
          console.error('Error sending state to new window:', error);
        }
      }
    } catch (error) {
      console.error('Error in subscribe function:', error);
    }
  };

  return { unsubscribe, subscribe };
};
