import type { BrowserWindow } from 'electron';
import type { Store } from 'redux';
import type { StoreApi } from 'zustand/vanilla';
import type { BackendBridge, WebContentsWrapper, AnyState, Dispatch } from '@zubridge/types';
import { createCoreBridge } from './bridge.js';
import { createDispatch } from './utils/dispatch.js';
import { createZustandAdapter, ZustandOptions } from './adapters/zustand.js';
import { createReduxAdapter, ReduxOptions } from './adapters/redux.js';
import { Action } from '@zubridge/types';
import { WebContents } from 'electron';

/**
 * Export the core bridge creation function for custom implementations
 */
export { createCoreBridge };

/**
 * Re-export adapter options types
 */
export type { ZustandOptions, ReduxOptions };

/**
 * Interface for a bridge that connects a Zustand store to the main process
 */
export interface ZustandBridge<S extends AnyState = AnyState> extends BackendBridge<number> {
  subscribe: (windows: Array<BrowserWindow | WebContentsWrapper>) => { unsubscribe: () => void };
  unsubscribe: (windows?: Array<BrowserWindow | WebContentsWrapper>) => void;
  getSubscribedWindows: () => number[];
  dispatch: Dispatch<S>;
  destroy: () => void;
}

/**
 * Creates a bridge between a Zustand store and the renderer process
 */
export function createZustandBridge<S extends AnyState>(
  store: StoreApi<S>,
  windows: Array<BrowserWindow | WebContentsWrapper> = [],
  options?: ZustandOptions<S>,
): ZustandBridge<S> {
  const stateManager = createZustandAdapter(store, options);
  const coreBridge = createCoreBridge(stateManager, windows);
  const dispatchFn = createDispatch(stateManager);

  return {
    subscribe: coreBridge.subscribe,
    unsubscribe: coreBridge.unsubscribe,
    getSubscribedWindows: coreBridge.getSubscribedWindows,
    destroy: coreBridge.destroy,
    dispatch: dispatchFn,
  };
}

/**
 * Interface for a bridge that connects a Redux store to the main process
 */
export interface ReduxBridge<S extends AnyState = AnyState> extends BackendBridge<number> {
  subscribe: (windows: Array<BrowserWindow | WebContentsWrapper>) => { unsubscribe: () => void };
  unsubscribe: (windows?: Array<BrowserWindow | WebContentsWrapper>) => void;
  getSubscribedWindows: () => number[];
  dispatch: Dispatch<S>;
  destroy: () => void;
}

/**
 * Creates a bridge between a Redux store and the renderer process
 */
export function createReduxBridge<S extends AnyState>(
  store: Store<S>,
  windows: Array<BrowserWindow | WebContentsWrapper> = [],
  options?: ReduxOptions<S>,
): ReduxBridge<S> {
  const stateManager = createReduxAdapter(store, options);
  const coreBridge = createCoreBridge(stateManager, windows);
  const dispatchFn = createDispatch(stateManager);

  return {
    subscribe: coreBridge.subscribe,
    unsubscribe: coreBridge.unsubscribe,
    getSubscribedWindows: coreBridge.getSubscribedWindows,
    destroy: coreBridge.destroy,
    dispatch: dispatchFn,
  };
}

/**
 * Legacy bridge alias for backward compatibility
 * @deprecated This is now an alias for createZustandBridge and uses the new IPC channels.
 * Please update your code to use createZustandBridge directly in the future.
 */
export const mainZustandBridge = createZustandBridge;

export { createDispatch } from './utils/dispatch';
