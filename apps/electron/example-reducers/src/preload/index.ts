import { contextBridge, ipcRenderer } from 'electron';

import { preloadZustandBridge } from '@zubridge/electron/preload';
import 'wdio-electron-service/preload';

import type { State } from '../features/index.js';

const { handlers } = preloadZustandBridge<State>();

// Expose the handlers to the renderer process
contextBridge.exposeInMainWorld('zubridge', {
  ...handlers,
  // Add the unsubscribe method that uses our custom IPC handler
  unsubscribe: () => ipcRenderer.invoke('window-unsubscribe'),
});

// Add API to interact with the window - simplified to just what we need
contextBridge.exposeInMainWorld('electron', {
  closeCurrentWindow: () => ipcRenderer.invoke('closeCurrentWindow'),
  isMainWindow: () => ipcRenderer.invoke('is-main-window'),
});

// Signal that this window has been created
// Wait for window to be ready before signaling
window.addEventListener('DOMContentLoaded', () => {
  // Send the window-created event after a short delay
  setTimeout(() => {
    ipcRenderer.invoke('window-created').catch((err) => {
      console.error('Error signaling window creation:', err);
    });
  }, 200);
});
