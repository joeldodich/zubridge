import { contextBridge, ipcRenderer } from 'electron';

import { preloadZustandBridge } from '@zubridge/electron/preload';
import 'wdio-electron-service/preload';

import type { State } from '../types/state.js';

// Debug: Log when preload script is loaded
console.log('[Preload] Script initializing');

// instantiate bridge
const { handlers } = preloadZustandBridge<State>();

// Wrap handlers with debugging
const wrappedHandlers = {
  ...handlers,
  dispatch: (action: any, payload?: any) => {
    console.log('[Preload] Dispatching to main process:', action, payload);
    return handlers.dispatch(action, payload);
  },
  getState: async () => {
    console.log('[Preload] Getting state from main process');
    const state = await handlers.getState();
    console.log('[Preload] Received state:', state);
    return state;
  },
  subscribe: (callback: any) => {
    console.log('[Preload] Setting up subscription');
    return handlers.subscribe((state) => {
      console.log('[Preload] Subscription update received');
      callback(state);
    });
  },
};

// expose handlers to renderer process
contextBridge.exposeInMainWorld('zubridge', wrappedHandlers);

// Add API to interact with the window under a different name
contextBridge.exposeInMainWorld('electronAPI', {
  closeCurrentWindow: () => {
    console.log('[Preload] Invoking closeCurrentWindow');
    return ipcRenderer.invoke('closeCurrentWindow');
  },
  getWindowInfo: () => {
    console.log('[Preload] Invoking get-window-info');
    return ipcRenderer.invoke('get-window-info');
  },
  getMode: () => {
    console.log('[Preload] Invoking getMode');
    return ipcRenderer.invoke('get-mode');
  },
  quitApp: () => {
    console.log('[Preload] Invoking quitApp');
    return ipcRenderer.invoke('quitApp');
  },
  createRuntimeWindow: () => {
    console.log('[Preload] Invoking create-runtime-window');
    return ipcRenderer.invoke('create-runtime-window');
  },
});

// Signal that this window has been created
// Wait for window to be ready before signaling
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload] DOM content loaded');
  // Send the window-created event after a short delay
  setTimeout(() => {
    console.log('[Preload] Sending window-created signal');
    ipcRenderer.invoke('window-created').catch((err) => {
      console.error('[Preload] Error signaling window creation:', err);
    });
  }, 200);
});
