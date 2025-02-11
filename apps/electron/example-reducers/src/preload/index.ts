import { contextBridge, ipcRenderer } from 'electron';

import { preloadZustandBridge } from 'zubridge-electron/preload';
import 'wdio-electron-service/preload';
import type { Handlers } from 'zubridge-electron';

import type { State } from '../features/index.js';

export const { handlers } = preloadZustandBridge<State>(ipcRenderer);

contextBridge.exposeInMainWorld('zubridge-electron', handlers);

declare global {
  interface Window {
    ['zubridge-electron']: Handlers<State>;
  }
}
