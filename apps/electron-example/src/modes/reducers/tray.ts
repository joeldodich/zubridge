import { type BrowserWindow } from 'electron';
import { type StoreApi } from 'zustand';
import { createDispatch, createZustandAdapter } from '@zubridge/electron/main';

import { BaseSystemTray } from '../../main/tray/base.js';
import { rootReducer } from './features/index.js';
import type { State } from '../../types/index.js';

/**
 * Reducers mode tray implementation
 * In reducers mode, we use state manager adapter with reducer
 */
export class ReducersSystemTray extends BaseSystemTray {
  public init(store: StoreApi<State>, window: BrowserWindow) {
    this.window = window;

    // Create a proper state manager adapter for the store with reducer
    const stateManager = createZustandAdapter(store, { reducer: rootReducer });

    // Now create dispatch with the state manager
    this.dispatch = createDispatch(stateManager);

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  }
}
