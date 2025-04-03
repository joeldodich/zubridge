import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { Reducer, Action } from '@zubridge/electron';

export type WindowState = {
  isOpen: boolean;
};

// Define window action types for better type safety in our code
export type WindowActionType = 'WINDOW:CREATE' | 'WINDOW:CLOSE';

const isDev = process.env.NODE_ENV === 'development' || !process.env.VITE_DEV_SERVER_URL;

const windowOptions = {
  width: 320,
  height: 380,
  title: 'Runtime Window',
  webPreferences: {
    contextIsolation: true,
    scrollBounce: true,
    sandbox: true,
    nodeIntegration: false,
    // preload path will be set in createWindow
  },
};

export const createWindow = () => {
  // Ensure we always use the absolute path for the preload script
  // This is critical for windows created from other windows
  const preloadPath = path.resolve(__dirname, '..', 'preload', 'index.cjs');

  const runtimeWindow = new BrowserWindow({
    ...windowOptions,
    webPreferences: {
      ...windowOptions.webPreferences,
      // Set the correct preload path
      preload: preloadPath,
      // Ensure inheritance of zooming settings
      zoomFactor: 1.0,
      // Make sure context isolation is enabled
      contextIsolation: true,
      // Keep sandbox enabled for security
      sandbox: true,
      // Disable node integration for security
      nodeIntegration: false,
    },
    show: true,
  });

  // Add event handlers
  runtimeWindow.on('ready-to-show', () => {
    runtimeWindow.show();
  });

  if (isDev) {
    // Use the dev server URL but load the runtime-window.html file directly
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/';
    const runtimeWindowUrl = new URL(devServerUrl);
    runtimeWindowUrl.pathname = '/runtime-window.html';
    console.log('Loading runtime window from dev URL:', runtimeWindowUrl.href);
    runtimeWindow.loadURL(runtimeWindowUrl.href);
  } else {
    // In production, use the dedicated runtime window HTML file
    const runtimeHtmlPath = path.join(__dirname, '..', 'renderer', 'runtime-window.html');
    console.log('Loading runtime window from path:', runtimeHtmlPath);
    runtimeWindow.loadFile(runtimeHtmlPath);
  }

  // Open DevTools to help debugging
  runtimeWindow.webContents.openDevTools();

  return runtimeWindow;
};

export const closeWindow = (windowId?: number) => {
  const windows = BrowserWindow.getAllWindows();

  // Never close if there's only one window left
  if (windows.length <= 1) {
    // Just minimize the window instead
    if (windows.length === 1) {
      windows[0].minimize();
    }
    return false;
  }

  // If a specific window ID was provided, close that window
  if (windowId !== undefined) {
    const targetWindow = windows.find((win) => win.id === windowId);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.removeAllListeners();
      targetWindow.close();
      return true;
    }
    return false;
  }

  // Default behavior: close the last window in the list
  for (let i = windows.length - 1; i >= 0; i--) {
    const win = windows[i];
    if (!win.isDestroyed()) {
      win.removeAllListeners();
      win.close();
      return true;
    }
  }

  return false;
};

export const reducer: Reducer<WindowState> = (state, action: Action) => {
  switch (action.type) {
    case 'WINDOW:CREATE':
      createWindow();
      return { isOpen: true };
    case 'WINDOW:CLOSE':
      const payload = action.payload as { windowId?: number } | undefined;
      const closed = closeWindow(payload?.windowId);
      return { isOpen: state.isOpen && !closed };
    default:
      return state;
  }
};
