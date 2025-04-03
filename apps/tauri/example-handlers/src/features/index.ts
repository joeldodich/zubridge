import { handlers as counterHandlers } from './counter/index.js';
import { handlers as windowHandlers } from './window/index.js';

export const actionHandlers = (setState: Store['setState'], initialState: State) => ({
  ...counterHandlers(setState),
  ...windowHandlers(),
  'STORE:RESET': () => setState(() => initialState),
});

export type Subscribe = (listener: (state: State, prevState: State) => void) => () => void;
export type Handlers = Record<string, (payload?: unknown) => void>;
export type State = { counter: number; window: { isOpen: boolean } };
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: Subscribe;
};
