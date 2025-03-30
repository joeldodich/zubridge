import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Reducer } from '@zubridge/electron';

export type WindowState = {
  isOpen: boolean;
};

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

export const createWindow = () => {
  const runtimeWindow = new BrowserWindow({ ...windowOptions, show: true });
  if (isDev) {
    runtimeWindow.loadURL('http://localhost:5173');
  } else {
    runtimeWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }
};

export const closeWindow = () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 1) {
    windows[windows.length - 1].close();
  }
};

export const reducer: Reducer<WindowState> = (state, action: { type: string }) => {
  switch (action.type) {
    case 'WINDOW:CREATE':
      createWindow();
      return { isOpen: true };
    case 'WINDOW:CLOSE':
      closeWindow();
      return { isOpen: false };
    default:
      return state;
  }
};
