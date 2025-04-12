import { type BrowserWindow, Menu, Tray, app, nativeImage } from 'electron';
import { createDispatch } from '@zubridge/electron/main';
import path from 'node:path';
import fs from 'node:fs';
import { isDev } from '@zubridge/electron';

import type { State } from '../../types/state.js';
import type { StoreApi } from 'zustand';

// Define the expected path relative to the main process file in dev
const devIconPath = path.join(__dirname, '..', '..', 'resources', 'electron-logo.png');
// Define the expected path in production (assuming it's copied to resources)
const prodIconPath = path.join(process.resourcesPath, 'electron-logo.png');

let finalTrayIconPath: string | null = null;

const checkPath = async () => {
  const isDevMode = await isDev(); // Check dev mode
  if (isDevMode) {
    console.log('[Tray Icon] Checking dev path:', devIconPath);
    if (fs.existsSync(devIconPath)) {
      finalTrayIconPath = devIconPath;
    }
  } else {
    console.log('[Tray Icon] Checking prod path:', prodIconPath);
    if (fs.existsSync(prodIconPath)) {
      finalTrayIconPath = prodIconPath;
    }
    // Optional: Add fallback checks for other prod locations if needed
  }

  if (finalTrayIconPath) {
    console.log('[Tray Icon] Found icon at:', finalTrayIconPath);
  } else {
    console.warn('[Tray Icon] Icon not found at expected locations. Using blank icon.');
    console.log('  Checked Dev Path:', devIconPath);
    console.log('  Checked Prod Path:', prodIconPath);
  }
};

// Run the check asynchronously
await checkPath();

// Create tray icon from path or use blank if not found
const trayIcon = finalTrayIconPath
  ? nativeImage.createFromPath(finalTrayIconPath).resize({ width: 18, height: 18 })
  : nativeImage.createEmpty().resize({ width: 18, height: 18 });

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
