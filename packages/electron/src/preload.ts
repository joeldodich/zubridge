import { ipcRenderer } from 'electron';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

import { IpcChannel } from './constants';

export type PreloadZustandBridgeReturn<S extends AnyState> = {
  handlers: Handlers<S>;
};

export const preloadZustandBridge = <S extends AnyState>(): PreloadZustandBridgeReturn<S> => {
  const handlers: Handlers<S> = {
    subscribe(callback: (state: S) => void) {
      const listener = (_: unknown, state: S) => callback(state);
      ipcRenderer.on(IpcChannel.SUBSCRIBE, listener);
      return () => {
        ipcRenderer.removeListener(IpcChannel.SUBSCRIBE, listener);
      };
    },

    async getState() {
      return ipcRenderer.invoke(IpcChannel.GET_STATE) as Promise<S>;
    },

    dispatch(action: Thunk<S> | Action | string, payload?: unknown) {
      if (typeof action === 'function') {
        console.error('Thunks cannot be dispatched from the renderer process');
        throw new Error('Thunks cannot be dispatched from the renderer process');
      } else if (typeof action === 'string') {
        ipcRenderer.send(IpcChannel.DISPATCH, {
          type: action,
          payload: payload,
        });
      } else {
        ipcRenderer.send(IpcChannel.DISPATCH, action);
      }
    },
  };

  return { handlers };
};

export type PreloadZustandBridge = typeof preloadZustandBridge;
