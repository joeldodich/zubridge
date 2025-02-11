import { invoke } from '@tauri-apps/api';
import { listen, Event, emit } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { AnyState, PreloadZustandBridgeReturn } from './types.js';
import type { Action, Thunk } from './types.js';

export const preloadZustandBridge = <S extends AnyState>(): PreloadZustandBridgeReturn<S> => {
  console.log('Preload: Creating bridge...');

  const getState = async () => {
    console.log('Preload: Requesting initial state...');
    try {
      console.log('Preload: Invoking get-state command');
      const state = await invoke<S>('get_state');
      console.log('Preload: Got state from main:', state);
      return state;
    } catch (err) {
      console.error('Preload: Failed to get state:', err);
      throw err;
    }
  };

  let dispatch: (action: string | Action | Thunk<S>, payload?: unknown) => Promise<void>;

  dispatch = async (action: string | Action | Thunk<S>, payload?: unknown) => {
    if (typeof action === 'function') {
      const state = await getState();
      return action(() => state, dispatch);
    }
    const eventPayload = typeof action === 'string' ? { type: action, payload } : action;
    await emit('zuri:action', eventPayload);
  };

  const handlers = {
    dispatch,
    getState,
    subscribe: (callback) => {
      console.log('Preload: Setting up state subscription');
      let unlisten: UnlistenFn;

      // Set up the listener
      listen<S>('zuri:state-update', (event: Event<S>) => {
        console.log('Preload: Received state update:', event.payload);
        callback(event.payload);
      }).then((unlistenerFn) => {
        unlisten = unlistenerFn;
        console.log('Preload: State subscription ready');
      });

      return () => {
        console.log('Preload: Cleaning up state subscription');
        unlisten?.();
      };
    },
  };

  console.log('Preload: Bridge handlers created');
  return { handlers };
};

export type PreloadZuriBridge = typeof preloadZustandBridge;
