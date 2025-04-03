import { invoke } from '@tauri-apps/api/core';
import { listen, Event, emit } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import {
  createStore as createCoreStore,
  createUseStore as createCoreUseStore,
  useDispatch as useCoreDispatch,
} from '@zubridge/core';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

// Re-export types
export type * from '@zubridge/types';

// Create Tauri-specific handlers
export const createHandlers = <S extends AnyState>(): Handlers<S> => {
  return {
    async getState(): Promise<S> {
      console.log('Renderer: Requesting state from main process');
      try {
        const state = await invoke<S>('get_state');
        console.log('Renderer: Received state from main process:', state);
        return state;
      } catch (error) {
        console.error('Renderer: Error getting state from main process:', error);
        throw error;
      }
    },

    subscribe(callback: (newState: S) => void): () => void {
      console.log('Renderer: Setting up state subscription');
      let unlistenFn: UnlistenFn | null = null;

      // Keep track of the last state we received to avoid duplicates
      let lastStateJSON: string | null = null;

      // Debounce timer for state updates
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const DEBOUNCE_MS = 16; // ~1 frame at 60fps

      // Set up the listener with improved handling
      listen<S>('zubridge-tauri:state-update', (event: Event<S>) => {
        try {
          const payload = event.payload;
          // Extract metadata for logging if it exists
          const meta = (payload as any).__meta;
          console.log(`Renderer: Received state update ${meta ? `#${meta.updateId}` : ''}`);

          // Create a serialized version of the state without the metadata for comparison
          const stateWithoutMeta = { ...payload };
          if (meta) {
            // Don't compare metadata for duplicate detection
            delete (stateWithoutMeta as any).__meta;
          }

          // Only process the state update if the actual data is different
          const newStateJSON = JSON.stringify(stateWithoutMeta);
          if (newStateJSON !== lastStateJSON) {
            lastStateJSON = newStateJSON;

            // Debounce multiple updates that might come in rapid succession
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
              try {
                console.log(`Renderer: Processing debounced state update ${meta ? `#${meta.updateId}` : ''}`);
                callback(payload);
              } catch (error) {
                console.error('Renderer: Error in state update callback:', error);
              }
            }, DEBOUNCE_MS);
          } else {
            console.log(`Renderer: Ignoring duplicate state update ${meta ? `#${meta.updateId}` : ''}`);
          }
        } catch (error) {
          console.error('Renderer: Error handling state update event:', error);
        }
      })
        .then((unlisten) => {
          console.log('Renderer: State subscription set up successfully');
          unlistenFn = unlisten;
        })
        .catch((error) => {
          console.error('Renderer: Error setting up state subscription:', error);
        });

      // Return a function to unsubscribe and clean up
      return () => {
        console.log('Renderer: Unsubscribing from state updates');
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (unlistenFn) {
          unlistenFn();
          unlistenFn = null;
        }
      };
    },

    dispatch(action: Thunk<S> | Action | string, payload?: unknown): void {
      console.log('Renderer: Dispatching action:', typeof action === 'string' ? action : action);

      const MAX_RETRIES = 3;
      const RETRY_DELAY = 50; // ms

      // Function to emit action with retry logic
      const emitWithRetry = async (channel: string, data: unknown, attempt = 0): Promise<void> => {
        try {
          await emit(channel, data);
          console.log('Renderer: Action emitted successfully');
        } catch (error) {
          console.error(`Renderer: Error emitting action (attempt ${attempt + 1}):`, error);

          if (attempt < MAX_RETRIES) {
            console.log(`Renderer: Retrying in ${RETRY_DELAY}ms...`);

            // Wait and retry
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return emitWithRetry(channel, data, attempt + 1);
          } else {
            console.error(`Renderer: Failed to emit action after ${MAX_RETRIES} attempts`);
            throw error;
          }
        }
      };

      // Create a formatted action object
      let actionObject: Action;

      if (typeof action === 'string') {
        console.log('Renderer: Creating action object from type and payload');
        actionObject = { type: action, payload };
      } else if (typeof action === 'function') {
        console.error('Renderer: Cannot dispatch thunk directly to main process');
        throw new Error('Thunks must be dispatched in the main process');
      } else {
        console.log('Renderer: Using provided action object');
        actionObject = action;
      }

      // Emit the action with retry logic
      emitWithRetry('zubridge-tauri:action', actionObject).catch((error) => {
        console.error('Renderer: Final error emitting action:', error);
      });
    },
  };
};

// Create store with Tauri-specific handlers
export const createStore = <S extends AnyState>(): ReturnType<typeof createCoreStore<S>> => {
  const handlers = createHandlers<S>();
  return createCoreStore<S>(handlers);
};

// Create useStore hook with Tauri-specific handlers
export const createUseStore = <S extends AnyState>() => {
  const handlers = createHandlers<S>();
  return createCoreUseStore<S>(handlers);
};

// Create useDispatch hook with Tauri-specific handlers
export const useDispatch = <S extends AnyState>() => {
  const handlers = createHandlers<S>();
  return useCoreDispatch<S>(handlers);
};

export { type Handlers, type Reducer } from '@zubridge/types';
export { backendZustandBridge } from './backend.js';
