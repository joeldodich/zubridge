import { emit, listen } from '@tauri-apps/api/event';
import type { StoreApi } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

import type { Action, AnyState, Handler, MainZustandBridgeOpts, Thunk } from '@zubridge/types';

export type MainZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  options?: MainZustandBridgeOpts<State>,
) => Promise<{
  unsubscribe: () => void;
  commands: Record<string, (...args: any[]) => Promise<unknown>>;
}>;

function sanitizeState(state: AnyState) {
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
    const actionType = (action as Action).type || (action as string);
    const actionPayload = (action as Action).payload || payload;

    if (options?.handlers) {
      const handler = options.handlers[actionType];
      if (typeof handler === 'function') {
        try {
          handler(actionPayload);
        } catch (error) {
          console.error(`Bridge: Error in handler for action ${actionType}:`, error);
        }
      }
    } else if (typeof options?.reducer === 'function') {
      const reducer = options.reducer;
      const reducerAction = { type: actionType, payload: actionPayload };
      try {
        store.setState((state) => reducer(state, reducerAction));
      } catch (error) {
        console.error(`Bridge: Error in reducer for action ${actionType}:`, error);
      }
    } else {
      const state = store.getState();
      const handler = state[actionType as keyof State] as Handler;
      if (typeof handler === 'function') {
        try {
          handler(actionPayload);
        } catch (error) {
          console.error(`Bridge: Error in state handler for action ${actionType}:`, error);
        }
      }
    }
  };

export const mainZustandBridge = async <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  options?: MainZustandBridgeOpts<State>,
) => {
  console.log('Bridge: Initializing...');
  const dispatch = createDispatch(store, options);

  // Set up event listeners first
  console.log('Bridge: Setting up event listeners...');
  const unlisten = await listen<Action>('zubridge-tauri:action', (event) => {
    console.log('Bridge: Received action:', event.payload);
    try {
      dispatch(event.payload);
    } catch (error) {
      console.error('Bridge: Error dispatching action:', error);
    }
  });

  // Subscribe to store changes
  console.log('Bridge: Setting up store subscription...');
  const unsubscribeStore = store.subscribe((state) => {
    try {
      const safeState = sanitizeState(state);
      invoke('set_state', { state: safeState }).catch((error) => {
        console.error('Bridge: Error setting state:', error);
      });
      emit('zubridge-tauri:state-update', safeState).catch((error) => {
        console.error('Bridge: Error emitting state update:', error);
      });
    } catch (error) {
      console.error('Bridge: Error in store subscription:', error);
    }
  });

  // Set initial state
  console.log('Bridge: Setting initial state...');
  try {
    const initialState = sanitizeState(store.getState());
    await invoke('set_state', { state: initialState });
  } catch (error) {
    console.error('Bridge: Error setting initial state:', error);
  }

  console.log('Bridge: Setup complete');

  return {
    unsubscribe: () => {
      try {
        unlisten();
        unsubscribeStore();
      } catch (error) {
        console.error('Bridge: Error unsubscribing:', error);
      }
    },
  };
};
