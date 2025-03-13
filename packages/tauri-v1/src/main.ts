import { emit, listen } from '@tauri-apps/api/event';
import type { StoreApi } from 'zustand';
import { invoke } from '@tauri-apps/api';

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
        handler(actionPayload);
      }
    } else if (typeof options?.reducer === 'function') {
      const reducer = options.reducer;
      const reducerAction = { type: actionType, payload: actionPayload };
      store.setState((state) => reducer(state, reducerAction));
    } else {
      const state = store.getState();
      const handler = state[actionType as keyof State] as Handler;
      if (typeof handler === 'function') {
        handler(actionPayload);
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
    dispatch(event.payload);
  });

  // Subscribe to store changes
  console.log('Bridge: Setting up store subscription...');
  const unsubscribeStore = store.subscribe((state) => {
    const safeState = sanitizeState(state);
    invoke('set_state', { state: safeState }).catch(console.error);
    emit('zubridge-tauri:state-update', safeState);
  });

  // Set initial state
  console.log('Bridge: Setting initial state...');
  const initialState = sanitizeState(store.getState());
  await invoke('set_state', { state: initialState });

  console.log('Bridge: Setup complete');

  return {
    unsubscribe: () => {
      unlisten();
      unsubscribeStore();
    },
  };
};
