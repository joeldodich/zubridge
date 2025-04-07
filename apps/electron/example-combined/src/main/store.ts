import { createStore } from 'zustand/vanilla';
import { getZubridgeMode } from '../utils/mode.js';

import type { State } from '../types/state.js';

// Create store with the appropriate initial state based on mode
export const createModeStore = () => {
  const mode = getZubridgeMode();
  console.log(`[Store] Creating store for mode: ${mode}`);

  // Common initial state for all modes
  const initialState = {
    counter: 0,
    window: { isOpen: false },
  };

  return createStore<State>()(() => initialState);
};

// Export a singleton store instance
export const store = createModeStore();
