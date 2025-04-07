import { type BrowserWindow, Menu, Tray, app, nativeImage } from 'electron';
import { createDispatch } from '@zubridge/electron/main';
import path from 'node:path';
import fs from 'node:fs';

import type { State } from '../../types/state.js';
import type { StoreApi } from 'zustand';

// Resolve the tray icon path for different environments
let trayIconPath;
// Try different paths to find the tray icon
const possiblePaths = [
  // For development
  path.join(__dirname, '..', '..', '..', '..', '..', 'resources', 'trayIcon.png'),
  // For production in app.asar
  path.join(process.resourcesPath, 'trayIcon.png'),
  // Alternative production path
  path.join(__dirname, '..', '..', 'resources', 'trayIcon.png'),
];

// Find the first path that exists
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    trayIconPath = p;
    console.log('Found tray icon at:', trayIconPath);
    break;
  }
}

// Fallback to a default icon if none found
if (!trayIconPath) {
  console.warn('Tray icon not found, using blank icon');
  trayIconPath = path.join(__dirname, '..', '..', '..', '..', '..', 'resources', 'trayIcon.png');
}

const trayIcon = nativeImage.createFromPath(trayIconPath).resize({
  width: 18,
  height: 18,
});

/**
 * Base SystemTray class with common functionality
 * Mode-specific implementations will extend this class
 */
export class BaseSystemTray {
  protected dispatch?: ReturnType<typeof createDispatch<State, StoreApi<State>>>;
  protected electronTray?: Tray;
  protected window?: BrowserWindow;

  protected update = (state: State) => {
    if (!this.dispatch) {
      return;
    }
    if (!this.electronTray) {
      this.electronTray = new Tray(trayIcon);
    }

    const dispatch = this.dispatch;
    const showWindow = () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.show();
        this.window.focus();
      }
    };
    const stateText = `state: ${state.counter ?? 'loading...'}`;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'decrement',
        type: 'normal',
        click: () => {
          dispatch('COUNTER:DECREMENT');
          showWindow();
        },
      },
      {
        label: stateText,
        type: 'normal',
        click: () => showWindow(),
      },
      {
        label: 'increment',
        type: 'normal',
        click: () => {
          dispatch('COUNTER:INCREMENT');
          showWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.electronTray.setContextMenu(contextMenu);
    this.electronTray.setToolTip(stateText);
  };

  // Override this method in mode-specific implementations
  public init(store: StoreApi<State>, window: BrowserWindow) {
    this.window = window;

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  }

  public destroy = () => {
    if (this.electronTray) {
      this.electronTray.destroy();
      this.electronTray = undefined;
    }
  };
}
