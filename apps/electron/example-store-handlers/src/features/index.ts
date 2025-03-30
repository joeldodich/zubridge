import { handlers as counterHandlers } from './counter/index.js';
import { handlers as windowHandlers } from './window/index.js';

export type AppState = { counter: number };

export const actionHandlers = (setState: Store['setState'], initialState: AppState) => ({
  ...counterHandlers(setState),
  ...windowHandlers(setState),
  'STORE:RESET': () => setState(() => initialState),
});

export type Subscribe = (listener: (state: State, prevState: State) => void) => () => void;
export type Handlers = Record<string, () => void>;
export type State = { counter: number };
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: Subscribe;
};
