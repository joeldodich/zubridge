import { type BrowserWindow } from 'electron';
import { type StoreApi } from 'zustand';
import { createDispatch, createZustandAdapter } from '@zubridge/electron/main';
import type { State } from '../../types/index.js';
import { BaseSystemTray } from '../../main/tray/base.js';

// Import handlers from main.ts
import { createHandlers } from './main.js';

/**
 * Handlers mode tray implementation
 * In handlers mode, we use state manager adapter with handlers
 */
export class HandlersSystemTray extends BaseSystemTray {
  public init(store: StoreApi<State>, window: BrowserWindow) {
    this.window = window;

    // Get handlers from main.ts
    const handlers = createHandlers(store);

    // Create a proper state manager adapter for the store with handlers
    const stateManager = createZustandAdapter(store, { handlers });

    // Now create dispatch with the state manager
    this.dispatch = createDispatch(stateManager);

    // Initialize immediately with current state
    this.update(store.getState());

    // Subscribe to state changes to update the tray UI
    store.subscribe((state) => this.update(state));
  }
}
