import { createStore } from 'zustand/vanilla';
import { mainZustandBridge } from 'zuri/main';
import { emit } from '@tauri-apps/api/event';
import { rootReducer, type State } from '../features/index.js';

const initialState = {
  counter: 0,
};

// Create the Zustand store
export const store = createStore<State>()(() => initialState);

// Initialize the bridge immediately
console.log('Store: Creating bridge...');
const bridgePromise = mainZustandBridge(store, {
  reducer: rootReducer,
});

// Wait for bridge to be ready
export const initBridge = async () => {
  try {
    console.log('Store: Waiting for bridge...');
    await bridgePromise;
    // Explicitly emit bridge ready event after initialization
    await emit('zuri:bridge-ready');
    console.log('Store: Bridge ready');
  } catch (err) {
    console.error('Store: Bridge failed:', err);
    throw err;
  }
};

// Export types for the renderer
export type { State };
export type Store = {
  getState: () => State;
  getInitialState: () => State;
  setState: (stateSetter: (state: State) => State) => void;
  subscribe: (listener: (state: State, prevState: State) => void) => () => void;
};
