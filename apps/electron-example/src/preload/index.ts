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

// Add API to interact with the window - simplified to just what we need
contextBridge.exposeInMainWorld('electron', {
  closeCurrentWindow: () => {
    console.log('[Preload] Invoking closeCurrentWindow');
    return ipcRenderer.invoke('closeCurrentWindow');
  },
  isMainWindow: () => {
    console.log('[Preload] Invoking isMainWindow');
    return ipcRenderer.invoke('is-main-window');
  },
  getWindowId: () => {
    console.log('[Preload] Invoking getWindowId');
    return ipcRenderer.invoke('get-window-id');
  },
  getMode: () => {
    console.log('[Preload] Invoking getMode');
    return ipcRenderer.invoke('get-mode');
  },
  quitApp: () => {
    console.log('[Preload] Invoking quitApp');
    return ipcRenderer.invoke('quitApp');
  },
  getDebugInfo: async () => {
    try {
      const [isMain, windowId, mode] = await Promise.all([
        ipcRenderer.invoke('is-main-window'),
        ipcRenderer.invoke('get-window-id'),
        ipcRenderer.invoke('get-mode'),
      ]);

      return {
        isMainWindow: isMain,
        windowId,
        mode: mode.mode,
        modeName: mode.modeName,
        loadTime: new Date().toLocaleTimeString(),
        connected: true,
      };
    } catch (error) {
      console.error('[Preload] Error getting debug info:', error);
      return {
        isMainWindow: false,
        windowId: null,
        mode: 'unknown',
        modeName: 'Unknown',
        loadTime: new Date().toLocaleTimeString(),
        connected: false,
        error: String(error),
      };
    }
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
