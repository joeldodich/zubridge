import { type BrowserWindow } from 'electron';
import { type StoreApi } from 'zustand';
import { createDispatch, createZustandAdapter } from '@zubridge/electron/main';
import type { State } from '../../types/index.js';
import { BaseSystemTray } from '../../main/tray/base.js';

/**
 * Basic mode tray implementation
 * In basic mode, we use the store's dispatch with an adapter
 */
export class BasicSystemTray extends BaseSystemTray {
  public init(store: StoreApi<State>, window: BrowserWindow) {
    this.window = window;

    // Create a proper state manager adapter for the store
    const stateManager = createZustandAdapter(store);

    // Now create dispatch with the state manager
    this.dispatch = createDispatch(stateManager);

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  }
}
