import { contextBridge, ipcRenderer } from 'electron';

import { preloadZustandBridge } from '@zubridge/electron/preload';
import 'wdio-electron-service/preload';

import type { State } from '../features/index.js';

// instantiate bridge
const { handlers } = preloadZustandBridge<State>();

// expose handlers to renderer process
contextBridge.exposeInMainWorld('zubridge', handlers);

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
