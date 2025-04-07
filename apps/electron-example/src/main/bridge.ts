import { BrowserWindow } from 'electron';
import type { StoreApi } from 'zustand';
import type { ZustandBridge } from '@zubridge/electron/main';

import { getZubridgeMode } from '../utils/mode.js';
import type { BaseState } from '../types/index.js';

// Dynamically import the appropriate implementation based on mode
export const createBridge = async <S extends BaseState, Store extends StoreApi<S>>(
  store: Store,
  windows: BrowserWindow[],
): Promise<ZustandBridge> => {
  const mode = getZubridgeMode();
  console.log(`[Main] Using Zubridge mode: ${mode}`);

  switch (mode) {
    case 'basic':
      const { createBasicBridge } = await import('../modes/basic/main.js');
      return createBasicBridge(store, windows);

    case 'handlers':
      const { createHandlersBridge } = await import('../modes/handlers/main.js');
      return createHandlersBridge(store, windows);

    case 'reducers':
      const { createReducersBridge } = await import('../modes/reducers/main.js');
      return createReducersBridge(store, windows);

    default:
      // This should never happen due to validation in getZubridgeMode
      console.warn(`[Main] Unknown mode: ${mode}, falling back to reducers mode`);
      const { createReducersBridge: fallback } = await import('../modes/reducers/main.js');
      return fallback(store, windows);
  }
};
