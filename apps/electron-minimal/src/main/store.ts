import { createZustandBridge } from '@zubridge/electron/main'
// import { mainZustandBridge } from '@zubridge/electron/main';
import { createStore } from 'zustand/vanilla'
import type { AppState } from '../types/index'

// create app store
export const store = createStore<AppState>((set) => ({
  counter: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}))

export const initializeZustandBridge = () => {
  return createZustandBridge(store)
  // return mainZustandBridge(store)
}
