import path from 'node:path';
import { BrowserWindow, type BrowserWindowConstructorOptions, app, ipcMain } from 'electron';

import { mainZustandBridge } from '@zubridge/electron/main';
import 'wdio-electron-service/main';

import { actionHandlers, State, Store } from '../features/index.js';
import { initialState, store } from './store.js';
import { tray } from './tray/index.js';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const icon = path.join(__dirname, '..', '..', 'resources', 'images', 'icon.png');

const windowOptions: BrowserWindowConstructorOptions = {
  show: false,
  icon,
  title: '@zubridge/electron',
  width: 320,
  height: 380,
  webPreferences: {
    contextIsolation: true,
    scrollBounce: true,
    sandbox: true,
    nodeIntegration: false,
    preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
  },
};

let mainWindow: BrowserWindow;
// Track windows that need cleanup
const runtimeWindows: BrowserWindow[] = [];

function initMainWindow() {
  // Check if mainWindow exists and is not destroyed
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return mainWindow;
  }

  // Create a new main window if it doesn't exist or was destroyed
  mainWindow = new BrowserWindow(windowOptions);

  // In development mode, load the URL from the dev server
  if (isDev) {
    // Load from the dev server URL (default is http://localhost:5173)
    mainWindow.loadURL('http://localhost:5173/');

    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the file system
    const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // For the main window, just hide it instead of closing
  // This avoids issues with accessing destroyed windows
  mainWindow.on('close', (event) => {
    // If there are other windows open, allow this to close normally
    if (BrowserWindow.getAllWindows().length > 1) {
      return;
    }

    // If this is the last window, prevent default close and hide instead
    event.preventDefault();
    mainWindow.hide();
  });

  return mainWindow;
}

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    // Create the main window first
    initMainWindow();

    // Initialize the system tray
    tray.init(store, mainWindow);

    // Set the badge count to the current counter value
    store.subscribe((state) => {
      app.setBadgeCount(state.counter ?? 0);
    });

    const handlers = actionHandlers(store, initialState);

    // Initialize the system tray
    tray.init(store, mainWindow);

    // Set the badge count to the current counter value
    store.subscribe((state) => app.setBadgeCount(state.counter ?? 0));

    const bridge = mainZustandBridge<State, Store>(store, [mainWindow]);

    // Destructure the subscribe function from the bridge
    const { subscribe } = bridge;

    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    app.on('activate', () => {
      // Check if main window is destroyed or needs to be recreated
      const hasMainWindow = mainWindow && !mainWindow.isDestroyed();

      if (!hasMainWindow) {
        // Recreate main window
        const newMainWindow = initMainWindow();

        // Subscribe it to the bridge
        subscribe([newMainWindow]);
      } else if (!mainWindow.isVisible()) {
        // If main window exists but is not visible, show it
        mainWindow.show();
      }

      // Focus the main window
      mainWindow.focus();
    });

    // Function to track and subscribe new windows to the bridge
    const trackNewWindows = () => {
      try {
        // Get all open windows
        const allWindows = BrowserWindow.getAllWindows();

        // Find windows that aren't already being tracked
        for (const win of allWindows) {
          // Skip destroyed windows and the main window (it's already tracked)
          if (win.isDestroyed() || win === mainWindow) {
            continue;
          }

          // Check if this window is already being tracked
          const isTracked = runtimeWindows.some((w) => w === win);

          if (!isTracked) {
            console.log('New window detected, subscribing to bridge');

            // Add to tracked windows
            runtimeWindows.push(win);

            // Subscribe window to the bridge
            const subscription = subscribe([win]);

            // Add a listener to clean up when the window is closed
            win.once('closed', () => {
              // Remove from runtime windows array
              const index = runtimeWindows.indexOf(win);
              if (index !== -1) {
                runtimeWindows.splice(index, 1);
              }
              // Unsubscribe the window from the bridge
              subscription.unsubscribe();
              console.log(`Window ${win.id} closed and unsubscribed`);
            });
          }
        }

        // Clean up any destroyed windows
        for (let i = runtimeWindows.length - 1; i >= 0; i--) {
          const win = runtimeWindows[i];
          if (win.isDestroyed()) {
            runtimeWindows.splice(i, 1);
          }
        }
      } catch (error) {
        console.error('Error tracking windows:', error);
      }
    };

    // Run the tracker when a new window is created via our action
    store.subscribe((state, prevState) => {
      if (state.window.isOpen !== prevState?.window?.isOpen) {
        // Window state changed, we should check for any changes
        setTimeout(trackNewWindows, 100); // Small delay to ensure window is fully created or closed
      }
    });

    // Also poll for new windows every second to catch any windows created by child windows
    const windowTrackingInterval = setInterval(trackNewWindows, 1000);

    // Make sure to clear the interval when the app quits
    app.on('quit', () => {
      try {
        // Clear the tracking interval
        clearInterval(windowTrackingInterval);

        // Clean up tray
        tray.destroy();

        // Unsubscribe all windows from the bridge
        bridge.unsubscribe();

        // Close all runtime windows to avoid memory leaks
        [...runtimeWindows].forEach((window) => {
          if (window && !window.isDestroyed()) {
            window.removeAllListeners();
            window.close();
          }
        });

        // Clear the runtime windows array
        runtimeWindows.length = 0;
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });

    app.focus({ steal: true });
    mainWindow.focus();

    // Set up the handler for closeCurrentWindow
    ipcMain.handle('closeCurrentWindow', (event) => {
      // Get the window that sent this message
      const window = BrowserWindow.fromWebContents(event.sender);

      if (window) {
        // If this is the main window, just minimize it
        if (window === mainWindow) {
          window.minimize();
        } else {
          // Close the window using our action handler
          handlers['WINDOW:CLOSE']({ windowId: window.id });
        }
      }
    });

    // Set up handler for window-created event
    ipcMain.handle('window-created', (_event) => {
      // Immediately track the new window
      trackNewWindows();
      return true;
    });

    // Set up handler to check if the window is the main window
    ipcMain.handle('is-main-window', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      // Check if this is the main window
      return window === mainWindow;
    });
  })
  .catch(console.error);
