import { createZustandBridge } from '@zubridge/electron/main';
import type { BrowserWindow } from 'electron';
import type { StoreApi } from 'zustand';
import type { ZustandBridge } from '@zubridge/electron/main';

// Import counter handlers
import { incrementCounter, decrementCounter, setCounter } from './features/counter/index.js';
// Import window handlers
import { createWindow, closeWindow } from './features/window/index.js';
// Import the state type
import type { BaseState } from '../../types/index.js';
import type { ActionHandlers } from './features/index.js';

/**
 * Creates action handlers for the handlers mode
 */
export const createHandlers = <S extends BaseState>(store: StoreApi<S>): ActionHandlers => {
  return {
    'COUNTER:INCREMENT': incrementCounter(store),
    'COUNTER:DECREMENT': decrementCounter(store),
    'COUNTER:SET': setCounter(store),
    'WINDOW:CREATE': createWindow(store),
    'WINDOW:CLOSE': closeWindow(store),
  };
};

/**
 * Creates a bridge using the handlers approach
 * In this approach, we provide separate action handlers
 */
export const createHandlersBridge = <S extends BaseState, Store extends StoreApi<S>>(
  store: Store,
  windows: BrowserWindow[],
): ZustandBridge => {
  console.log('[Handlers Mode] Creating bridge with separate handlers');

  // Define action handlers
  const handlers = createHandlers(store);

  // Create bridge with handlers
  return createZustandBridge<S>(store, windows, {
    handlers,
  });
};
