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
      store.setState((state) => reducer(state, reducerAction));
    } else {
      // default case - handlers attached to store
      const state = store.getState();

      const handler = state[actionType as keyof State] as Handler;
      if (typeof handler === 'function') {
        handler(actionPayload);
      }
    }
  };

export const mainZustandBridge = <State extends AnyState, Store extends StoreApi<State>>(
  store: Store,
  wrappers: WebContentsWrapper[],
  options?: MainZustandBridgeOpts<State>,
): { unsubscribe: () => void; subscribe: (wrappers: WebContentsWrapper[]) => void } => {
  const dispatch = createDispatch(store, options);
  let currentWrappers = wrappers;

  // Use consistent channel names
  const updateChannel = 'zustand-update';
  const dispatchChannel = 'zustand-dispatch';
  const getStateChannel = 'zustand-getState';

  // Handle dispatch events
  ipcMain.on(dispatchChannel, (_event: IpcMainEvent, action: string | Action, payload?: unknown) =>
    dispatch(action, payload),
  );

  // Handle getState requests
  ipcMain.handle(getStateChannel, () => {
    const state = store.getState();
    return sanitizeState(state);
  });

  // Subscribe to store changes and broadcast to renderer
  const unsubscribe = store.subscribe((state) => {
    const safeState = sanitizeState(state);
    for (const wrapper of currentWrappers) {
      if (!wrapper?.webContents?.isDestroyed()) {
        wrapper?.webContents?.send(updateChannel, safeState);
      }
    }
  });

  const subscribe = (newWrappers: WebContentsWrapper[]) => {
    currentWrappers = newWrappers;
  };

  return { unsubscribe, subscribe };
};
