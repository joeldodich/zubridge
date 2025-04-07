import { type BrowserWindow } from 'electron';
import { type StoreApi } from 'zustand';
import { createDispatch } from '@zubridge/electron/main';
import type { State } from '../../types/state.js';
import { BaseSystemTray } from '../../main/tray/base.js';

/**
 * Basic mode tray implementation
 * In basic mode, we use the store's dispatch directly
 */
export class BasicSystemTray extends BaseSystemTray {
  public init(store: StoreApi<State>, window: BrowserWindow) {
    this.window = window;

    // In basic mode, we use the store's dispatch directly
    this.dispatch = createDispatch(store);

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  }
}
