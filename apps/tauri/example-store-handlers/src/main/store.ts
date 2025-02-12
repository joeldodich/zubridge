import { createStore } from 'zustand/vanilla';
import { mainZustandBridge } from 'zubridge-tauri/main';
import { emit } from '@tauri-apps/api/event';
import { actionHandlers, type State } from '../features/index.js';

const initialState = {
  counter: 0,
};

console.log('Store: Creating with initial state:', initialState);

// Create the Zustand store
export const store = createStore<State>()((setState) => {
  console.log('Store: Creating initial state:', initialState);
  return {
    ...initialState,
    ...actionHandlers(setState, initialState),
  };
});

// Initialize the bridge immediately
console.log('Store: Creating bridge...');
const bridgePromise = mainZustandBridge(store);

// Add subscription for debugging
store.subscribe((state) => {
  console.log('Store: State updated:', state);
});

// Wait for bridge to be ready
export const initBridge = async () => {
  try {
    console.log('Store: Waiting for bridge...');
    await bridgePromise;
    // Explicitly emit bridge ready event after initialization
    await emit('zubridge-tauri:bridge-ready');
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
