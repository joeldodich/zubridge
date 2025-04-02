import { createStore } from 'zustand/vanilla';

import { actionHandlers } from '../features/index.js';
import type { WindowState } from '../features/window/index.js';

export type State = { counter: number; window: WindowState };

const initialState = {
  counter: 0,
  window: { isOpen: false },
};

export const store = createStore<State>()((setState) => ({
  ...initialState,
  ...actionHandlers(setState, initialState),
}));
