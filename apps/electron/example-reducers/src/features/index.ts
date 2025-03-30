import type { Reducer } from '@zubridge/electron';

import { reducer as counterReducer } from './counter/index.js';
import { reducer as windowReducer } from './window/index.js';
import type { WindowState } from './window/index.js';

export type State = { counter: number; window: WindowState };

export const rootReducer: Reducer<State> = (state, action) => ({
  counter: counterReducer(state.counter, action),
  window: windowReducer(state.window, action),
});

export type Subscribe = (listener: (state: State, prevState: State) => void) => () => void;
export type Handlers = Record<string, () => void>;
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: Subscribe;
};
