import { createStore } from 'zustand/vanilla';

import type { State } from '../features/index.js';

export const initialState = {
  counter: 0,
  window: { isOpen: false },
};

export const store = createStore<State>()(() => initialState);
