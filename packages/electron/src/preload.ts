import { ipcRenderer } from 'electron';
import type { AnyState, Handlers, Action, Thunk } from '@zubridge/types';

export type PreloadZustandBridgeReturn<S extends AnyState> = {
  handlers: Handlers<S>;
};

export const preloadZustandBridge = <S extends AnyState>(...args: string[]): PreloadZustandBridgeReturn<S> => {
  const handlers: Handlers<S> = {
    subscribe(callback: (state: S) => void) {
      const channel = args[0] || 'zustand-update';
      const listener = (_: unknown, state: S) => callback(state);
      ipcRenderer.on(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    },

    async getState() {
      const channel = args[1] || 'zustand-getState';
      return ipcRenderer.invoke(channel) as Promise<S>;
    },

    dispatch(action: Thunk<S> | Action | string, payload?: unknown) {
      const channel = args[2] || 'zustand-dispatch';
      if (typeof action === 'function') {
        console.error('Thunks cannot be dispatched from the renderer process');
        throw new Error('Thunks cannot be dispatched from the renderer process');
      } else if (typeof action === 'string') {
        ipcRenderer.send(channel, { type: action, payload });
      } else {
        ipcRenderer.send(channel, action);
      }
    },
  };

  return { handlers };
};

export type PreloadZustandBridge = typeof preloadZustandBridge;
