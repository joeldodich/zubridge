import { handlers as counterHandlers } from './counter/index.js';
import { handlers as windowHandlers } from './window/index.js';

export const actionHandlers = (store: Store, initialState: State) => ({
  ...counterHandlers(store),
  ...windowHandlers(store),
  'STORE:RESET': () => store.setState(() => initialState),
});

export type Subscribe = (listener: (state: State, prevState: State) => void) => () => void;
export type Handlers = Record<string, () => void>;
export type State = {
  counter: number;
  window: { isOpen: boolean };
};
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: Subscribe;
};
