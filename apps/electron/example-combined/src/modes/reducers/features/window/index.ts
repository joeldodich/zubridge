import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { Action, Reducer } from '@zubridge/electron';
import { isDev } from '@zubridge/electron';
import { getPreloadPath } from '../../../../utils/path.js';

export interface WindowState {
  isOpen: boolean;
}

export type WindowAction = { type: 'WINDOW:CREATE' } | { type: 'WINDOW:CLOSE'; payload?: { windowId?: number } };

/**
 * Creates a runtime window for the example app
 */
export const createWindow = () => {
  console.log('[Reducer] Creating runtime window');

  // Get preload path using the utility function
  const preloadPath = getPreloadPath(__dirname);
  console.log('[Reducer] Using preload path:', preloadPath);
  console.log('[Reducer] Current directory:', __dirname);

  // Window options
  const windowOptions = {
    width: 400,
    height: 330,
    title: 'Zubridge Electron Example (Reducers) - Runtime Window',
    webPreferences: {
      contextIsolation: true,
      scrollBounce: true,
      sandbox: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  };

  // Create the window
  const window = new BrowserWindow(windowOptions);

  // Explicitly set the window title
  window.setTitle('Zubridge Electron Example (Reducers) - Runtime Window');

  // Load content into the window
  const loadWindow = async () => {
    const isDevMode = await isDev();

    if (isDevMode) {
      // Use the same dev server URL as the main window, but with a query parameter
      const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/';
      const runtimeWindowUrl = new URL(devServerUrl);
      runtimeWindowUrl.searchParams.append('runtime', 'true');
      window.loadURL(runtimeWindowUrl.href);

      // Open DevTools to help debugging
      window.webContents.openDevTools();
    } else {
      // In production, use the same HTML file as the main window, but with a query parameter
      // Using __dirname which points to the location of this file in the packaged app
      const mainHtmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
      console.log('[Reducer] Loading runtime window from:', mainHtmlPath);
      window.loadFile(mainHtmlPath, { query: { runtime: 'true' } });
    }
  };

  loadWindow();

  return window;
};

/**
 * Closes a window by id or the last window if no id is provided
 */
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

/**
 * Reducer for window state
 * In the reducers pattern, the reducer function handles
 * all the window-related actions
 */
export const reducer: Reducer<WindowState> = (state = { isOpen: false }, action: Action) => {
  // Get type from action, handling both string and object actions
  const actionType = typeof action === 'string' ? action : action.type;

  switch (actionType) {
    case 'WINDOW:CREATE':
      console.log('[Reducer] Handling WINDOW:CREATE');
      createWindow();
      return { isOpen: true };

    case 'WINDOW:CLOSE': {
      console.log('[Reducer] Handling WINDOW:CLOSE');
      const payload = typeof action === 'string' ? undefined : (action.payload as { windowId?: number } | undefined);
      const closed = closeWindow(payload?.windowId);
      return { isOpen: state.isOpen && !closed };
    }

    default:
      return state;
  }
};
