import type { BrowserWindow, WebContents } from 'electron';
import type { Store } from 'redux';
import type { StoreApi } from 'zustand/vanilla';
import type { AnyState, BackendBridge, StateManager, WebContentsWrapper } from '@zubridge/types';
import { ZustandOptions } from './adapters/zustand.js';
import { ReduxOptions } from './adapters/redux.js';
import { getStateManager } from './utils/stateManagerRegistry.js';

/**
 * Get the WebContents ID from a BrowserWindow or WebContentsWrapper
 * @internal
 */
function getWebContentsId(window: BrowserWindow | WebContentsWrapper): number {
  if ('webContents' in window) {
    return (window as BrowserWindow).webContents.id;
  } else if ('id' in window) {
    return (window as WebContents).id;
  }
  throw new Error('Invalid window object. Must be BrowserWindow or WebContents or have an id property.');
}

/**
 * Create a core bridge for electron using a state manager
 * This is the user-facing API for integration with custom state management solutions
 */
export function createCoreBridge<S extends AnyState = AnyState>(
  stateManager: StateManager<S>,
  windows: Array<BrowserWindow | WebContentsWrapper> = [],
): BackendBridge<number> {
  // Track which windows are subscribed to the store
  const subscribedWindows = new Set<number>();
  // Track unsubscribe functions for each window
  const unsubscribeFunctions = new Map<number, Function>();

  // Subscribe the initial windows if provided
  if (windows.length > 0) {
    subscribeWindows(windows);
  }

  // Subscribe windows to the store
  function subscribeWindows(windowsToSubscribe: Array<BrowserWindow | WebContentsWrapper>) {
    // Deduplicate windows
    const uniqueWindows = windowsToSubscribe.filter((window) => {
      const id = getWebContentsId(window);
      return !subscribedWindows.has(id);
    });

    // No new windows to subscribe
    if (uniqueWindows.length === 0) {
      return { unsubscribe: () => {} };
    }

    // Initialize the web contents sync for each window
    for (const window of uniqueWindows) {
      try {
        const webContentsId = getWebContentsId(window);
        const webContents = 'webContents' in window ? window.webContents : (window as WebContents);

        // Skip if already subscribed or invalid
        if (subscribedWindows.has(webContentsId) || !webContents) {
          continue;
        }

        // Get the current state to send
        const state = stateManager.getState();

        // First, send the initial state to the window
        if (!webContents.isDestroyed()) {
          webContents.send('__zubridge_state_update', state);
        }

        // Set up IPC handlers for this window
        if (!webContents.isDestroyed()) {
          // Handle action dispatch requests from the renderer
          webContents.ipc.handle('__zubridge_dispatch_action', (_event, { action }) => {
            try {
              stateManager.processAction(action);
              return { success: true };
            } catch (error) {
              console.error('[Bridge] Error processing action:', error);
              return { success: false, error: String(error) };
            }
          });

          // Handle state fetch requests
          webContents.ipc.handle('__zubridge_get_state', () => {
            return stateManager.getState();
          });
        }

        // Subscribe to state changes and forward to this window
        const unsubscribe = stateManager.subscribe((state) => {
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('__zubridge_state_update', state);
          }
        });

        // Track the subscription
        subscribedWindows.add(webContentsId);
        unsubscribeFunctions.set(webContentsId, unsubscribe);
      } catch (error) {
        console.error('[Bridge] Error subscribing window:', error);
      }
    }

    // Return an unsubscribe function for these windows
    return {
      unsubscribe: () => unsubscribeWindows(uniqueWindows),
    };
  }

  // Unsubscribe windows from the bridge
  function unsubscribeWindows(windowsToUnsubscribe?: Array<BrowserWindow | WebContentsWrapper>) {
    if (!windowsToUnsubscribe || windowsToUnsubscribe.length === 0) {
      // If no windows specified, unsubscribe all
      for (const unsubscribe of unsubscribeFunctions.values()) {
        unsubscribe();
      }
      unsubscribeFunctions.clear();
      subscribedWindows.clear();
      return;
    }

    // Unsubscribe the specified windows
    for (const window of windowsToUnsubscribe) {
      try {
        const id = getWebContentsId(window);
        if (subscribedWindows.has(id)) {
          const unsubscribe = unsubscribeFunctions.get(id);
          if (unsubscribe) {
            unsubscribe();
            unsubscribeFunctions.delete(id);
          }
          subscribedWindows.delete(id);
        }
      } catch (error) {
        console.error('[Bridge] Error unsubscribing window:', error);
      }
    }
  }

  // Return the bridge interface
  return {
    subscribe: subscribeWindows,
    unsubscribe: unsubscribeWindows,
    getSubscribedWindows: () => Array.from(subscribedWindows),
    destroy: () => {
      unsubscribeWindows();
    },
  };
}

/**
 * Internal utility to create a bridge from a store
 * This is used by createZustandBridge and createReduxBridge
 * @internal
 */
export function createBridgeFromStore<S extends AnyState = AnyState>(
  store: StoreApi<S> | Store<S>,
  windows: Array<BrowserWindow | WebContentsWrapper> = [],
  options?: ZustandOptions<S> | ReduxOptions<S>,
): BackendBridge<number> {
  // Get or create a state manager for the store
  const stateManager = getStateManager(store, options);

  // Create the bridge using the state manager
  return createCoreBridge(stateManager, windows);
}
