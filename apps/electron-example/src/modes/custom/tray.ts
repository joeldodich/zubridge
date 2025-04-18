import { type BrowserWindow } from 'electron';
import { createDispatch } from '@zubridge/electron/main';
import { BaseSystemTray } from '../../main/tray/base.js';
import type { BaseState } from '../../types/index.js';
import type { StoreApi } from 'zustand';
import type { Store } from 'redux';
import type { Dispatch } from '@zubridge/types';
import { stateManager } from './main.js';

/**
 * Custom mode tray implementation
 * In custom mode, we use the same state manager as the bridge
 */
export class CustomSystemTray extends BaseSystemTray {
  private stateUnsubscribe: (() => void) | null = null;

  public init(_store: StoreApi<BaseState> | Store | any, window: BrowserWindow) {
    this.window = window;

    console.log('[Custom Tray] Initializing with state manager');

    // Create dispatch directly from the state manager
    // Use type assertion since our custom state manager uses AnyState but the tray expects BaseState
    this.dispatch = createDispatch(stateManager) as unknown as Dispatch<BaseState>;

    // Initialize immediately with current state
    const currentState = stateManager.getState();

    // Create a valid BaseState with theme information
    const state: BaseState = {
      counter: typeof currentState.counter === 'number' ? currentState.counter : 0,
      theme: {
        isDark: false, // Default to light theme
      },
      window: { isOpen: false },
    };

    // Safely update theme if it exists in the current state
    if (
      currentState &&
      typeof currentState === 'object' &&
      'theme' in currentState &&
      currentState.theme &&
      typeof currentState.theme === 'object' &&
      'isDark' in currentState.theme &&
      typeof currentState.theme.isDark === 'boolean'
    ) {
      state.theme.isDark = currentState.theme.isDark;
    }

    this.update(state);

    // Subscribe to state changes to update the tray UI
    this.stateUnsubscribe = stateManager.subscribe((state: any) => {
      console.log(`[Custom Tray] State update:`, state);

      // Create a valid BaseState with theme information
      const updatedState: BaseState = {
        counter: typeof state.counter === 'number' ? state.counter : 0,
        theme: {
          isDark: false, // Default to light theme
        },
        window: { isOpen: false },
      };

      // Safely update theme if it exists in the current state
      if (
        state &&
        typeof state === 'object' &&
        'theme' in state &&
        state.theme &&
        typeof state.theme === 'object' &&
        'isDark' in state.theme &&
        typeof state.theme.isDark === 'boolean'
      ) {
        updatedState.theme.isDark = state.theme.isDark;
      }

      // Update the tray with the validated state
      this.update(updatedState);
    });
  }

  // Override the destroy method to clean up our subscriptions
  public destroy = () => {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    this.dispatch = undefined;

    // Call the parent implementation
    if (this.electronTray) {
      this.electronTray.destroy();
      this.electronTray = undefined;
    }
  };
}
