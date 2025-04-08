import { invoke } from '@tauri-apps/api/tauri';
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

      // Get current window label
      try {
        // Import appWindow dynamically to avoid issues at initialization time
        import('@tauri-apps/api/window')
          .then(({ appWindow }) => {
            if (appWindow) {
              const windowLabel = appWindow.label;
              console.log(`Renderer: Notifying subscription for window ${windowLabel}`);

              // Notify the main process that this window is subscribing
              emit('zubridge-tauri:subscribe', { windowLabel }).catch((error) => {
                console.error('Renderer: Error sending subscription notification:', error);
              });
            }
          })
          .catch((error) => {
            console.error('Renderer: Error importing window API:', error);
          });
      } catch (error) {
        console.error('Renderer: Error in window subscription:', error);
      }

      // Set up the listener
      listen<S>('zubridge-tauri:state-update', (event: Event<S>) => {
        console.log('Renderer: Received state update event:', event.payload);
        callback(event.payload);
      })
        .then((unlisten) => {
          console.log('Renderer: State subscription set up successfully');
          unlistenFn = unlisten;
        })
        .catch((error) => {
          console.error('Renderer: Error setting up state subscription:', error);
        });

      // Return a function to unsubscribe
      return () => {
        console.log('Renderer: Unsubscribing from state updates');
        if (unlistenFn) {
          unlistenFn();
        }
      };
    },

    dispatch(action: Thunk<S> | Action | string, payload?: unknown): void {
      console.log('Renderer: Dispatching action:', typeof action === 'string' ? action : action);

      if (typeof action === 'string') {
        console.log('Renderer: Emitting action event with type and payload');
        emit('zubridge-tauri:action', { type: action, payload });
      } else if (typeof action === 'function') {
        console.error('Renderer: Cannot dispatch thunk directly to main process');
        throw new Error('Thunks must be dispatched in the main process');
      } else {
        console.log('Renderer: Emitting action event with action object');
        emit('zubridge-tauri:action', action);
      }
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
export { mainZustandBridge } from './main.js';

export const rendererZustandBridge = <S extends AnyState>() => {
  const handlers = createHandlers<S>();
  return { handlers };
};
