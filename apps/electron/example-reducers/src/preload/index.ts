import { contextBridge } from 'electron';

import { preloadZustandBridge } from '@zubridge/electron/preload';
import 'wdio-electron-service/preload';

import type { State } from '../features/index.js';

const { handlers } = preloadZustandBridge<State>();

// Expose the handlers to the renderer process
contextBridge.exposeInMainWorld('zubridge', handlers);
