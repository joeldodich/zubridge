import { createStore } from 'zustand/vanilla';
import { getZubridgeMode } from '../utils/mode.js';

import type { State } from '../types/index.js';

/**
 * Creates a store with appropriate initial state for the current mode
 */
export const createModeStore = () => {
  const mode = getZubridgeMode();
  console.log(`[Store] Creating store for mode: ${mode}`);

  const initialState = {
    counter: 0,
    window: { isOpen: false },
  };

  return createStore<State>()(() => initialState);
};

// Export a singleton store instance
export const store = createModeStore();
