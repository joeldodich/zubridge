import { BrowserWindow } from 'electron';
import path from 'node:path';
import { createAction } from '@reduxjs/toolkit';
import type { AnyAction } from '@reduxjs/toolkit';
import { isDev } from '@zubridge/electron';
import { getPreloadPath } from '../../../utils/path.js';

// Define window state interface
export interface WindowState {
  isOpen: boolean;
}

// Initial state
const initialState: WindowState = {
  isOpen: false,
};

// Action creators
export const createWindow = createAction('WINDOW:CREATE');
export const closeWindow = createAction<{ windowId?: number }>('WINDOW:CLOSE');

// Helper functions
const createWindowImpl = () => {
  console.log('[Redux Reducer] Creating runtime window');

  // Get preload path using the utility function
  const preloadPath = getPreloadPath(__dirname);
  console.log('[Redux Reducer] Using preload path:', preloadPath);

  // Window options
  const windowOptions = {
    width: 400,
    height: 330,
    title: 'Zubridge Electron Example (Redux) - Runtime Window',
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
  window.setTitle('Zubridge Electron Example (Redux) - Runtime Window');

  // Load content into the window
  const loadWindow = async () => {
    const isDevMode = await isDev();

    if (isDevMode) {
      // Use the same dev server URL as the main window, but with a query parameter
      const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/';
      const runtimeWindowUrl = new URL(devServerUrl);
      runtimeWindowUrl.searchParams.append('runtime', 'true');
      window.loadURL(runtimeWindowUrl.href);
    } else {
      // In production, use the same HTML file as the main window, but with a query parameter
      const mainHtmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
      window.loadFile(mainHtmlPath, { query: { runtime: 'true' } });
    }
  };

  loadWindow();
  return window;
};

const closeWindowImpl = (windowId?: number) => {
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

// Redux reducer
export const windowReducer = (state = initialState, action: AnyAction): WindowState => {
  switch (action.type) {
    case 'WINDOW:CREATE':
      console.log('[Redux Reducer] Handling WINDOW:CREATE');
      createWindowImpl();
      return { isOpen: true };

    case 'WINDOW:CLOSE': {
      console.log('[Redux Reducer] Handling WINDOW:CLOSE');
      const windowId = action.payload?.windowId;
      const closed = closeWindowImpl(windowId);
      return { isOpen: state.isOpen && !closed };
    }

    default:
      return state;
  }
};
