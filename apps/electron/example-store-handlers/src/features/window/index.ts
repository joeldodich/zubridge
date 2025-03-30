import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Store } from '../../main/store.js';

const isDev = process.env.NODE_ENV === 'development' || !process.env.VITE_DEV_SERVER_URL;

const windowOptions = {
  width: 256,
  height: 256,
  title: 'Runtime Window',
  webPreferences: {
    contextIsolation: true,
    scrollBounce: true,
    sandbox: true,
    nodeIntegration: false,
    preload: path.join(__dirname, '..', '..', 'preload', 'index.cjs'),
  },
};

export const handlers = (_setState: Store['setState']) => ({
  'WINDOW:CREATE': () => {
    const runtimeWindow = new BrowserWindow({ ...windowOptions, show: true });
    if (isDev) {
      runtimeWindow.loadURL('http://localhost:5173');
    } else {
      runtimeWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
    }
  },
  'WINDOW:CLOSE': () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 1) {
      windows[windows.length - 1].close();
    }
  },
});
