import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { StoreApi } from 'zustand';
import { isDev } from '@zubridge/electron';
import { getPreloadPath } from '../../../../utils/path.js';
import type { BaseState } from '../../../../types/index.js';

/**
 * Creates a runtime window
 */
const createRuntimeWindow = async () => {
  console.log('[Basic] Creating runtime window');

  // Get preload path using the utility function
  const preloadPath = getPreloadPath(__dirname);
  console.log('[Basic] Using preload path:', preloadPath);

  // Window options
  const windowOptions = {
    width: 400,
    height: 330,
    title: 'Zubridge Electron Example (Basic) - Runtime Window',
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
  window.setTitle('Zubridge Electron Example (Basic) - Runtime Window');

  // Load content into the window
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
    console.log('[Basic] Loading runtime window from:', mainHtmlPath);
    window.loadFile(mainHtmlPath, { query: { runtime: 'true' } });
  }

  return window;
};

/**
 * Closes a window by id or the last window if no id is provided
 */
const closeRuntimeWindow = (windowId?: number) => {
  console.log(`[Basic] Closing window${windowId ? ` with ID: ${windowId}` : ''}`);

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
 * Attaches window handlers to the store
 */
export const attachWindowHandlers = <S extends BaseState>(store: StoreApi<S>) => {
  const { setState } = store;

  // Set up window initial state
  setState((state) => ({
    ...state,
    'window': {
      isOpen: false,
    },

    // Implement the create window handler
    'WINDOW:CREATE': async () => {
      console.log('[Basic] Handling WINDOW:CREATE');

      // Create the window
      await createRuntimeWindow();

      // Update state
      setState((state) => ({
        ...state,
        window: {
          isOpen: true,
        },
      }));
    },

    // Implement the close window handler
    'WINDOW:CLOSE': (payload) => {
      console.log('[Basic] Handling WINDOW:CLOSE');

      // Close the window
      const closed = closeRuntimeWindow(payload?.windowId);

      // Only update state if a window was actually closed
      if (closed) {
        setState((state) => ({
          ...state,
          window: {
            isOpen: false,
          },
        }));
      }
    },
  }));
};
