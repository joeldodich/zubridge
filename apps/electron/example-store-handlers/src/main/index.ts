import path from 'node:path';

import { BrowserWindow, type BrowserWindowConstructorOptions, app } from 'electron';
import { mainZustandBridge } from '@zubridge/electron/main';
import 'wdio-electron-service/main';

import { store } from './store.js';
import { tray } from './tray/index.js';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const icon = path.join(__dirname, '..', '..', 'resources', 'images', 'icon.png');

const windowOptions: BrowserWindowConstructorOptions = {
  show: false,
  icon,
  title: '@zubridge/electron',
  width: 256,
  height: 256,
  webPreferences: {
    contextIsolation: true,
    scrollBounce: true,
    sandbox: true,
    nodeIntegration: false,
    preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
  },
};

let mainWindow: BrowserWindow;

function initMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // In development mode, load the URL from the dev server
  if (isDev) {
    // Load from the dev server URL (default is http://localhost:5173)
    mainWindow.loadURL('http://localhost:5173');

    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the file system
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    mainWindow.destroy();
  });
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
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      initMainWindow();
      mainWindow.focus();
    });

    initMainWindow();

    // Initialize the system tray
    tray.init(store, mainWindow);

    // Set the badge count to the current counter value
    store.subscribe((state) => app.setBadgeCount(state.counter ?? 0));

    const { unsubscribe, subscribe } = mainZustandBridge(store, [mainWindow]);

    app.on('quit', () => {
      tray.destroy();
      unsubscribe();
    });

    app.focus({ steal: true });
    mainWindow.focus();

    // Create a runtime window after a short delay
    setTimeout(() => {
      const runtimeWindow = new BrowserWindow({ ...windowOptions, show: true });

      // In development mode, load the URL from the dev server
      if (isDev) {
        runtimeWindow.loadURL('http://localhost:5173/runtimeWindow.html');
        runtimeWindow.webContents.openDevTools();
      } else {
        runtimeWindow.loadFile(path.join(__dirname, '..', 'renderer', 'runtimeWindow.html'));
      }

      // Register the runtime window with zubridge
      subscribe([runtimeWindow]);

      runtimeWindow.on('close', () => {
        runtimeWindow.destroy();
      });
    }, 1000);
  })
  .catch(console.error);
