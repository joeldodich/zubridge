import { create } from 'zustand';
import { rendererZustandBridge } from 'zubridge-tauri';
import type { State } from '../../features/index.js';

const initialState: State = {
  counter: 0,
};

console.log('useStore: Creating store');
export const useStore = create<State>((set) => {
  console.log('useStore: Creating store with initial:', initialState);

  // Create bridge and subscribe to state updates
  const { handlers } = rendererZustandBridge<State>();
  handlers.subscribe((newState: State) => {
    console.log('useStore: Received state update:', newState);
    set(newState);
  });

  console.log('useStore: Bridge created');
  return initialState;
});

export const { handlers } = rendererZustandBridge<State>();
