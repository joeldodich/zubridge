import { handlers as counterHandlers } from './counter/index.js';
import { handlers as windowHandlers, type WindowState } from './window/index.js';

export type State = { counter: number; window: WindowState };

export const actionHandlers = (store: Store, initialState: State) => ({
  ...counterHandlers(store),
  ...windowHandlers(store),
  'STORE:RESET': () => store.setState(() => initialState),
});

export type Subscribe = (listener: (state: State, prevState: State) => void) => () => void;
export interface Handlers {
  [key: string]: (payload?: any) => void;
}
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: Subscribe;
};
