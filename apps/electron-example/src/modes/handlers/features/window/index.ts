import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { StoreApi } from 'zustand';
import { isDev } from '@zubridge/electron';
import type { State } from '../index.js';
import { getPreloadPath } from '../../../../utils/path.js';

/**
 * Creates a handler function for creating a new window
 * In the handlers pattern, each action has a separate handler function
 */
export const createWindow =
  <S extends State>(store: StoreApi<S>) =>
  () => {
    console.log('[Handler] Creating runtime window');

    // Get preload path using the utility function
    const preloadPath = getPreloadPath(__dirname);
    console.log('[Handler] Using preload path:', preloadPath);

    // Window options
    const windowOptions = {
      width: 400,
      height: 330,
      title: 'Zubridge Electron Example (Handlers) - Runtime Window',
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
    window.setTitle('Zubridge Electron Example (Handlers) - Runtime Window');

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
        console.log('[Handler] Loading runtime window from:', mainHtmlPath);
        window.loadFile(mainHtmlPath, { query: { runtime: 'true' } });
      }
    };

    loadWindow();

    // Update store state
    store.setState((state) => ({
      ...state,
      window: {
        ...state.window,
        isOpen: true,
      },
    }));

    return window;
  };

/**
 * Creates a handler function for closing a window
 */
export const closeWindow =
  <S extends State>(store: StoreApi<S>) =>
  (payload?: { windowId?: number }) => {
    const windowId = payload?.windowId;
    console.log(`[Handler] Closing window${windowId ? ` with ID: ${windowId}` : ''}`);

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

        // Update store state
        store.setState((state) => ({
          ...state,
          window: {
            ...state.window,
            isOpen: windows.length > 2, // Still open if there are more than 2 windows (1 main + 1+ runtime)
          },
        }));

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

        // Update store state
        store.setState((state) => ({
          ...state,
          window: {
            ...state.window,
            isOpen: windows.length > 2, // Still open if there are more than 2 windows (1 main + 1+ runtime)
          },
        }));

        return true;
      }
    }

    return false;
  };
