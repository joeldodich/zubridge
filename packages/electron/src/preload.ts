import { ipcRenderer } from 'electron';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

import { IpcChannel } from './constants';

export type PreloadZustandBridgeReturn<S extends AnyState> = {
  handlers: Handlers<S>;
};

/**
 * Modern preload bridge that implements the new backend contract
 */
export const preloadBridge = <S extends AnyState>(): PreloadZustandBridgeReturn<S> => {
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
        // For thunks, we don't do anything in the preload
        // The renderer implementation will handle executing them
        // This just prevents an error from being thrown
        return;
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

/**
 * Legacy preload bridge for backward compatibility
 * @deprecated This is now an alias for preloadBridge and uses the new IPC channels.
 * Please update your code to use preloadBridge directly in the future.
 */
export const preloadZustandBridge = preloadBridge;

export type PreloadZustandBridge = typeof preloadZustandBridge;
export type PreloadBridge = typeof preloadBridge;
