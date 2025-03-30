import path from 'node:path';

import { BrowserWindow, type BrowserWindowConstructorOptions, app } from 'electron';
import { mainZustandBridge } from '@zubridge/electron/main';
import 'wdio-electron-service/main';

import { actionHandlers } from '../features/index.js';
import { initialState, store } from './store.js';
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
const runtimeWindows: BrowserWindow[] = [];

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
    const handlers = actionHandlers(store, initialState);

    // Initialize the system tray
    tray.init(store, mainWindow, handlers);

    // Set the badge count to the current counter value
    store.subscribe((state) => app.setBadgeCount(state.counter ?? 0));

    const bridge = mainZustandBridge(store, [mainWindow], { handlers });

    // Handle window creation
    store.subscribe((_state, _prevState) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > runtimeWindows.length + 1) {
        const newWindow = windows[windows.length - 1];
        runtimeWindows.push(newWindow);
        bridge.subscribe([newWindow]);
      }
    });

    app.on('quit', () => {
      tray.destroy();
      bridge.unsubscribe();
    });

    app.focus({ steal: true });
    mainWindow.focus();
  })
  .catch(console.error);
